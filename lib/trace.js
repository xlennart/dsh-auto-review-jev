import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { NS } from "./meta.js";
import { expandHome } from "./util.js";
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
export const TRACE_PATH = '~/.dsh/auto-review-trace.jsonl';
/**
 * Resolve the trace file: the fixed default, overridable per process so tests
 * and second instances never write into the file a human is reading.
 * @returns The absolute trace path.
 */
export function tracePath() {
    const override = process.env.DSH_AUTO_REVIEW_TRACE_PATH;
    return expandHome(override === undefined || override === '' ? TRACE_PATH : override);
}
/**
 * Build the trace sink.
 * @param deps - the plugin logger, used once if the file itself cannot be written.
 * @returns The tracer; writes are serialized and never reject.
 */
export function createTracer(deps) {
    const { log } = deps;
    const disabled = process.env.DSH_AUTO_REVIEW_TRACE === '0';
    const file = tracePath();
    let queue = Promise.resolve();
    let warned = false;
    const line = (phase, fields = {}) => {
        if (disabled)
            return;
        const record = { timestamp: new Date().toISOString(), plugin: NS, phase, ...fields };
        queue = queue.then(async () => {
            try {
                await mkdir(path.dirname(file), { recursive: true });
                await appendFile(file, JSON.stringify(record) + '\n', 'utf8');
            }
            catch (error) {
                if (warned)
                    return;
                warned = true;
                log.warn('trace write failed: %s (path=%s)', String(error?.message ?? error), file);
            }
        });
    };
    return {
        line,
        enter: ask => line('enter', { ...ask }),
        skip: (why, fields) => line('skip', { why, ...fields }),
        exit: (outcome, durationMs) => line('exit', { outcome, durationMs: Math.round(durationMs) }),
        error: (error, where) => line('error', {
            where,
            message: String(error?.message ?? error),
            stack: String(error?.stack ?? '').split('\n').slice(0, 6).join(' | '),
        }),
    };
}
