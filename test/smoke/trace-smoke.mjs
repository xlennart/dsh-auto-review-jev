// Drives the BUILT lib's `approval/request` answerer with the user's real
// profile row config and asserts the diagnostic trace records every stage —
// including the config-stage throw that used to leave no evidence at all.
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Scratch sinks beside this suite — never the real audit/trace files.
const scratch = (name) => fileURLToPath(new URL(name, import.meta.url))
const traceFile = scratch('./trace-test.jsonl')
const auditFile = scratch('./audit-test.jsonl')
process.env.DSH_AUTO_REVIEW_TRACE_PATH = traceFile
rmSync(traceFile, { force: true })
rmSync(auditFile, { force: true })

const mod = await import('../../lib/index.js')

const results = []
const assert = (label, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'ok  ' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`)
}
const wait = () => new Promise((resolve) => setTimeout(resolve, 200))
const readLines = () => (existsSync(traceFile) ? readFileSync(traceFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
const readAudit = () => (existsSync(auditFile) ? readFileSync(auditFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])

// Verbatim from ~/.dsh/profiles/web/cordis.patch.yml (id: auto-review), except
// the audit sink, which is redirected so the real audit file stays untouched.
const rowConfig = {
  enabled: true,
  reviewer: {
    protocol: 'systemone',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'Kev-4b',
    apiKeyFile: '~/.dsh/reviewer.env',
    timeoutMs: 30000,
    systemone: { confidenceThreshold: 0.6 },
  },
  policy: { denyOnReviewerError: true },
  breaker: { enabled: true },
  audit: { enabled: true, path: auditFile },
}

async function mount(config) {
  const handlers = []
  const ctx = {
    logger: () => ({ warn: () => undefined, error: () => undefined }),
    get: (n) => (n === 'commands' ? { register: () => undefined } : undefined),
    on: (event, handler, prepend) => { handlers.push({ event, handler, prepend }); return () => undefined },
  }
  mod.apply(ctx, config)
  return handlers.find((h) => h.event === 'approval/request')
}

// ---- boot line -------------------------------------------------------------
const reg = await mount(rowConfig)
await wait()
const boot = readLines().find((l) => l.phase === 'boot')
assert('answerer registered on approval/request', reg !== undefined)
assert('registration is PREPENDED (decides before the interactive answerer)', reg?.prepend === true)
assert('boot line records the loaded build and its resolved config',
  boot !== undefined && boot.reviewer === 'systemone' && boot.model === 'Kev-4b'
  && boot.endpoint === 'https://api.siliconflow.cn/v1' && boot.enabled === true,
  JSON.stringify(boot))

const handler = reg.handler
const next = async () => 'unavailable'

// ---- A: disabled -> deliberate hand-off ------------------------------------
const disabled = await mount({ ...rowConfig, enabled: false })
await wait()
await disabled.handler({ toolName: 'pwsh', agent: { id: 's' } }, next)
await wait()
let lines = readLines().slice(-3)
assert('disabled config is traced as a hand-off, not silence',
  lines[0]?.phase === 'enter' && lines[1]?.phase === 'skip' && lines[1]?.why === 'disabled',
  JSON.stringify(lines.map((l) => [l.phase, l.why ?? l.outcome])))

// ---- B: no callId -> hand-off to the human, by design ----------------------
const before = readLines().length
await handler({ toolName: 'pwsh', toolName2: undefined, agent: { id: 's' } }, next)
await wait()
lines = readLines().slice(before)
assert('an ask without a callId is traced as delegated to the human',
  lines.some((l) => l.phase === 'enter') && lines.some((l) => l.phase === 'skip' && l.why === 'no-callId')
  && lines.some((l) => l.phase === 'exit' && l.outcome === 'unavailable'),
  JSON.stringify(lines.map((l) => [l.phase, l.why ?? l.outcome])))

// ---- C: unresolvable tool call -> handed to the human + audited ------------
// The guardian refuses only what it actually judged: a request whose exact call
// the session log cannot resolve is NOT a host-side denial (that left a live
// session stuck on 2026-09-30).
const beforeC = readLines().length
const outcomeC = await handler({ toolName: 'pwsh', callId: 'call-1', agent: { id: 'sess-c' } }, next)
await wait()
lines = readLines().slice(beforeC)
assert('an unresolvable callId is handed to the human, not denied',
  outcomeC === 'unavailable' && lines.some((l) => l.phase === 'skip' && l.why === 'no-tool-call'),
  `outcome=${outcomeC} ${JSON.stringify(lines.map((l) => [l.phase, l.why ?? l.outcome]))}`)
assert('the deferral also lands in the audit file',
  readAudit().some((a) => a.decision === 'defer' && a.source === 'no-tool-call'),
  JSON.stringify(readAudit().map((a) => [a.decision, a.source])))

// ---- D: a throw anywhere in the pipeline is recorded, then re-raised -------
const explosive = { id: 'sess-d' }
Object.defineProperty(explosive, 'session', { get() { throw new Error('boom-agent') } })
const beforeD = readLines().length
let threw = null
try { await handler({ toolName: 'pwsh', callId: 'call-2', agent: explosive }, next) } catch (error) { threw = error }
await wait()
lines = readLines().slice(beforeD)
assert('a pipeline throw is re-raised so the human still gets the ask',
  threw !== null && String(threw.message).includes('boom-agent'), String(threw?.message))
assert('the throw is recorded in the trace with its message and stack',
  lines.some((l) => l.phase === 'enter') && lines.some((l) => l.phase === 'error' && String(l.message).includes('boom-agent') && l.stack !== ''),
  JSON.stringify(lines.map((l) => [l.phase, l.message ?? l.outcome])))

console.log(`\ntrace-smoke: ${results.filter(Boolean).length}/${results.length} passed`)
if (results.some((ok) => !ok)) process.exitCode = 1
