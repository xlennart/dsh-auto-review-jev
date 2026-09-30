export declare function sha256(text: string): string;
export declare function expandHome(p: string): string;
/**
 * Detach volatile config references from a parsed configuration snapshot,
 * yielding plain JSON-shaped values.
 *
 * Plugin schema fields marked `.volatile()` (so the Web Settings form can
 * edit them live, per the Host's config-schema projection) parse to a
 * `Volatile` wrapper rather than a raw value. Configuration consumed by this
 * plugin's approval pipeline must see plain values, so every read path runs
 * the snapshot through this fold first: settings scopes / resolveConfig that
 * already produce plain values pass through unchanged.
 */
export declare function plainConfig<T, U>(value: T): U;
export interface LoggerLike {
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
/**
 * The structural context surface the plugin actually touches: logging,
 * service lookup, and the event bus. The full cordis Context satisfies this;
 * tests can pass minimal mocks without casts.
 */
export interface PluginContext {
    logger(name: string): LoggerLike;
    get?(name: string): unknown;
    on(event: string, listener: unknown, prepend?: boolean): unknown;
}
