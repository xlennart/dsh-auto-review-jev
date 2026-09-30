import { createHash } from 'node:crypto'
import os from 'node:os'

export function sha256(text: string): string {
  return createHash('sha256').update(String(text)).digest('hex')
}

export function expandHome(p: string): string {
  return String(p).replace(/^~(?=$|\/)/, os.homedir())
}

/**
 * A value wrapped by a `volatile` config field. schemastery's `.volatile()`
 * builder makes the parsed field a stable reference holding immutable data
 * instead of a plain scalar; this duck-type test matches any such wrapper
 * (`{ get(): T }`) without importing cosmokit's branded `isVolatile`.
 */
function isReferenceLike(value: unknown): value is { get(): unknown } {
  return value !== null && typeof value === 'object'
    && typeof (value as { get?: unknown }).get === 'function'
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
export function plainConfig<T, U>(value: T): U {
  if (isReferenceLike(value)) return plainConfig(value.get())
  if (Array.isArray(value)) return value.map(item => plainConfig(item)) as unknown as U
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => [key, plainConfig(child)])) as unknown as U
  }
  return value as unknown as U
}

export interface LoggerLike {
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

/**
 * The structural context surface the plugin actually touches: logging,
 * service lookup, and the event bus. The full cordis Context satisfies this;
 * tests can pass minimal mocks without casts.
 */
export interface PluginContext {
  logger(name: string): LoggerLike
  get?(name: string): unknown
  on(event: string, listener: unknown, prepend?: boolean): unknown
}
