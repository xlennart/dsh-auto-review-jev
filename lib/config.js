import z from '@deepseek-ai/schemastery';
export const Config = z.object({
    /**
     * `enabled` and the object sections below are declared `.volatile()` so the
     * Host's config-schema projection exposes them as a live Web Settings form
     * (each volatile ancestor makes its whole subtree editable — see
     * dsh-settings `volatileForm`). The plugin's own read paths fold the parsed
     * snapshot through `plainConfig` (util.ts) to detach the volatile wrappers
     * before use.
     */
    enabled: z.boolean().default(true).volatile(),
    reviewer: z.object({
        /** 'chat' = OpenAI-compatible endpoint or, with an empty baseURL, the session model via ctx.llm. 'systemone' = System One decision API (TypeSafe / SiliconFlow). */
        protocol: z.union(['chat', 'systemone']).default('chat'),
        /** Empty baseURL = review with the session's current model via ctx.llm. With protocol:'systemone', an empty baseURL resolves to the SiliconFlow default. */
        baseURL: z.string().default(''),
        model: z.string().default(''),
        apiKey: z.string().role('secret').default(''),
        apiKeyEnv: z.string().default(''),
        apiKeyFile: z.string().default(''),
        timeoutMs: z.number().default(24000),
        /** Verdict JSON is ~100-300 tokens; the cap only guards runaway output. */
        maxTokens: z.number().default(1024),
        /**
         * Request-side reasoning control. Verdicts always come from final text;
         * chain-of-thought is never parsed as authorization. On the endpoint path,
         * 'off' sends `thinking:{type:disabled}`. On a `deepseek-official` session
         * model, it sends `reasoningEffort: off`.
         */
        thinking: z.union(['default', 'off']).default('default'),
        extraSystemPrompt: z.string().default(''),
        /**
         * protocol:'systemone' only. The decision answer must reach this
         * confidence for its choice to stand; below it the verdict is forced
         * to deny (fail closed as a normal deny, never an infra failure).
         */
        systemone: z.object({
            confidenceThreshold: z.number().min(0.5).max(1).default(0.6),
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z.number().min(0).max(200000).default(0),
        }).default({ confidenceThreshold: 0.6, maxLen: 0 }),
        /**
         * Read-only fact finding. Fixed tools only: no shell, network, escalation,
         * or nested approval request. File content is available only through
         * inspect_text_file when factFinding.content.enabled is true.
         */
        factFinding: z.object({
            enabled: z.boolean().default(true),
            maxRounds: z.number().default(2),
            maxFacts: z.number().default(3),
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z.object({
                enabled: z.boolean().default(false),
                maxBytes: z.number().default(4096),
            }).default({ enabled: false, maxBytes: 4096 }),
        }).default({ enabled: true, maxRounds: 2, maxFacts: 3, content: { enabled: false, maxBytes: 4096 } }),
    }).volatile(),
    policy: z.object({
        /** Tool names the reviewer answers for; empty = every approval ask. */
        tools: z.array(z.string()).default([]),
        /**
         * TYPED no-review allow rules. A match grants the pending approval
         * (`allowed-once`) WITHOUT review, so the shape is deliberately
         * inexpressive: exact tool name + literal operation prefixes + (for
         * escalation asks) an explicit target that can never exceed
         * `workspace-write`. No regexes — an allow false positive is a
         * permission incident, which is exactly why this path is deliberately
         * inexpressive.
         */
        allowRules: z.array(z.object({
            /** Exact tool name the rule applies to (e.g. 'bash'). */
            tool: z.string().default(''),
            /**
             * Literal operation prefixes (e.g. 'git status', 'mkdir -p ./dist').
             * The operation is the call's `command` / `operation` / `script`
             * argument field. Empty = any operation (plain asks only; an
             * escalation rule must pin operations).
             */
            operations: z.array(z.string()).default([]),
            /**
             * '' = plain asks only. 'workspace-write' = this rule may also grant
             * escalation asks whose requested target is EXACTLY workspace-write.
             * 'danger-full-access' is refused unless
             * policy.allowDangerFullAccessRules is explicitly turned on.
             */
            escalationTarget: z.string().default(''),
        }).default({ tool: '', operations: [], escalationTarget: '' })).default([]),
        /**
         * Opt-in gate for allow rules that name `danger-full-access`. OFF by
         * default: while it is off a rule can only grant plain asks or escalations
         * to `workspace-write`, so no rule can ever hand out an unsandboxed
         * execution. An allow-rule hit skips the reviewer entirely, so switching
         * this on is a deliberate widening of what the guardian authorizes
         * without judgment.
         */
        allowDangerFullAccessRules: z.boolean().default(false),
        maxInputChars: z.number().default(16000),
        /** true = reviewer errors resolve to 'unavailable' (fail closed, neutral for the breaker); false = delegate to the next answerer (human). */
        denyOnReviewerError: z.boolean().default(true),
        /**
         * What to do when the reviewer's own decision is not confident enough to
         * be trusted (protocol:'systemone', decision confidence below
         * systemone.confidenceThreshold). 'deny' (default) keeps the historical
         * fail-closed behavior. 'defer' judges NOTHING and hands the ask to the
         * human answerer, so an unsure reviewer raises an approval prompt instead
         * of a refusal. Nothing else changes: a self-confident deny, a
         * critical-risk verdict, a malformed reply and a reviewer error keep their
         * own rules.
         */
        onLowConfidence: z.union(['deny', 'defer']).default('deny'),
        /**
         * Structured evidence for the reviewer: recent human prompts (trusted
         * authorization, seq-tagged) plus untrusted execution context (assistant
         * text, tool calls, and tool-result facts). Reasoning blocks and
         * plugin-injected context are never included. Older context may be trimmed.
         * The latest user authorization is never truncated; if it exceeds maxChars,
         * the approval request is rejected before reviewer execution.
         */
        context: z.object({
            enabled: z.boolean().default(true),
            maxMessages: z.number().default(10),
            maxChars: z.number().default(6000),
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z.boolean().default(false),
        }).default({ enabled: true, maxMessages: 10, maxChars: 6000, rawToolResults: false }),
    }).volatile(),
    breaker: z.object({
        enabled: z.boolean().default(true),
        consecutiveDenyLimit: z.number().default(3),
        windowSize: z.number().default(50),
        windowDenyLimit: z.number().default(10),
        action: z.union(['cancel', 'inject', 'off']).default('cancel'),
    }).volatile(),
    audit: z.object({
        enabled: z.boolean().default(true),
        path: z.string().default('~/.dsh/auto-review-audit.jsonl'),
        includeToolInput: z.boolean().default(false),
    }).volatile(),
});
