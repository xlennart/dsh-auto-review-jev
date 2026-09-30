import { type LoggerLike } from './util.ts';
/**
 * Diagnostic trace: one JSON line per stage of an approval ask.
 *
 * It exists because the audit file can only report *decisions* — an ask that
 * dies in the config stage leaves no line at all, which is indistinguishable
 * from "the plugin was never consulted". The trace is written to a FIXED path,
 * so the sink itself never depends on the config whose read may be the very
 * thing that fails, and `enter` is emitted before `cfg()`, so a crash still
 * leaves evidence that the ask arrived.
 *
 * Silence it with `DSH_AUTO_REVIEW_TRACE=0`.
 */
export declare const TRACE_PATH = "~/.dsh/auto-review-trace.jsonl";
/**
 * Resolve the trace file: the fixed default, overridable per process so tests
 * and second instances never write into the file a human is reading.
 * @returns The absolute trace path.
 */
export declare function tracePath(): string;
/** The facts known about an ask before any configuration is read. */
export interface TraceAsk {
    toolName: string;
    callId: string | null;
    session: string | null;
    reason: string;
    aborted: boolean;
}
export interface Tracer {
    /** Append one free-form phase line. */
    line(phase: string, fields?: Record<string, unknown>): void;
    /** Record that an ask reached the answerer (before the config stage). */
    enter(ask: TraceAsk): void;
    /** Record a deliberate hand-off to the next answerer. */
    skip(why: string, fields?: Record<string, unknown>): void;
    /** Record the outcome this answerer returned. */
    exit(outcome: string, durationMs: number): void;
    /** Record a throw, so a broken stage is never silent. */
    error(error: unknown, where: string): void;
}
/**
 * Build the trace sink.
 * @param deps - the plugin logger, used once if the file itself cannot be written.
 * @returns The tracer; writes are serialized and never reject.
 */
export declare function createTracer(deps: {
    log: LoggerLike;
}): Tracer;
