import { createHash } from 'node:crypto';
import os from 'node:os';
export function sha256(text) {
    return createHash('sha256').update(String(text)).digest('hex');
}
export function expandHome(p) {
    return String(p).replace(/^~(?=$|\/)/, os.homedir());
}
/**
 * A value wrapped by a `volatile` config field. schemastery's `.volatile()`
 * builder makes the parsed field a stable reference holding immutable data
 * instead of a plain scalar; this duck-type test matches any such wrapper
 * (`{ get(): T }`) without importing cosmokit's branded `isVolatile`.
 */
function isReferenceLike(value) {
    return value !== null && typeof value === 'object'
        && typeof value.get === 'function';
}
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
export function plainConfig(value) {
    if (isReferenceLike(value))
        return plainConfig(value.get());
    if (Array.isArray(value))
        return value.map(item => plainConfig(item));
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .map(([key, child]) => [key, plainConfig(child)]));
    }
    return value;
}
