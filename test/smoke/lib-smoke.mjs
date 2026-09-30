// Runtime smoke check for the BUILT lib/ artifacts (not src).
// Verifies the pieces the stale lib was missing: plainConfig, its use on the
// volatile config snapshot, and the .volatile() markers behind the Web form.
import assert from 'node:assert/strict'

const lib = await import('../../lib/index.js')

const checks = []
const ok = (label) => checks.push(label)

// 1. public surface
for (const name of ['apply', 'Config', 'plainConfig', 'parseVerdict', 'validateConfig',
  'DEFAULT_SYSTEMONE_BASE_URL', 'DEFAULT_SYSTEMONE_MODEL', 'callSystemoneReviewer']) {
  assert.equal(typeof lib[name] !== 'undefined', true, `missing export: ${name}`)
}
assert.equal(lib.name, 'auto-review')
assert.equal(lib.NS, 'dsh-auto-review')
ok('exports present (apply/Config/plainConfig/systemone)')

// 2. plainConfig folds volatile wrappers, arrays and nested objects
const folded = lib.plainConfig({
  a: { get: () => 1 },
  b: [1, { get: () => 2 }, { deep: { get: () => 3 } }],
  c: 'plain',
  d: null,
})
assert.deepEqual(folded, { a: 1, b: [1, 2, { deep: 3 }], c: 'plain', d: null })
ok('plainConfig detaches volatile wrappers at any depth')

// 3. the schema really does emit volatile wrappers (the Web-settings form),
//    and plainConfig turns them into plain config the pipeline can consume
const parsed = lib.Config({})
assert.equal(typeof parsed.enabled?.get, 'function', 'enabled is not volatile-wrapped: Web form would not render')
assert.equal(typeof parsed.reviewer?.get, 'function', 'reviewer section is not volatile-wrapped')

const plain = lib.plainConfig(parsed)
assert.equal(plain.enabled, true)
assert.equal(plain.reviewer.protocol, 'chat')
assert.equal(plain.reviewer.systemone.confidenceThreshold, 0.6)
assert.equal(plain.reviewer.timeoutMs, 24000)
assert.equal(plain.policy.denyOnReviewerError, true)
assert.equal(plain.breaker.consecutiveDenyLimit, 3)
assert.equal(plain.audit.path, '~/.dsh/auto-review-audit.jsonl')
assert.equal(typeof plain.reviewer.systemone.confidenceThreshold, 'number', 'volatile leaked into pipeline config')
ok('Config parses; plainConfig yields a plain defaults-resolved config')

// 4. the systemone branch is really compiled into lib/reviewer.js
assert.equal(lib.DEFAULT_SYSTEMONE_BASE_URL, 'https://api.siliconflow.cn/v1')
assert.equal(lib.DEFAULT_SYSTEMONE_MODEL, 'Kev-4b')
assert.equal(lib.parseVerdict(JSON.stringify({ decision: 'allow', risk: 'critical', reason: 'x' })).decision, 'deny')
ok('systemone defaults + critical-risk normalization live in lib')

// 5. settings registration path must accept the plain config unchanged
const rejected = lib.validateConfig(plain)
assert.equal(rejected, null, `validateConfig rejected the resolved config: ${rejected}`)
const bad = lib.validateConfig({ ...plain, reviewer: { ...plain.reviewer, protocol: 'systemone', baseURL: '', systemone: { confidenceThreshold: 0.2 } } })
assert.ok(typeof bad === 'string', 'out-of-range confidenceThreshold was not refused')
ok('validateConfig accepts defaults and refuses an out-of-range threshold')

// 6. the arm path: what `apply` actually receives for a settings-editable entry
//    is a VOLATILE tree (one wrapper per `.volatile()` section), so the fold has
//    to run BEFORE the schema validates it. Getting that order wrong silently
//    disabled the guardian: the schema saw `{}` where a boolean belongs, refused
//    to arm, and every read fell back to enabled:false while the Settings page
//    kept showing the configured values.
const W = (value) => ({ get: () => value })
const volatileEntry = {
  enabled: W(true),
  reviewer: W({
    protocol: 'systemone',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'Kev-4b',
    systemone: W({ confidenceThreshold: 0.6 }),
  }),
  policy: W({ denyOnReviewerError: true }),
  breaker: W({ enabled: true }),
  audit: W({ enabled: true }),
}
assert.throws(() => lib.Config(volatileEntry), /boolean|object/i,
  'a volatile tree must not silently parse: the regression would go unnoticed')
const armed = lib.plainConfig(lib.Config(lib.plainConfig(volatileEntry)))
assert.equal(armed.enabled, true)
assert.equal(armed.reviewer.protocol, 'systemone')
assert.equal(armed.reviewer.baseURL, 'https://api.siliconflow.cn/v1')
assert.equal(armed.reviewer.model, 'Kev-4b')
assert.equal(armed.reviewer.systemone.confidenceThreshold, 0.6)
assert.equal(armed.breaker.enabled, true)
assert.equal(armed.reviewer.timeoutMs > 0, true, 'defaults were not resolved alongside the configured values')
assert.equal(lib.validateConfig(armed), null)
ok('a volatile entry config arms only when the fold runs before validation')

// 7. live session access. DSH 0.2 exposes the event log through
//    `snapshotEvents()` and the cwd through `header.cwd`; an older shape
//    exposed `session.events` / `session.cwd`. Reading the wrong member returns
//    an EMPTY list instead of throwing, which silently turned the running
//    guardian into a deny-all: every ask reported `source: no-tool-call` and
//    was denied (live incident 2026-09-30).
const evidence = await import('../../lib/evidence.js')
const logged = [{
  type: 'tool/call',
  data: { turn: 1, step: 1, callId: 'call_00_abc', name: 'pwsh', arguments: '{"command":"Get-Process node"}' },
}]
const dsh02 = { header: { id: 'session-1', cwd: 'E:\\ws' }, snapshotEvents: () => logged }
assert.deepEqual(evidence.sessionEvents(dsh02), logged, 'snapshotEvents() was not read')
assert.equal(evidence.sessionCwd(dsh02), 'E:\\ws', 'header.cwd was not read')
assert.deepEqual(evidence.sessionEvents({ events: logged }), logged, 'the legacy `events` shape must still read')
assert.equal(evidence.sessionCwd({ cwd: 'E:\\legacy' }), 'E:\\legacy')
assert.deepEqual(evidence.sessionEvents({}), [], 'an unknown session shape must read as empty, never throw')
assert.equal(evidence.sessionCwd({}), '')
ok('session access reads snapshotEvents()/header.cwd (plus the legacy shape)')

// 8. an approval ask carries an execution-scoped `<callId>|<uuid>` while the
//    session logs the call under the model's own id, so resolution must compare
//    id bases — a strict equality here resolved nothing.
const expectedCall = { name: 'pwsh', arguments: '{"command":"Get-Process node"}' }
assert.deepEqual(evidence.findToolCall(logged, 'call_00_abc|7f3a-4c1d'), expectedCall, 'composite ask id did not resolve')
assert.deepEqual(evidence.findToolCall(logged, 'call_00_abc'), expectedCall)
assert.equal(evidence.findToolCall(logged, 'call_00_other|7f3a'), null, 'a different call must not resolve')
assert.equal(evidence.findToolCall(logged, ''), null)
assert.equal(evidence.findToolCall([], 'call_00_abc'), null)
assert.match(evidence.recentCallIds(logged), /pwsh:call_00_abc/)
ok('findToolCall resolves the ask\'s composite callId against the logged id')

// 9. The B/C policy surface ships strict: an unsure reviewer still denies by
//    default, and a no-review rule still cannot hand out an unsandboxed run.
const policyDefaults = lib.plainConfig(lib.Config({}))
assert.equal(policyDefaults.policy.onLowConfidence, 'deny', 'low confidence must default to the historical fail-closed deny')
assert.equal(policyDefaults.policy.allowDangerFullAccessRules, false, 'danger-full-access rules must be opt-in')
assert.equal(lib.plainConfig(lib.Config({ policy: { onLowConfidence: 'defer' } })).policy.onLowConfidence, 'defer')
assert.equal(lib.validateConfig(policyDefaults), null)
assert.ok(String(lib.validateConfig({ ...policyDefaults, policy: { ...policyDefaults.policy, onLowConfidence: 'maybe' } }))
  .includes('onLowConfidence'))
ok('the low-confidence mode and the danger-full-access opt-in default to the strict values')

// 10. The low-confidence marker is a boolean and nothing else: a model that
//     writes prose (or the string "true") can never fabricate it, and the
//     critical-risk invariant keeps applying regardless.
const marked = lib.parseVerdict(JSON.stringify({ decision: 'deny', risk: 'low', reason: 'x', low_confidence: true }))
assert.equal(marked.lowConfidence, true)
assert.equal(marked.decision, 'deny')
assert.equal(lib.parseVerdict(JSON.stringify({ decision: 'deny', risk: 'low', reason: 'x' })).lowConfidence, undefined)
assert.equal(lib.parseVerdict(JSON.stringify({ decision: 'deny', risk: 'low', reason: 'x', low_confidence: 'true' })).lowConfidence, undefined)
assert.equal(lib.parseVerdict(JSON.stringify({ decision: 'allow', risk: 'critical', reason: 'x', low_confidence: true })).decision, 'deny')
ok('only an explicit boolean marks a verdict low-confidence')

// 11. A keyless reviewer endpoint is tolerable ONLY on loopback, and the check
//     parses the URL: credentials in the authority must not disguise a remote
//     host (the classic `http://127.0.0.1@evil.example/` trick).
assert.equal(lib.isLoopbackEndpoint('http://127.0.0.1:8000/v1'), true)
assert.equal(lib.isLoopbackEndpoint('http://localhost:11434/v1'), true)
assert.equal(lib.isLoopbackEndpoint('http://[::1]:8000/v1'), true)
assert.equal(lib.isLoopbackEndpoint('http://127.9.9.9/v1'), true)
assert.equal(lib.isLoopbackEndpoint('http://127.0.0.1@evil.example/v1'), false, 'userinfo disguised a remote host')
assert.equal(lib.isLoopbackEndpoint('https://api.typesafe.ai/v1'), false)
assert.equal(lib.isLoopbackEndpoint('http://0.0.0.0:8000/v1'), false)
assert.equal(lib.isLoopbackEndpoint(''), false)
assert.equal(lib.isLoopbackEndpoint(undefined), false)
assert.equal(lib.isLoopbackEndpoint('not a url'), false)
ok('only a genuine loopback endpoint counts as keyless-capable')

// 12. The optional request budget defaults to "not sent" and is range-checked.
assert.equal(policyDefaults.reviewer.systemone.maxLen, 0, 'the budget must default to inherit')
assert.equal(lib.plainConfig(lib.Config({ reviewer: { systemone: { maxLen: 8192 } } })).reviewer.systemone.maxLen, 8192)
assert.ok(String(lib.validateConfig({
  ...policyDefaults,
  reviewer: {
    ...policyDefaults.reviewer,
    protocol: 'systemone',
    systemone: { ...policyDefaults.reviewer.systemone, maxLen: 300000 },
  },
})).includes('maxLen'))
ok('the optional max_len budget defaults to unset and is range-checked')

console.log(checks.map((c) => `  ok - ${c}`).join('\n'))
console.log(`\n${checks.length} lib checks passed`)
