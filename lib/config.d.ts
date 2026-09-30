import z from '@deepseek-ai/schemastery';
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    /**
     * `enabled` and the object sections below are declared `.volatile()` so the
     * Host's config-schema projection exposes them as a live Web Settings form
     * (each volatile ancestor makes its whole subtree editable — see
     * dsh-settings `volatileForm`). The plugin's own read paths fold the parsed
     * snapshot through `plainConfig` (util.ts) to detach the volatile wrappers
     * before use.
     */
    enabled: z<boolean, boolean, "volatile-defined">;
    reviewer: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        /** 'chat' = OpenAI-compatible endpoint or, with an empty baseURL, the session model via ctx.llm. 'systemone' = System One decision API (TypeSafe / SiliconFlow). */
        protocol: z<"chat" | "systemone", "chat" | "systemone", "defined">;
        /** Empty baseURL = review with the session's current model via ctx.llm. With protocol:'systemone', an empty baseURL resolves to the SiliconFlow default. */
        baseURL: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        apiKeyFile: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        /** Verdict JSON is ~100-300 tokens; the cap only guards runaway output. */
        maxTokens: z<number, number, "defined">;
        /**
         * Request-side reasoning control. Verdicts always come from final text;
         * chain-of-thought is never parsed as authorization. On the endpoint path,
         * 'off' sends `thinking:{type:disabled}`. On a `deepseek-official` session
         * model, it sends `reasoningEffort: off`.
         */
        thinking: z<"default" | "off", "default" | "off", "defined">;
        extraSystemPrompt: z<string, string, "defined">;
        /**
         * protocol:'systemone' only. The decision answer must reach this
         * confidence for its choice to stand; below it the verdict is forced
         * to deny (fail closed as a normal deny, never an infra failure).
         */
        systemone: z<Schemastery.ObjectS<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, "defined">;
        /**
         * Read-only fact finding. Fixed tools only: no shell, network, escalation,
         * or nested approval request. File content is available only through
         * inspect_text_file when factFinding.content.enabled is true.
         */
        factFinding: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        /** 'chat' = OpenAI-compatible endpoint or, with an empty baseURL, the session model via ctx.llm. 'systemone' = System One decision API (TypeSafe / SiliconFlow). */
        protocol: z<"chat" | "systemone", "chat" | "systemone", "defined">;
        /** Empty baseURL = review with the session's current model via ctx.llm. With protocol:'systemone', an empty baseURL resolves to the SiliconFlow default. */
        baseURL: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        apiKeyFile: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        /** Verdict JSON is ~100-300 tokens; the cap only guards runaway output. */
        maxTokens: z<number, number, "defined">;
        /**
         * Request-side reasoning control. Verdicts always come from final text;
         * chain-of-thought is never parsed as authorization. On the endpoint path,
         * 'off' sends `thinking:{type:disabled}`. On a `deepseek-official` session
         * model, it sends `reasoningEffort: off`.
         */
        thinking: z<"default" | "off", "default" | "off", "defined">;
        extraSystemPrompt: z<string, string, "defined">;
        /**
         * protocol:'systemone' only. The decision answer must reach this
         * confidence for its choice to stand; below it the verdict is forced
         * to deny (fail closed as a normal deny, never an infra failure).
         */
        systemone: z<Schemastery.ObjectS<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, "defined">;
        /**
         * Read-only fact finding. Fixed tools only: no shell, network, escalation,
         * or nested approval request. File content is available only through
         * inspect_text_file when factFinding.content.enabled is true.
         */
        factFinding: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, "defined">;
    }>>>, "volatile">;
    policy: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        /** Tool names the reviewer answers for; empty = every approval ask. */
        tools: z<string[], string[], "defined">;
        /**
         * TYPED no-review allow rules. A match grants the pending approval
         * (`allowed-once`) WITHOUT review, so the shape is deliberately
         * inexpressive: exact tool name + literal operation prefixes + (for
         * escalation asks) an explicit target that can never exceed
         * `workspace-write`. No regexes — an allow false positive is a
         * permission incident, which is exactly why this path is deliberately
         * inexpressive.
         */
        allowRules: z<({
            tool?: string | null | undefined;
            operations?: string[] | null | undefined;
            escalationTarget?: string | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            /** Exact tool name the rule applies to (e.g. 'bash'). */
            tool: z<string, string, "defined">;
            /**
             * Literal operation prefixes (e.g. 'git status', 'mkdir -p ./dist').
             * The operation is the call's `command` / `operation` / `script`
             * argument field. Empty = any operation (plain asks only; an
             * escalation rule must pin operations).
             */
            operations: z<string[], string[], "defined">;
            /**
             * '' = plain asks only. 'workspace-write' = this rule may also grant
             * escalation asks whose requested target is EXACTLY workspace-write.
             * 'danger-full-access' is refused unless
             * policy.allowDangerFullAccessRules is explicitly turned on.
             */
            escalationTarget: z<string, string, "defined">;
        }>>[], "defined">;
        /**
         * Opt-in gate for allow rules that name `danger-full-access`. OFF by
         * default: while it is off a rule can only grant plain asks or escalations
         * to `workspace-write`, so no rule can ever hand out an unsandboxed
         * execution. An allow-rule hit skips the reviewer entirely, so switching
         * this on is a deliberate widening of what the guardian authorizes
         * without judgment.
         */
        allowDangerFullAccessRules: z<boolean, boolean, "defined">;
        maxInputChars: z<number, number, "defined">;
        /** true = reviewer errors resolve to 'unavailable' (fail closed, neutral for the breaker); false = delegate to the next answerer (human). */
        denyOnReviewerError: z<boolean, boolean, "defined">;
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
        onLowConfidence: z<"deny" | "defer", "deny" | "defer", "defined">;
        /**
         * Structured evidence for the reviewer: recent human prompts (trusted
         * authorization, seq-tagged) plus untrusted execution context (assistant
         * text, tool calls, and tool-result facts). Reasoning blocks and
         * plugin-injected context are never included. Older context may be trimmed.
         * The latest user authorization is never truncated; if it exceeds maxChars,
         * the approval request is rejected before reviewer execution.
         */
        context: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        /** Tool names the reviewer answers for; empty = every approval ask. */
        tools: z<string[], string[], "defined">;
        /**
         * TYPED no-review allow rules. A match grants the pending approval
         * (`allowed-once`) WITHOUT review, so the shape is deliberately
         * inexpressive: exact tool name + literal operation prefixes + (for
         * escalation asks) an explicit target that can never exceed
         * `workspace-write`. No regexes — an allow false positive is a
         * permission incident, which is exactly why this path is deliberately
         * inexpressive.
         */
        allowRules: z<({
            tool?: string | null | undefined;
            operations?: string[] | null | undefined;
            escalationTarget?: string | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            /** Exact tool name the rule applies to (e.g. 'bash'). */
            tool: z<string, string, "defined">;
            /**
             * Literal operation prefixes (e.g. 'git status', 'mkdir -p ./dist').
             * The operation is the call's `command` / `operation` / `script`
             * argument field. Empty = any operation (plain asks only; an
             * escalation rule must pin operations).
             */
            operations: z<string[], string[], "defined">;
            /**
             * '' = plain asks only. 'workspace-write' = this rule may also grant
             * escalation asks whose requested target is EXACTLY workspace-write.
             * 'danger-full-access' is refused unless
             * policy.allowDangerFullAccessRules is explicitly turned on.
             */
            escalationTarget: z<string, string, "defined">;
        }>>[], "defined">;
        /**
         * Opt-in gate for allow rules that name `danger-full-access`. OFF by
         * default: while it is off a rule can only grant plain asks or escalations
         * to `workspace-write`, so no rule can ever hand out an unsandboxed
         * execution. An allow-rule hit skips the reviewer entirely, so switching
         * this on is a deliberate widening of what the guardian authorizes
         * without judgment.
         */
        allowDangerFullAccessRules: z<boolean, boolean, "defined">;
        maxInputChars: z<number, number, "defined">;
        /** true = reviewer errors resolve to 'unavailable' (fail closed, neutral for the breaker); false = delegate to the next answerer (human). */
        denyOnReviewerError: z<boolean, boolean, "defined">;
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
        onLowConfidence: z<"deny" | "defer", "deny" | "defer", "defined">;
        /**
         * Structured evidence for the reviewer: recent human prompts (trusted
         * authorization, seq-tagged) plus untrusted execution context (assistant
         * text, tool calls, and tool-result facts). Reasoning blocks and
         * plugin-injected context are never included. Older context may be trimmed.
         * The latest user authorization is never truncated; if it exceeds maxChars,
         * the approval request is rejected before reviewer execution.
         */
        context: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, "defined">;
    }>>>, "volatile">;
    breaker: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        consecutiveDenyLimit: z<number, number, "defined">;
        windowSize: z<number, number, "defined">;
        windowDenyLimit: z<number, number, "defined">;
        action: z<"off" | "cancel" | "inject", "off" | "cancel" | "inject", "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        consecutiveDenyLimit: z<number, number, "defined">;
        windowSize: z<number, number, "defined">;
        windowDenyLimit: z<number, number, "defined">;
        action: z<"off" | "cancel" | "inject", "off" | "cancel" | "inject", "defined">;
    }>>>, "volatile">;
    audit: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        path: z<string, string, "defined">;
        includeToolInput: z<boolean, boolean, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        path: z<string, string, "defined">;
        includeToolInput: z<boolean, boolean, "defined">;
    }>>>, "volatile">;
}>>, Schemastery.ObjectT<NoInfer<{
    /**
     * `enabled` and the object sections below are declared `.volatile()` so the
     * Host's config-schema projection exposes them as a live Web Settings form
     * (each volatile ancestor makes its whole subtree editable — see
     * dsh-settings `volatileForm`). The plugin's own read paths fold the parsed
     * snapshot through `plainConfig` (util.ts) to detach the volatile wrappers
     * before use.
     */
    enabled: z<boolean, boolean, "volatile-defined">;
    reviewer: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        /** 'chat' = OpenAI-compatible endpoint or, with an empty baseURL, the session model via ctx.llm. 'systemone' = System One decision API (TypeSafe / SiliconFlow). */
        protocol: z<"chat" | "systemone", "chat" | "systemone", "defined">;
        /** Empty baseURL = review with the session's current model via ctx.llm. With protocol:'systemone', an empty baseURL resolves to the SiliconFlow default. */
        baseURL: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        apiKeyFile: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        /** Verdict JSON is ~100-300 tokens; the cap only guards runaway output. */
        maxTokens: z<number, number, "defined">;
        /**
         * Request-side reasoning control. Verdicts always come from final text;
         * chain-of-thought is never parsed as authorization. On the endpoint path,
         * 'off' sends `thinking:{type:disabled}`. On a `deepseek-official` session
         * model, it sends `reasoningEffort: off`.
         */
        thinking: z<"default" | "off", "default" | "off", "defined">;
        extraSystemPrompt: z<string, string, "defined">;
        /**
         * protocol:'systemone' only. The decision answer must reach this
         * confidence for its choice to stand; below it the verdict is forced
         * to deny (fail closed as a normal deny, never an infra failure).
         */
        systemone: z<Schemastery.ObjectS<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, "defined">;
        /**
         * Read-only fact finding. Fixed tools only: no shell, network, escalation,
         * or nested approval request. File content is available only through
         * inspect_text_file when factFinding.content.enabled is true.
         */
        factFinding: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        /** 'chat' = OpenAI-compatible endpoint or, with an empty baseURL, the session model via ctx.llm. 'systemone' = System One decision API (TypeSafe / SiliconFlow). */
        protocol: z<"chat" | "systemone", "chat" | "systemone", "defined">;
        /** Empty baseURL = review with the session's current model via ctx.llm. With protocol:'systemone', an empty baseURL resolves to the SiliconFlow default. */
        baseURL: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        apiKeyFile: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        /** Verdict JSON is ~100-300 tokens; the cap only guards runaway output. */
        maxTokens: z<number, number, "defined">;
        /**
         * Request-side reasoning control. Verdicts always come from final text;
         * chain-of-thought is never parsed as authorization. On the endpoint path,
         * 'off' sends `thinking:{type:disabled}`. On a `deepseek-official` session
         * model, it sends `reasoningEffort: off`.
         */
        thinking: z<"default" | "off", "default" | "off", "defined">;
        extraSystemPrompt: z<string, string, "defined">;
        /**
         * protocol:'systemone' only. The decision answer must reach this
         * confidence for its choice to stand; below it the verdict is forced
         * to deny (fail closed as a normal deny, never an infra failure).
         */
        systemone: z<Schemastery.ObjectS<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            confidenceThreshold: z<number, number, "defined">;
            /**
             * Optional request-side context budget, sent as `max_len`. 0 = not sent,
             * so the endpoint keeps whatever it was deployed with. Self-hosted
             * System One servers (Laya) truncate the state at their own default, so a
             * long policy + evidence needs either this or a higher deployment budget.
             */
            maxLen: z<number, number, "defined">;
        }>>, "defined">;
        /**
         * Read-only fact finding. Fixed tools only: no shell, network, escalation,
         * or nested approval request. File content is available only through
         * inspect_text_file when factFinding.content.enabled is true.
         */
        factFinding: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxRounds: z<number, number, "defined">;
            maxFacts: z<number, number, "defined">;
            /**
             * File-CONTENT inspection (inspect_text_file). OFF by default.
             * When an external reviewer.baseURL is configured, enabling this
             * explicitly allows bounded workspace content to be sent there.
             * Workspace-only, binary-denied, sensitive-path-denied, capped.
             */
            content: z<Schemastery.ObjectS<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                enabled: z<boolean, boolean, "defined">;
                maxBytes: z<number, number, "defined">;
            }>>, "defined">;
        }>>, "defined">;
    }>>>, "volatile">;
    policy: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        /** Tool names the reviewer answers for; empty = every approval ask. */
        tools: z<string[], string[], "defined">;
        /**
         * TYPED no-review allow rules. A match grants the pending approval
         * (`allowed-once`) WITHOUT review, so the shape is deliberately
         * inexpressive: exact tool name + literal operation prefixes + (for
         * escalation asks) an explicit target that can never exceed
         * `workspace-write`. No regexes — an allow false positive is a
         * permission incident, which is exactly why this path is deliberately
         * inexpressive.
         */
        allowRules: z<({
            tool?: string | null | undefined;
            operations?: string[] | null | undefined;
            escalationTarget?: string | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            /** Exact tool name the rule applies to (e.g. 'bash'). */
            tool: z<string, string, "defined">;
            /**
             * Literal operation prefixes (e.g. 'git status', 'mkdir -p ./dist').
             * The operation is the call's `command` / `operation` / `script`
             * argument field. Empty = any operation (plain asks only; an
             * escalation rule must pin operations).
             */
            operations: z<string[], string[], "defined">;
            /**
             * '' = plain asks only. 'workspace-write' = this rule may also grant
             * escalation asks whose requested target is EXACTLY workspace-write.
             * 'danger-full-access' is refused unless
             * policy.allowDangerFullAccessRules is explicitly turned on.
             */
            escalationTarget: z<string, string, "defined">;
        }>>[], "defined">;
        /**
         * Opt-in gate for allow rules that name `danger-full-access`. OFF by
         * default: while it is off a rule can only grant plain asks or escalations
         * to `workspace-write`, so no rule can ever hand out an unsandboxed
         * execution. An allow-rule hit skips the reviewer entirely, so switching
         * this on is a deliberate widening of what the guardian authorizes
         * without judgment.
         */
        allowDangerFullAccessRules: z<boolean, boolean, "defined">;
        maxInputChars: z<number, number, "defined">;
        /** true = reviewer errors resolve to 'unavailable' (fail closed, neutral for the breaker); false = delegate to the next answerer (human). */
        denyOnReviewerError: z<boolean, boolean, "defined">;
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
        onLowConfidence: z<"deny" | "defer", "deny" | "defer", "defined">;
        /**
         * Structured evidence for the reviewer: recent human prompts (trusted
         * authorization, seq-tagged) plus untrusted execution context (assistant
         * text, tool calls, and tool-result facts). Reasoning blocks and
         * plugin-injected context are never included. Older context may be trimmed.
         * The latest user authorization is never truncated; if it exceeds maxChars,
         * the approval request is rejected before reviewer execution.
         */
        context: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        /** Tool names the reviewer answers for; empty = every approval ask. */
        tools: z<string[], string[], "defined">;
        /**
         * TYPED no-review allow rules. A match grants the pending approval
         * (`allowed-once`) WITHOUT review, so the shape is deliberately
         * inexpressive: exact tool name + literal operation prefixes + (for
         * escalation asks) an explicit target that can never exceed
         * `workspace-write`. No regexes — an allow false positive is a
         * permission incident, which is exactly why this path is deliberately
         * inexpressive.
         */
        allowRules: z<({
            tool?: string | null | undefined;
            operations?: string[] | null | undefined;
            escalationTarget?: string | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            /** Exact tool name the rule applies to (e.g. 'bash'). */
            tool: z<string, string, "defined">;
            /**
             * Literal operation prefixes (e.g. 'git status', 'mkdir -p ./dist').
             * The operation is the call's `command` / `operation` / `script`
             * argument field. Empty = any operation (plain asks only; an
             * escalation rule must pin operations).
             */
            operations: z<string[], string[], "defined">;
            /**
             * '' = plain asks only. 'workspace-write' = this rule may also grant
             * escalation asks whose requested target is EXACTLY workspace-write.
             * 'danger-full-access' is refused unless
             * policy.allowDangerFullAccessRules is explicitly turned on.
             */
            escalationTarget: z<string, string, "defined">;
        }>>[], "defined">;
        /**
         * Opt-in gate for allow rules that name `danger-full-access`. OFF by
         * default: while it is off a rule can only grant plain asks or escalations
         * to `workspace-write`, so no rule can ever hand out an unsandboxed
         * execution. An allow-rule hit skips the reviewer entirely, so switching
         * this on is a deliberate widening of what the guardian authorizes
         * without judgment.
         */
        allowDangerFullAccessRules: z<boolean, boolean, "defined">;
        maxInputChars: z<number, number, "defined">;
        /** true = reviewer errors resolve to 'unavailable' (fail closed, neutral for the breaker); false = delegate to the next answerer (human). */
        denyOnReviewerError: z<boolean, boolean, "defined">;
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
        onLowConfidence: z<"deny" | "defer", "deny" | "defer", "defined">;
        /**
         * Structured evidence for the reviewer: recent human prompts (trusted
         * authorization, seq-tagged) plus untrusted execution context (assistant
         * text, tool calls, and tool-result facts). Reasoning blocks and
         * plugin-injected context are never included. Older context may be trimmed.
         * The latest user authorization is never truncated; if it exceeds maxChars,
         * the approval request is rejected before reviewer execution.
         */
        context: z<Schemastery.ObjectS<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enabled: z<boolean, boolean, "defined">;
            maxMessages: z<number, number, "defined">;
            maxChars: z<number, number, "defined">;
            /**
             * false (default): tool results reach the reviewer only as distilled
             * facts (output length + sha256), never raw text — raw tool output is
             * the main prompt-injection surface. true (debug/enhanced mode) also
             * includes capped raw result text.
             */
            rawToolResults: z<boolean, boolean, "defined">;
        }>>, "defined">;
    }>>>, "volatile">;
    breaker: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        consecutiveDenyLimit: z<number, number, "defined">;
        windowSize: z<number, number, "defined">;
        windowDenyLimit: z<number, number, "defined">;
        action: z<"off" | "cancel" | "inject", "off" | "cancel" | "inject", "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        consecutiveDenyLimit: z<number, number, "defined">;
        windowSize: z<number, number, "defined">;
        windowDenyLimit: z<number, number, "defined">;
        action: z<"off" | "cancel" | "inject", "off" | "cancel" | "inject", "defined">;
    }>>>, "volatile">;
    audit: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        path: z<string, string, "defined">;
        includeToolInput: z<boolean, boolean, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        path: z<string, string, "defined">;
        includeToolInput: z<boolean, boolean, "defined">;
    }>>>, "volatile">;
}>>, "plain">;
/** The defaults-resolved configuration shape (what cfg() returns). */
export interface ResolvedConfig {
    enabled: boolean;
    reviewer: {
        protocol: 'chat' | 'systemone';
        baseURL: string;
        model: string;
        apiKey: string;
        apiKeyEnv: string;
        apiKeyFile: string;
        timeoutMs: number;
        maxTokens: number;
        thinking: 'default' | 'off';
        extraSystemPrompt: string;
        systemone: {
            confidenceThreshold: number;
            maxLen: number;
        };
        factFinding: {
            enabled: boolean;
            maxRounds: number;
            maxFacts: number;
            content: {
                enabled: boolean;
                maxBytes: number;
            };
        };
    };
    policy: {
        tools: string[];
        allowRules: {
            tool: string;
            operations: string[];
            escalationTarget: string;
        }[];
        allowDangerFullAccessRules: boolean;
        maxInputChars: number;
        denyOnReviewerError: boolean;
        onLowConfidence: 'deny' | 'defer';
        context: {
            enabled: boolean;
            maxMessages: number;
            maxChars: number;
            rawToolResults: boolean;
        };
    };
    breaker: {
        enabled: boolean;
        consecutiveDenyLimit: number;
        windowSize: number;
        windowDenyLimit: number;
        action: 'cancel' | 'inject' | 'off';
    };
    audit: {
        enabled: boolean;
        path: string;
        includeToolInput: boolean;
    };
}
