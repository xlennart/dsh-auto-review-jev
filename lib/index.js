import { name, NS } from "./meta.js";
import { plainConfig } from "./util.js";
import { Config } from "./config.js";
import { validateConfig } from "./policy.js";
import { Breaker } from "./breaker.js";
import { createAuditor } from "./audit.js";
import { createAnswerer, DenialLedger } from "./approval-answerer.js";
import { createTracer, tracePath } from "./trace.js";
export { name, NS, inject, sourceKind } from "./meta.js";
export { Config } from "./config.js";
export { DEFAULT_REVIEWER_POLICY, validateConfig } from "./policy.js";
export { sha256, expandHome, plainConfig } from "./util.js";
export { buildEvidence, findToolCall, serializeRequest, actionFingerprint, PRIOR_MESSAGE_MAX_CHARS, } from "./evidence.js";
export { executeFacts, sanitizeGitUrl, isSensitiveContentPath, CONTENT_DENY_PATH_PATTERNS, FACT_TOOLS, } from "./facts.js";
export { parseVerdict, parseReviewerReply, buildPrompt, callReviewer, callSystemoneReviewer, reviewWithSessionModel, resolveApiKey, isLoopbackEndpoint, SYSTEMONE_QUESTIONS, DEFAULT_SYSTEMONE_BASE_URL, DEFAULT_SYSTEMONE_MODEL, } from "./reviewer.js";
export { Breaker, currentTurn } from "./breaker.js";
export { createAuditor } from "./audit.js";
export { createAnswerer, reviewOnceWithParseRetry, matchAllowRule, DenialLedger } from "./approval-answerer.js";
/**
 * Compact shape descriptor for a config leaf.
 *
 * The Host hands `apply` a *volatile* config tree — one reference wrapper per
 * `.volatile()` section — so a refusal has to say what actually arrived, not
 * only that the schema disagreed: `{}` in a trace cannot be told apart from a
 * missing or differently-wrapped value, and the fold that unwraps it only works
 * on the wrapper shape it expects.
 */
function describeValue(value) {
    if (value === null)
        return 'null';
    const type = typeof value;
    if (type !== 'object' && type !== 'function')
        return type + ':' + String(value);
    const record = value;
    const ctor = record.constructor?.name ?? '?';
    let text = '?';
    try {
        text = String(value).slice(0, 48);
    }
    catch {
        text = '(toString threw)';
    }
    return type + '/' + ctor
        + ' get=' + typeof record.get
        + ' own=[' + Object.getOwnPropertyNames(record).slice(0, 8).join('|') + ']'
        + ' proto=[' + Object.getOwnPropertyNames(Object.getPrototypeOf(record) ?? {}).slice(0, 8).join('|') + ']'
        + ' str=' + text;
}
/**
 * The plugin: a prepended `approval/request` answerer. Wires the settings
 * scope, the breaker/audit/ledger instances, and the composer commands.
 */
export function apply(ctx, config) {
    const rowConfig = (config ?? {});
    const log = ctx.logger(name);
    let scope = null;
    let fallback = null;
    let registerTried = false;
    /**
     * Config provenance, reported by the boot line. "The guardian resolved the
     * defaults" has three very different causes — the entry config never reached
     * `apply`, it reached it and was refused, or a live settings scope answered —
     * and the resolved values alone cannot tell them apart.
     */
    let armSource = 'none';
    let armRefusal = null;
    const getService = (serviceName) => {
        try {
            return ctx.get?.(serviceName);
        }
        catch {
            return undefined;
        }
    };
    /**
     * Arm the effective config once. The settings scope is used only when the
     * runtime actually hands one back: `register` may be absent, or present and
     * return nothing (current runtimes), and reading `scope` as armed in that
     * case would leave every config path on the refusal fallback. Whenever no
     * usable scope comes back, the entry config passed to `apply` is the live
     * config — the settings service writes user edits into this entry's own
     * config and reconciles it in, which re-runs `apply`.
     */
    const ensureConfig = () => {
        if (registerTried)
            return;
        registerTried = true;
        const settings = getService('settings');
        if (settings && typeof settings.register === 'function') {
            try {
                const registered = settings.register(NS, Config, { base: rowConfig, applies: 'live' });
                if (registered && typeof registered.get === 'function') {
                    scope = registered;
                    armSource = 'scope';
                    return;
                }
                log.warn('settings.register returned no scope; arming from the entry config');
            }
            catch (error) {
                log.warn('settings registration failed; falling back to row config: %s', String(error?.message ?? error));
            }
        }
        armRowConfig();
    };
    /**
     * Security-sensitive config resolution. An invalid config is never
     * skipped, defaulted, or partially applied: the plugin REFUSES to arm
     * (boot-time row config) or REFUSES the update (live settings) and retains
     * the last known-good config. When nothing valid was ever armed, the
     * effective config is disabled — approval asks delegate to the human
     * answerer instead of running a silently shrunken policy.
     */
    /**
     * Last-resort config, used only when neither a settings scope nor a valid
     * entry config could be armed: disabled, so approval asks reach the human.
     * Folded through `plainConfig` like every other read path — the schema marks
     * its sections `.volatile()`, so an unfolded parse exposes wrappers instead
     * of the sections themselves.
     */
    const refuseConfig = plainConfig(Config({ enabled: false }));
    let lastGood = null;
    let lastRefusal = null;
    const armRowConfig = () => {
        let candidate;
        try {
            // Unwrap BEFORE validating. The entry config reaches `apply` as a
            // *volatile* tree — every field the schema marks `.volatile()` arrives as
            // a reference wrapper (`{ get() }`), which is exactly how the Host hands
            // a live, settings-editable config to its plugin (the Settings service
            // reads the same tree as `plainConfig(fiber.config)`). Passing that tree
            // straight to `Config()` makes the schema see `{}` where a boolean
            // belongs and throw, so the fold has to come first; the second fold
            // detaches the wrappers the parse itself re-creates.
            candidate = plainConfig(Config(plainConfig(rowConfig)));
        }
        catch (error) {
            armRefusal = 'row-config-parse: ' + String(error?.message ?? error);
            log.error('refusing to arm: invalid row config: %s', String(error?.message ?? error));
            return;
        }
        const invalid = validateConfig(candidate);
        if (invalid) {
            armRefusal = 'row-config-invalid: ' + invalid;
            log.error('refusing to arm: %s', invalid);
            return;
        }
        fallback = candidate;
        armSource = 'row';
    };
    const cfg = () => {
        ensureConfig();
        if (!scope)
            return fallback ?? refuseConfig;
        let candidate;
        try {
            // Normalized exactly like the entry-config path: the fold detaches the
            // volatile wrappers the scope hands back, `Config` resolves every default,
            // and a second fold detaches what that parse re-creates. A scope that
            // returns nothing, or only part of the shape, therefore cannot hand a
            // later read an undefined section.
            candidate = plainConfig(Config(plainConfig(scope.get())));
        }
        catch (error) {
            if (lastRefusal !== 'settings-read') {
                log.warn('settings read failed; retaining last known-good config: %s', String(error?.message ?? error));
                lastRefusal = 'settings-read';
            }
            armRefusal = 'settings-read: ' + String(error?.message ?? error);
            return lastGood ?? refuseConfig;
        }
        const invalid = validateConfig(candidate);
        if (invalid) {
            if (lastRefusal !== invalid) {
                log.error('refusing to apply config update: %s (retaining last known-good config)', invalid);
                lastRefusal = invalid;
            }
            armRefusal = invalid;
            return lastGood ?? refuseConfig;
        }
        lastRefusal = null;
        armRefusal = null;
        lastGood = candidate;
        return candidate;
    };
    const breaker = new Breaker();
    const tracer = createTracer({ log });
    const auditor = createAuditor({ cfg, log });
    const ledger = new DenialLedger();
    const handler = createAnswerer({ ctx, getService, cfg, log, breaker, auditor, ledger, tracer });
    ctx.on('approval/request', handler, true);
    // Boot line. It answers the one question a silent guardian cannot: which
    // build is loaded, and what configuration it actually resolved. A stale
    // module in memory, a refused config, or a wrong endpoint are each visible
    // here before any ask arrives.
    try {
        const boot = cfg();
        tracer.line('boot', {
            enabled: boot.enabled,
            reviewer: boot.reviewer.protocol,
            endpoint: boot.reviewer.baseURL || '(session model)',
            model: boot.reviewer.model,
            denyOnReviewerError: boot.policy.denyOnReviewerError,
            auditEnabled: boot.audit.enabled,
            auditPath: boot.audit.path,
            tracePath: tracePath(),
            node: process.version,
            // Provenance: which path armed this config, what the entry config actually
            // carried, and why a refusal happened if one did.
            armSource,
            rowKeys: Object.keys(rowConfig).join(','),
            rowPreview: JSON.stringify(rowConfig).slice(0, 400),
            rowShape: (rowConfig !== null && typeof rowConfig === 'object'
                ? Object.entries(rowConfig).map(([key, value]) => key + '=' + describeValue(value)).join(' ; ')
                : describeValue(rowConfig)).slice(0, 600),
            armRefusal,
        });
    }
    catch (error) {
        tracer.error(error, 'boot');
    }
    // Composer commands: /auto-review and /approve. The plugin declares
    // inject ['commands'], so the registry is provided before apply; the
    // guard below keeps apply safe in compositions without the registry.
    // /approve is two-step: N reveals the EXACT denied action; N confirm
    // (only after the reveal) grants one retry — the trusted-evidence
    // semantics require that the user actually saw the full action first.
    const pendingReveals = new Map();
    try {
        const commands = getService('commands');
        if (commands && typeof commands.register === 'function') {
            const definition = {
                name: 'auto-review',
                description: 'Toggle or inspect the auto-review guardian (bare toggles; on / off / status)',
                input: { hint: '[on|off|status]' },
                handler: async (invocation) => {
                    ensureConfig();
                    const arg = String(invocation.rawInput ?? '').trim().toLowerCase();
                    if (arg === 'on' || arg === 'off' || arg === '') {
                        // Bare execution toggles the current state.
                        const enabled = arg === '' ? !cfg().enabled : arg === 'on';
                        const settings = getService('settings');
                        try {
                            if (scope)
                                await scope.update({ enabled });
                            else if (typeof settings?.update === 'function')
                                await settings.update(name, { enabled });
                            else {
                                return { kind: 'error', text: 'no settings provider mounted; set dsh-auto-review.enabled in the profile patch (or the Web Settings page) instead' };
                            }
                            return {
                                kind: 'success',
                                text: enabled
                                    ? 'auto-review enabled: approval asks are decided by the reviewer before any interactive prompt.'
                                    : 'auto-review disabled: approval asks fall through to the interactive answerer (human approval).',
                            };
                        }
                        catch (error) {
                            return { kind: 'error', text: 'failed to persist: ' + String(error?.message ?? error) };
                        }
                    }
                    if (arg === 'status') {
                        const c = cfg();
                        return {
                            kind: 'success',
                            text: [
                                'auto-review ' + (c.enabled ? 'enabled' : 'disabled'),
                                'reviewer ' + (c.reviewer.protocol === 'systemone'
                                    ? '[systemone] ' + (c.reviewer.model || 'Kev-4b (default)') + ' @ ' + (c.reviewer.baseURL || 'https://api.siliconflow.cn/v1 (default)') + ' — EGRESS: user requests, tool arguments, execution context, workspace/sandbox facts' + (c.reviewer.factFinding.enabled && c.reviewer.factFinding.content.enabled ? ', and requested workspace file content' : '; file content inspection is off')
                                    : c.reviewer.baseURL
                                        ? c.reviewer.model + ' @ ' + c.reviewer.baseURL + ' — EGRESS: user requests, tool arguments, execution context, workspace/sandbox facts' + (c.reviewer.factFinding.enabled && c.reviewer.factFinding.content.enabled ? ', and requested workspace file content' : '; file content inspection is off')
                                        : 'session model (calling agent provider/model) — local trust domain, no egress'),
                                'denyOnReviewerError ' + c.policy.denyOnReviewerError,
                                'breaker ' + c.breaker.action + ' (' + c.breaker.consecutiveDenyLimit + ' consecutive, ' + c.breaker.windowDenyLimit + ' per ' + c.breaker.windowSize + ')',
                                'context ' + (c.policy.context.enabled ? 'on' : 'off'),
                                'thinking ' + c.reviewer.thinking,
                                'audit ' + (c.audit.enabled ? 'on' : 'off') + ' @ ' + c.audit.path,
                            ].join('; '),
                        };
                    }
                    return { kind: 'error', text: 'usage: /auto-review on | off | status (bare toggles)' };
                },
            };
            commands.register(definition);
            const approveDefinition = {
                name: 'approve',
                description: 'Re-authorize one recently denied action (one retry, still reviewed)',
                input: { hint: '[N]' },
                handler: async (invocation) => {
                    const sid = invocation.agent?.session?.id ?? invocation.agent?.id ?? '';
                    const mine = ledger.list(sid);
                    if (mine.length === 0) {
                        return { kind: 'error', text: 'no recent auto-review denials for this session' };
                    }
                    const arg = String(invocation.rawInput ?? '').trim();
                    if (arg === '') {
                        return {
                            kind: 'success',
                            text: mine.map((d, i) => (i + 1) + '. ' + d.toolName + ' ' + d.arguments.slice(0, 80) + ' [' + d.risk + '] ' + d.reason.slice(0, 60)).join('\n') +
                                '\n\n/approve N shows the EXACT denied action (full arguments, cwd, identity hash); /approve N confirm authorizes one retry of it.',
                        };
                    }
                    const match = /^(\d+)(?:\s+confirm)?$/.exec(arg);
                    const n = match ? Number(match[1]) : NaN;
                    const picked = Number.isInteger(n) && n >= 1 && n <= mine.length ? mine[n - 1] : null;
                    if (!picked) {
                        return { kind: 'error', text: 'pick a number between 1 and ' + mine.length + ' (optionally "N confirm"), or run /approve to list' };
                    }
                    const wantsConfirm = /\s+confirm$/.test(arg);
                    if (!wantsConfirm) {
                        // Reveal ONLY. The security model defines post-denial approval
                        // as "the user saw the EXACT action", so the full canonical
                        // action is shown and the confirm step acknowledges it — a
                        // 80-char summary is not exact-action sight.
                        pendingReveals.set(sid, picked.id);
                        return {
                            kind: 'success',
                            text: [
                                'Denied action #' + picked.id + ' (the EXACT action, in full):',
                                'tool:      ' + picked.toolName,
                                'cwd:       ' + picked.cwd,
                                'arguments: ' + picked.arguments,
                                'risk:      ' + picked.risk,
                                'reason:    ' + picked.reason,
                                'identity:  ' + picked.fingerprint + ' (sha256 of tool + canonical arguments + cwd)',
                                'denied at: ' + new Date(picked.timestamp).toISOString(),
                                '',
                                'Nothing is authorized yet. To authorize ONE retry of exactly this action, run /approve ' + n + ' confirm.',
                                'The retry is still reviewed with this approval as trusted evidence; critical-risk actions still deny.',
                            ].join('\n'),
                        };
                    }
                    if (pendingReveals.get(sid) !== picked.id) {
                        return { kind: 'error', text: 'run /approve ' + n + ' first to see the exact action, then /approve ' + n + ' confirm' };
                    }
                    pendingReveals.delete(sid);
                    ledger.grant(sid, picked.id);
                    return {
                        kind: 'success',
                        text: 'approved one retry of: ' + picked.toolName + ' ' + picked.arguments.slice(0, 80) + ' (identity ' + picked.fingerprint.slice(0, 16) + '\u2026)' +
                            '. Retry the EXACT action; it will be reviewed again with this approval as trusted evidence (critical-risk actions still deny).',
                    };
                },
            };
            commands.register(approveDefinition);
        }
        else {
            log.warn('commands service unavailable; commands not registered');
        }
    }
    catch (error) {
        log.warn('commands unavailable: %s', String(error?.message ?? error));
    }
}
