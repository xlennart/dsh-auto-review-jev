import { type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ApprovalRequest } from '@deepseek-ai/dsh-user-approval';
import type { Evidence, PostDenialApproval, ToolCallRecord } from './evidence.ts';
import { type FactObservation, type FactQuery } from './facts.ts';
export interface Verdict {
    decision: 'allow' | 'deny';
    risk: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    /**
     * Set by a transport that could not trust its OWN answer: the verdict is a
     * forced deny because the underlying decision was below the confidence
     * threshold, not because the reviewer judged the action unsafe. The
     * answerer may hand such an ask to the human (policy.onLowConfidence).
     */
    lowConfidence?: boolean;
}
export type ReviewerReply = {
    kind: 'verdict';
    verdict: Verdict;
} | {
    kind: 'fact-request';
    queries: FactQuery[];
};
/**
 * Parse the reviewer free-form JSON verdict (tolerates code fences and
 * surrounding prose). Throws on anything unusable — callers fail closed.
 */
export declare function parseVerdict(text: string): Verdict;
/**
 * Parse a reviewer reply: either a final verdict, or a bounded fact request.
 * Unknown fact tools or malformed queries throw — callers fail closed.
 */
export declare function parseReviewerReply(text: string): ReviewerReply;
export interface ReviewerPrompt {
    system: string;
    user: string;
    /**
     * Structured review input, protocol-independent. The chat path keeps its
     * `user` text; the systemone path builds its `state` from `request` plus
     * the live system text (policy + capability note) received at call time.
     */
    state: {
        request: Record<string, unknown>;
    };
}
/**
 * Transport-independent reviewer endpoint config. `protocol:'chat'` (default)
 * performs one OpenAI-compatible chat completion; `protocol:'systemone'`
 * performs one System One decision call (TypeSafe / SiliconFlow).
 */
export interface ReviewerEndpointConfig {
    protocol?: 'chat' | 'systemone';
    baseURL?: string;
    model?: string;
    apiKey?: string;
    apiKeyEnv?: string;
    apiKeyFile?: string;
    timeoutMs?: number;
    maxTokens?: number;
    thinking?: 'default' | 'off';
    /** protocol:'systemone' only. */
    systemone?: {
        /** Minimum confidence for the decision answer; below it the verdict is forced to deny (fail closed). */
        confidenceThreshold?: number;
        /**
         * Optional request-side context budget, sent as `max_len`. Omitted by
         * default, which means "inherit whatever the endpoint was deployed with" —
         * self-hosted System One servers (Laya) truncate the state at their own
         * default, so a long policy + evidence needs either this or a higher
         * deployment-side budget.
         */
        maxLen?: number;
    };
}
/**
 * True when `baseURL` addresses this machine. Parsed as a URL rather than
 * string-matched, because credentials in the authority can disguise a remote
 * host: `http://127.0.0.1@evil.example/v1` parses to the host `evil.example`.
 */
export declare function isLoopbackEndpoint(baseURL: string | undefined): boolean;
export declare function resolveApiKey(reviewer: {
    apiKey?: string;
    apiKeyEnv?: string;
    apiKeyFile?: string;
}): Promise<string | null>;
export declare function callReviewer(reviewer: ReviewerEndpointConfig, prompt: ReviewerPrompt, signal?: AbortSignal): Promise<string>;
/**
 * System One reviewer transport: ONE decision call answers two parallel
 * choice questions against one state. Defaults target SiliconFlow's
 * `/v1/systemone` (Alpha); TypeSafe Jev speaks the same request shape, so
 * switching backends only changes baseURL + model + key.
 */
export declare const DEFAULT_SYSTEMONE_BASE_URL = "https://api.siliconflow.cn/v1";
/** Provisional default; the real-machine smoke test decides whether this is the right pick. */
export declare const DEFAULT_SYSTEMONE_MODEL = "Kev-4b";
/**
 * The two guardian questions. The full policy text rides in state.policy
 * (the same system text the chat path sends); the questions reference it.
 */
export declare const SYSTEMONE_QUESTIONS: Record<string, {
    type: 'choice';
    instructions: string;
    criteria: Record<string, string>;
}>;
export interface SystemoneChoiceAnswer {
    choice?: string;
    probabilities?: Record<string, number>;
    confidence?: number;
}
/**
 * One System One call (POST {base}/systemone). The typed answers are
 * synthesized into the same verdict JSON the chat path would produce, then
 * go through the exact same strict parser — so critical-risk normalization
 * (critical can never allow) applies identically, and a malformed answer
 * fails closed exactly like a chat reviewer would.
 */
export declare function callSystemoneReviewer(reviewer: ReviewerEndpointConfig, prompt: ReviewerPrompt, signal?: AbortSignal): Promise<string>;
export interface SessionModelLlmRuntime {
    stream(options: {
        provider: string;
        model: string;
        messages: unknown[];
        system?: string;
        maxTokens?: number;
        reasoningEffort?: string;
        signal?: AbortSignal;
    }): AsyncIterable<StreamChunk>;
}
export interface SessionModelReviewerCtx {
    get(name: string): unknown;
}
/**
 * Review with the calling session's current model: the harness's own LLM
 * runtime, routed to the exact provider/model the agent uses. Credentials
 * come from the harness (credentials seam / provider env), not from this
 * plugin. Used when no explicit reviewer endpoint is configured.
 */
export declare function reviewWithSessionModel(ctx: SessionModelReviewerCtx, agent: Agent | undefined, reviewer: {
    timeoutMs?: number;
    maxTokens?: number;
    thinking?: 'default' | 'off';
}, prompt: ReviewerPrompt, signal?: AbortSignal): Promise<string>;
export declare function buildPrompt(req: Pick<ApprovalRequest, 'toolName' | 'reason'>, toolCall: ToolCallRecord | null, facts: {
    workspaceRoot?: string;
    sandboxMode?: string;
}, evidence: Evidence, override?: PostDenialApproval | null, factObservations?: readonly FactObservation[]): ReviewerPrompt;
