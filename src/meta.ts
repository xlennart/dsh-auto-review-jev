/** Plugin identity, shared by every module without importing the entry point. */
import type { MessageSource } from '@deepseek-ai/dsh-llm'

export const name = 'auto-review'
export const NS = 'dsh-auto-review'
/** The command registry must exist before apply: the loader mounts rows concurrently. */
export const inject = ['commands']

/**
 * Producer-owned source kind for messages this plugin injects.
 *
 * `'plugin'` is the RETIRED v3 wrapper: DSH's v4 session format refuses a row
 * that carries it — `packages/session/session-format-v3-to-v4/src/message-sources.ts`
 * throws `format v4 message requires a producer-owned source kind` when the row
 * is adopted, which BREAKS THE SESSION rather than merely dropping the notice.
 * A third-party plugin's producer kind is `plugin:<package name>`; that is
 * exactly what the harness migrator lifts `{kind:'plugin', plugin:'<name>'}` to
 * (`producerKind` in `session-format-v3-to-v4/src/sources.ts`), so migrated rows
 * and newly injected ones agree.
 */
export const sourceKind = `plugin:${NS}`

/**
 * Producer stamp for context this plugin injects into a session.
 *
 * The harness's `MessageSourceMap` is a merge-extensible sum type in which
 * every producer declares its own `kind`, and it deliberately has no shared
 * catch-all `plugin` kind. Message construction validates nothing at runtime
 * (`createMessage` only clones and freezes), so the stamp keeps this plugin's
 * upstream producer identity byte-for-byte and is narrowed to the harness's
 * own source type here — rather than registering a global declaration
 * augmentation, which would collide with a harness that already declares the
 * same kind.
 */
export function injectSource<T extends { kind: string }>(source: T): MessageSource {
  return source as unknown as MessageSource
}
