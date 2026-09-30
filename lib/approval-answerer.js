import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { injectSource, sourceKind } from "./meta.js";
import { sha256 } from "./util.js";
import { DEFAULT_REVIEWER_POLICY } from "./policy.js";
import { actionFingerprint, buildEvidence, findToolCall, recentCallIds, serializeRequest, sessionCwd, sessionEvents } from "./evidence.js";
import { executeFacts } from "./facts.js";
import { buildPrompt, callReviewer, callSystemoneReviewer, parseReviewerReply, reviewWithSessionModel, } from "./reviewer.js";
export class DenialLedger {
    bySession = new Map();
    overrides = [];
    nextId = 1;
    record(entry) {
        const rec = {
            id: this.nextId++,
            ...entry,
            fingerprint: actionFingerprint(entry.toolName, entry.arguments, entry.cwd),
            timestamp: Date.now(),
        };
        let bucket = this.bySession.get(entry.sessionId);
        if (!bucket) {
            bucket = [];
            this.bySession.set(entry.sessionId, bucket);
        }
        bucket.push(rec);
        if (bucket.length > 10)
            bucket.shift();
        return rec;
    }
    /** Newest-first denials for one session (at most 10). */
    list(sessionId) {
        return (this.bySession.get(sessionId) ?? []).slice().reverse();
    }
    /** Grant one retry override for the exact denial id; null when not found. */
    grant(sessionId, denialId) {
        const rec = (this.bySession.get(sessionId) ?? []).find((d) => d.id === denialId) ?? null;
        if (rec)
            this.overrides.push({ denialId: rec.id, fingerprint: rec.fingerprint, sessionId, remainingUses: 1 });
        return rec;
    }
    /**
     * Consume one pending override for an exact action fingerprint. This only
     * ADDS trusted evidence — the reviewer re-judges and critical still denies.
     */
    consume(sessionId, fingerprint) {
        const index = this.overrides.findIndex((o) => o.sessionId === sessionId && o.fingerprint === fingerprint && o.remainingUses > 0);
        if (index === -1)
            return null;
        const match = this.overrides[index];
        match.remainingUses--;
        return { approved: true, denialId: match.denialId, exactActionFingerprint: fingerprint, oneRetry: true };
    }
}
/**
 * Shell control characters that end the command a prefix was written for.
 * An allow rule names a LITERAL operation prefix, so without this guard a
 * rule for `git status` would also grant `git status; rm -rf /`. A remainder
 * containing any of these never matches and the ask goes back to the
 * reviewer: a false match hands out an authorization, a missed match only
 * costs one review.
 */
const OPERATION_CONTROL_CHARS = /[;&|<>`$(){}[\]\n\r]/;
/**
 * Prefix match for allow rules: the prefix must cover the operation exactly,
 * and the remainder must be argument-like (leading whitespace, no shell
 * control characters). `git statusX` therefore never matches `git status`.
 */
function operationMatchesPrefix(operation, prefix) {
    if (!prefix)
        return false;
    if (!operation.startsWith(prefix))
        return false;
    const rest = operation.slice(prefix.length);
    if (rest === '')
        return true;
    if (!/^\s/.test(rest))
        return false;
    return !OPERATION_CONTROL_CHARS.test(rest);
}
/**
 * Typed no-review allow matching. The rule shape is deliberately
 * inexpressive so a misconfigured rule cannot become a permission
 * incident: exact tool name, literal operation PREFIXES (against the
 * call's `command` / `operation` / `script` argument field, with shell
 * control characters in the remainder refusing to match), and — for
 * escalation asks only — an explicit target. `danger-full-access` is
 * refused by validateConfig unless policy.allowDangerFullAccessRules is on;
 * within this matcher a rule only matches the target it names literally.
 * Unstructured or unparseable arguments never match: the reviewer decides.
 */
export function matchAllowRule(rules, toolCall) {
    if (!toolCall || rules.length === 0)
        return null;
    let args = null;
    let escalationTarget = null;
    try {
        args = JSON.parse(toolCall.arguments);
        if (typeof args?.sandbox_permissions === 'string' && args.sandbox_permissions)
            escalationTarget = args.sandbox_permissions;
    }
    catch {
        return null;
    }
    if (!args)
        return null;
    const operation = typeof args.command === 'string' ? args.command
        : typeof args.operation === 'string' ? args.operation
            : typeof args.script === 'string' ? args.script
                : null;
    for (const rule of rules) {
        if (rule.tool !== toolCall.name)
            continue;
        if (escalationTarget !== null) {
            // Escalation ask: grantable only when the rule names the EXACT
            // target, and the rule must pin the operation too (validated).
            if (rule.escalationTarget !== escalationTarget)
                continue;
            if (operation === null)
                continue;
            if (!(rule.operations ?? []).some((prefix) => operationMatchesPrefix(operation, prefix)))
                continue;
            return rule;
        }
        // Plain ask: escalation-only rules never match.
        if (rule.escalationTarget)
            continue;
        if ((rule.operations ?? []).length === 0)
            return rule;
        if (operation !== null && rule.operations.some((prefix) => operationMatchesPrefix(operation, prefix)))
            return rule;
    }
    return null;
}
/**
 * One review with a single corrective retry for UNPARSEABLE replies (e.g.
 * unescaped quotes breaking the verdict JSON): the model gets one chance to
 * fix its formatting, then the error propagates and the caller fails closed.
 * The retried output goes through the exact same strict parser — nothing is
 * relaxed, and only the parser's own error message is fed back.
 */
export async function reviewOnceWithParseRetry(review, system) {
    let content = await review(system);
    try {
        return parseReviewerReply(content);
    }
    catch (error) {
        const corrective = system + '\n\nFormatting note: your previous reply could not be parsed as JSON (' +
            String(error?.message ?? error).slice(0, 200) + '). ' +
            'Reply with ONLY the JSON object, double-quote all keys and values, and escape any double quote inside a string value as \\".';
        content = await review(corrective);
        return parseReviewerReply(content); // throws again -> caller fails closed
    }
}
/**
 * The `approval/request` answerer: fail-closed integrity checks, then the
 * reviewer (endpoint or session model), then verdict handling with breaker
 * and denial ledger. It is registered PREPENDED by apply(), so approval
 * asks are decided before the interactive answerer ever sees them.
 */
export function createAnswerer(deps) {
    const { ctx, getService, cfg, log, breaker, auditor, ledger, tracer } = deps;
    const injectNotice = (agent, summary, text) => {
        try {
            agent?.inject(createUserMessage({
                content: [{ type: 'text', text }],
                source: injectSource({ kind: sourceKind, form: 'notice', summary: String(summary).slice(0, 120) }),
            }));
        }
        catch (error) {
            log.warn('inject failed for %s: %s', agent?.id, String(error?.message ?? error));
        }
    };
    /**
     * Anti-circumvention marker, injected as a FIXED minimal tail message via
     * agent.inject() (append-only next-step inbox — the session prefix and
     * its cache stay intact; only the tail is a one-time miss). The WHAT of a
     * denial is already carried by the tool error the model sees, so the
     * notice never embeds toolName/reason/pattern — a constant also leaks no
     * policy detail and keeps the history residue semantically clean.
     */
    const denialNoticeText = 'Auto-review denied this permission request. Do not bypass the policy or retry equivalent variants. Use a materially safer approach, or ask the user.';
    const denyNotice = (agent) => {
        injectNotice(agent, 'auto-review denied a permission request', denialNoticeText);
    };
    /**
     * Injection policy: only denials where circumvention is PLAUSIBLE get the
     * marker — high/critical reviewer denials and integrity fail-closed paths.
     * Ordinary insufficient-authorization denials (low/medium) and reviewer
     * infra failures do NOT inject: the former are not variant-risky, and for
     * the latter an unreachable reviewer judged nothing dangerous (the marker
     * would be semantically wrong there).
     */
    const isCircumventionPlausible = (risk) => risk === 'high' || risk === 'critical';
    const trip = (agent, reason, c) => {
        if (c.breaker.action === 'off')
            return;
        injectNotice(agent, 'auto-review circuit breaker tripped', 'The auto-review circuit breaker tripped. Stop proposing variants of the denied action and ask the user.');
        if (c.breaker.action === 'cancel') {
            try {
                agent?.cancel({ kind: 'hook', reason: 'auto-review: ' + reason });
            }
            catch (error) {
                log.warn('cancel failed for %s: %s', agent?.id, String(error?.message ?? error));
            }
        }
        if (agent?.id)
            breaker.reset(agent.id);
    };
    const answer = async (req, next) => {
        const c = cfg();
        if (!c.enabled) {
            tracer.skip('disabled');
            return next();
        }
        if (c.policy.tools.length > 0 && !c.policy.tools.includes(req.toolName)) {
            tracer.skip('tool-not-in-policy', { tool: req.toolName });
            return next();
        }
        if (req.signal?.aborted) {
            tracer.skip('aborted');
            return 'cancelled';
        }
        const started = globalThis.performance.now();
        const agent = req.agent;
        const events = sessionEvents(agent?.session);
        const cwd = sessionCwd(agent?.session);
        const sessionRef = { id: agent?.session?.id, cwd };
        const toolCall = findToolCall(events, req.callId);
        // Trust boundary: the reviewer may only judge a request whose exact tool
        // call it can see in the session log. A referenced-but-unresolvable call is
        // handed to the HUMAN rather than denied: a host-side refusal the client
        // never shows has left a live session stuck (2026-09-30), and the guardian
        // refuses only what it actually judged. An ask without any callId is not a
        // tool-call ask either — the human answers it.
        if (req.callId && !toolCall) {
            await auditor.record(req, agent, sessionRef, {
                decision: 'defer',
                risk: 'unknown',
                source: 'no-tool-call',
                reason: 'cannot resolve the exact tool call for this ask; deferring to the human (the reviewer never judges unknown arguments)',
                inputHash: sha256(serializeRequest(req, null)),
                durationMs: Math.round(globalThis.performance.now() - started),
                workspaceRoot: cwd,
                sandboxMode: '',
                toolCall: null,
            });
            tracer.skip('no-tool-call', { seen: recentCallIds(events) });
            return next();
        }
        if (!req.callId) {
            tracer.skip('no-callId');
            return next();
        }
        const serialized = serializeRequest(req, toolCall);
        const inputHash = sha256(serialized);
        let facts = {};
        try {
            const policy = getService('sandboxPolicy');
            if (policy) {
                const resolved = policy.resolve({ session: agent?.session });
                facts = { sandboxMode: resolved.mode, workspaceRoot: resolved.workspaceRoot };
            }
        }
        catch {
            /* optional fact-finding */
        }
        facts.workspaceRoot = facts.workspaceRoot ?? cwd;
        const finish = (entry) => auditor.record(req, agent, sessionRef, {
            ...entry,
            inputHash,
            durationMs: Math.round(globalThis.performance.now() - started),
            workspaceRoot: facts.workspaceRoot ?? '',
            sandboxMode: facts.sandboxMode ?? '',
            toolCall,
        });
        // Truncation guard: never hand the reviewer an input we had to cut off.
        if (serialized.length > c.policy.maxInputChars) {
            const reason = 'tool input exceeds ' + c.policy.maxInputChars + ' characters; denied without review';
            await finish({ decision: 'deny', risk: 'high', source: 'truncated', reason });
            breaker.note(agent.id, 'deny', c, events);
            const tripReason = breaker.reason(agent.id, c);
            if (tripReason)
                trip(agent, tripReason, c);
            else
                denyNotice(agent);
            return 'rejected';
        }
        // Typed no-review allow rules use exact fields, never command regexes.
        // A rule only ever matches the escalation target it names literally, and
        // validateConfig refuses `danger-full-access` unless
        // policy.allowDangerFullAccessRules was explicitly turned on, so a sloppy
        // rule cannot become a permission incident by accident. No match -> the
        // reviewer decides.
        const allowedBy = matchAllowRule(c.policy.allowRules, toolCall);
        if (allowedBy) {
            await finish({
                decision: 'allow',
                risk: 'low',
                source: 'allow-rule',
                reason: 'matches typed allow rule: tool ' + allowedBy.tool +
                    (allowedBy.operations.length ? ', operations ' + JSON.stringify(allowedBy.operations) : '') +
                    (allowedBy.escalationTarget ? ', escalation to ' + allowedBy.escalationTarget : ''),
            });
            breaker.note(agent.id, 'allow', c, events);
            return 'allowed-once';
        }
        // Reviewer phase. Explicit endpoint config wins; otherwise the review
        // rides the session's current model through the harness LLM runtime.
        const evidence = buildEvidence(events ?? [], c.policy.context);
        // Never review a truncated latest authorization: the head of a long user
        // message can be WIDER than the full text (a narrowing clause later in
        // the message would be lost). Fail closed instead.
        if (evidence.latestOverBudget) {
            const reason = 'the latest user authorization exceeds the evidence budget; fail closed (authorization is never truncated)';
            await finish({ decision: 'deny', risk: 'high', source: 'authorization-overflow', reason });
            breaker.note(agent.id, 'deny', c, events);
            const tripReason = breaker.reason(agent.id, c);
            if (tripReason)
                trip(agent, tripReason, c);
            else
                denyNotice(agent);
            return 'rejected';
        }
        // /approve override: a one-shot trusted re-authorization for this exact
        // action fingerprint. It only adds evidence — the reviewer re-judges.
        const fingerprint = actionFingerprint(req.toolName, toolCall.arguments, cwd ?? '');
        const override = ledger.consume(sessionRef.id ?? agent.id, fingerprint);
        // File-CONTENT inspection is an explicit data-exit opt-in. The same
        // workspace, sensitive-path, binary, and size limits apply to every
        // reviewer transport.
        const contentInspectionEnabled = c.reviewer.factFinding.enabled && c.reviewer.factFinding.content.enabled;
        const system = DEFAULT_REVIEWER_POLICY +
            (c.reviewer.extraSystemPrompt ? '\n\n' + c.reviewer.extraSystemPrompt : '') +
            '\n\nRuntime fact capability: file-content inspection is ' + (contentInspectionEnabled
            ? 'enabled; inspect_text_file {path} is available.'
            : 'disabled; do not request inspect_text_file.');
        let verdict = null;
        let factRound = 0;
        let totalFacts = 0;
        let factLimited = false;
        const factObservations = [];
        try {
            for (;;) {
                const prompt = buildPrompt(req, toolCall, facts, evidence, override, factObservations);
                // Protocol dispatch: systemone decision API / chat endpoint / session model.
                const review = (systemText) => c.reviewer.protocol === 'systemone'
                    ? callSystemoneReviewer(c.reviewer, { system: systemText, user: prompt.user, state: prompt.state }, req.signal)
                    : c.reviewer.baseURL
                        ? callReviewer(c.reviewer, { system: systemText, user: prompt.user, state: prompt.state }, req.signal)
                        : reviewWithSessionModel(ctx, agent, c.reviewer, { system: systemText, user: prompt.user, state: prompt.state }, req.signal);
                const reply = await reviewOnceWithParseRetry(review, system);
                if (reply.kind === 'verdict') {
                    verdict = reply.verdict;
                    break;
                }
                if (!c.reviewer.factFinding.enabled) {
                    factLimited = true;
                    throw new Error('reviewer requested facts but fact finding is disabled');
                }
                factRound++;
                if (factRound > c.reviewer.factFinding.maxRounds) {
                    factLimited = true;
                    throw new Error('reviewer exceeded fact rounds (' + c.reviewer.factFinding.maxRounds + ')');
                }
                const remaining = c.reviewer.factFinding.maxFacts - totalFacts;
                if (remaining <= 0) {
                    factLimited = true;
                    throw new Error('reviewer exceeded the fact budget (' + c.reviewer.factFinding.maxFacts + ')');
                }
                if (reply.queries.some((query) => query.tool === 'inspect_text_file') && !contentInspectionEnabled) {
                    factLimited = true;
                    throw new Error('reviewer requested file-content inspection but factFinding.content.enabled is false');
                }
                const batch = reply.queries.slice(0, remaining);
                totalFacts += batch.length;
                const observations = await executeFacts(batch, cwd ?? facts.workspaceRoot ?? '', {
                    contentEnabled: contentInspectionEnabled,
                    contentMaxBytes: c.reviewer.factFinding.content.maxBytes,
                });
                factObservations.push(...observations);
            }
        }
        catch (error) {
            log.warn('reviewer failed for %s: %s', req.toolName, String(error?.message ?? error));
            if (req.signal?.aborted)
                return 'cancelled';
            if (!c.policy.denyOnReviewerError)
                return next();
            const reason = 'reviewer unavailable; fail closed: ' + String(error?.message ?? error).slice(0, 200);
            await finish({ decision: 'deny', risk: 'unknown', source: factLimited ? 'fact-limit' : 'reviewer-error', reason });
            // Infra failure is not evidence of danger: neutral for the breaker,
            // and NOTHING is injected — an unreachable reviewer judged nothing,
            // so the anti-circumvention marker would be semantically wrong here.
            breaker.note(agent.id, 'unavailable', c, events);
            return 'unavailable';
        }
        verdict = verdict;
        // policy.onLowConfidence='defer': this deny is not a judgment about the
        // action — the transport forced it because its own decision fell below the
        // confidence threshold. Judging nothing means handing the ask to the human
        // (the same contract as a request whose call cannot be resolved), and
        // nothing is counted against the breaker or the denial ledger.
        if (verdict.decision === 'deny' && verdict.lowConfidence === true && c.policy.onLowConfidence === 'defer') {
            await finish({
                decision: 'defer',
                risk: verdict.risk,
                source: 'reviewer-low-confidence',
                reason: verdict.reason + ' — low decision confidence is deferred to the human (policy.onLowConfidence=defer)',
            });
            tracer.skip('low-confidence', { toolName: req.toolName, risk: verdict.risk });
            return next();
        }
        await finish({ ...verdict, source: 'reviewer' });
        if (verdict.decision === 'allow') {
            breaker.note(agent.id, 'allow', c, events);
            return 'allowed-once';
        }
        ledger.record({ sessionId: sessionRef.id ?? agent.id, toolName: req.toolName, arguments: toolCall.arguments, cwd: cwd ?? '', risk: verdict.risk, reason: verdict.reason });
        breaker.note(agent.id, 'deny', c, events);
        const tripReason = breaker.reason(agent.id, c);
        if (tripReason)
            trip(agent, tripReason, c);
        // Circumvention-plausible denials only: the marker goes out for
        // high/critical denials; low/medium (insufficient authorization) and
        // infra failures leave history alone.
        else if (isCircumventionPlausible(verdict.risk))
            denyNotice(agent);
        return 'rejected';
    };
    /**
     * Trace wrapper. `enter` is written BEFORE `cfg()`, so an ask that reaches
     * this answerer always leaves a line even when the config stage throws — the
     * one failure mode the audit file cannot report. The throw is re-raised
     * unchanged: a broken answerer must still delegate to the human rather than
     * silently swallow the ask.
     */
    return async (req, next) => {
        const started = globalThis.performance.now();
        try {
            tracer.enter({
                toolName: req.toolName,
                callId: req.callId ?? null,
                session: req.agent?.id ?? null,
                reason: String(req.reason ?? '').slice(0, 300),
                aborted: req.signal?.aborted === true,
            });
            const outcome = await answer(req, next);
            tracer.exit(outcome, globalThis.performance.now() - started);
            return outcome;
        }
        catch (error) {
            tracer.error(error, 'answerer');
            throw error;
        }
    };
}
