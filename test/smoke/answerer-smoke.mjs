// Behaviour checks for the approval answerer against the LIVE session shape.
// Regression for the 2026-09-30 incident: the answerer read `session.events`
// (absent in DSH 0.2, which exposes `snapshotEvents()`) and `session.cwd`
// (actually `header.cwd`), so every ask looked unresolvable, the guardian
// denied all of them host-side, and one denial left the Web session stuck.
// Deliberately network-free: the allow-rule path returns before any reviewer.
import assert from 'node:assert/strict'

const lib = await import('../../lib/index.js')

const checks = []
const ok = (label) => checks.push(label)

const baseCfg = lib.plainConfig(lib.Config({}))
const cfgWith = (patch) => ({ ...baseCfg, enabled: true, ...patch })

const loggedCall = (callId) => [{
  type: 'tool/call',
  data: { turn: 1, step: 1, callId, name: 'pwsh', arguments: JSON.stringify({ command: 'Get-Process node' }) },
}]

function harness({ session, cfg }) {
  const audit = []
  const trace = []
  const answerer = lib.createAnswerer({
    ctx: {},
    getService: () => undefined,
    cfg: () => cfg,
    log: { warn() {}, info() {}, error() {}, debug() {} },
    breaker: { note() {}, reason: () => undefined, reset() {} },
    auditor: { record: async (_req, _agent, _session, entry) => { audit.push(entry) } },
    ledger: { consume: () => undefined, record() {} },
    tracer: {
      line: (...a) => trace.push(['line', ...a]),
      enter: (...a) => trace.push(['enter', ...a]),
      exit: (...a) => trace.push(['exit', ...a]),
      skip: (...a) => trace.push(['skip', ...a]),
      error: (...a) => trace.push(['error', ...a]),
    },
  })
  const agent = { id: 'agent-1', session }
  const ask = (callId) => ({ agent, toolName: 'pwsh', callId, reason: 'escalate sandbox to workspace-write: test' })
  return { answerer, audit, trace, ask }
}

// 1. An unresolvable ask is handed to the human: the guardian only refuses what
//    it actually judged, and a host-side refusal the client never showed has
//    left a live session stuck.
{
  const { answerer, audit, trace, ask } = harness({
    session: { header: { id: 's1', cwd: 'E:\\ws' }, snapshotEvents: () => loggedCall('call_00_other') },
    cfg: cfgWith({}),
  })
  const outcome = await answerer(ask('call_00_abc|7f3a-4c1d'), async () => 'allowed-once')
  assert.equal(outcome, 'allowed-once', 'an unresolvable ask must fall through, never be denied host-side')
  assert.equal(audit.length, 1, 'the deferred ask must be audited')
  assert.equal(audit[0].decision, 'defer')
  assert.equal(audit[0].source, 'no-tool-call')
  assert.equal(audit[0].workspaceRoot, 'E:\\ws', 'header.cwd must reach the audit entry')
  assert.ok(trace.some((entry) => entry[0] === 'skip' && entry[1] === 'no-tool-call'), 'the skip must be traced')
  ok('an unresolvable ask defers to the human instead of denying')
}

// 2. The same ask resolves through `snapshotEvents()` + a composite callId, so
//    it reaches the allow-rule path (proving the tool call was really seen)
//    instead of being deferred.
{
  const { answerer, audit, trace, ask } = harness({
    session: { header: { id: 's2', cwd: 'E:\\ws' }, snapshotEvents: () => loggedCall('call_00_abc') },
    cfg: cfgWith({ policy: { ...baseCfg.policy, allowRules: [{ tool: 'pwsh', operations: ['Get-Process'], escalationTarget: '' }] } }),
  })
  const outcome = await answerer(ask('call_00_abc|7f3a-4c1d'), async () => 'rejected')
  assert.equal(outcome, 'allowed-once', 'the resolved ask did not reach the allow rule')
  assert.equal(audit.length, 1)
  assert.equal(audit[0].decision, 'allow')
  assert.equal(audit[0].source, 'allow-rule')
  assert.ok(!trace.some((entry) => entry[1] === 'no-tool-call'), 'a resolvable ask must not be deferred')
  ok('a composite callId resolves against the live snapshotEvents() log')
}

// 3. The legacy `events`/`cwd` session shape still works (older DSH / tests).
{
  const { answerer, audit } = harness({
    session: { id: 's3', cwd: 'E:\\legacy', events: loggedCall('call_00_abc') },
    cfg: cfgWith({ policy: { ...baseCfg.policy, allowRules: [{ tool: 'pwsh', operations: ['Get-Process'], escalationTarget: '' }] } }),
  })
  const outcome = await answerer({ agent: { id: 'agent-3', session: { id: 's3', cwd: 'E:\\legacy', events: loggedCall('call_00_abc') } }, toolName: 'pwsh', callId: 'call_00_abc|ffff', reason: 'x' }, async () => 'rejected')
  assert.equal(outcome, 'allowed-once')
  assert.equal(audit[0].source, 'allow-rule')
  ok('the legacy session shape still resolves')
}

// 4. Disabled guardian, no callId: both keep the human in charge.
{
  const { answerer, ask } = harness({
    session: { header: { id: 's4', cwd: 'E:\\ws' }, snapshotEvents: () => [] },
    cfg: cfgWith({ enabled: false }),
  })
  assert.equal(await answerer(ask('call_00_abc'), async () => 'allowed-once'), 'allowed-once')
  ok('a disabled guardian stays out of the way')

  const on = harness({ session: { header: { id: 's5', cwd: 'E:\\ws' }, snapshotEvents: () => [] }, cfg: cfgWith({}) })
  assert.equal(await on.answerer({ agent: { id: 'a', session: { header: { id: 's5' }, snapshotEvents: () => [] } }, toolName: 'pwsh' }, async () => 'allowed-once'), 'allowed-once')
  ok('an ask without a callId goes to the human')
}

// 6. policy.onLowConfidence. A deny that exists only because the transport
//    could not trust its own answer is NOT a judgment about the action: with
//    'defer' the human decides, with 'deny' it stays a refusal. Both paths run
//    the real chain (session log -> systemone transport -> verdict) against a
//    local stub endpoint, so no external network is involved.
const { createServer } = await import('node:http')
function stubReviewer(answers) {
  const calls = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let parsed = null
      try { parsed = JSON.parse(body) } catch { /* recorded as null */ }
      calls.push({ headers: req.headers, body: parsed })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ model: 'jev-stub', answers }))
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: 'http://127.0.0.1:' + server.address().port,
    calls,
    close: () => new Promise((done) => server.close(done)),
  })))
}
const LOW_CONFIDENCE = {
  decision: { choice: 'allow', confidence: 0.016, probabilities: { allow: 0.508, deny: 0.492 } },
  risk: { choice: 'low', confidence: 0.38 },
}
const CONFIDENT_DENY = {
  decision: { choice: 'deny', confidence: 0.97, probabilities: { allow: 0.02, deny: 0.98 } },
  risk: { choice: 'high', confidence: 0.9 },
}
const liveSession = { header: { id: 's-live', cwd: 'E:\\ws' }, snapshotEvents: () => loggedCall('call_00_abc') }
const liveCfg = (url, onLowConfidence) => cfgWith({
  reviewer: {
    ...baseCfg.reviewer,
    protocol: 'systemone',
    baseURL: url,
    model: 'jev-latest',
    // The transport refuses to run without a key even against a local stub
    // (that refusal is itself correct: an unauthenticated review must fail
    // closed). The stub never checks it.
    apiKey: 'sk-stub-never-sent-anywhere',
    systemone: { confidenceThreshold: 0.85 },
  },
  policy: { ...baseCfg.policy, onLowConfidence },
})

{
  const stub = await stubReviewer(LOW_CONFIDENCE)
  try {
    const deferred = harness({ session: liveSession, cfg: liveCfg(stub.url, 'defer') })
    const outcome = await deferred.answerer(deferred.ask('call_00_abc|7f3a-4c1d'), async () => 'allowed-once')
    assert.equal(outcome, 'allowed-once', 'an unsure reviewer must reach the human, not refuse')
    assert.equal(deferred.audit.length, 1)
    assert.equal(deferred.audit[0].decision, 'defer')
    assert.equal(deferred.audit[0].source, 'reviewer-low-confidence')
    assert.ok(String(deferred.audit[0].reason).includes('confidence'), String(deferred.audit[0].reason))
    assert.ok(deferred.trace.some((entry) => entry[0] === 'skip' && entry[1] === 'low-confidence'))
    ok('a low-confidence verdict is handed to the human when configured')

    const refused = harness({ session: liveSession, cfg: liveCfg(stub.url, 'deny') })
    const outcome2 = await refused.answerer(refused.ask('call_00_abc|7f3a-4c1d'), async () => 'allowed-once')
    assert.equal(outcome2, 'rejected', 'the historical fail-closed deny must stay available')
    assert.equal(refused.audit[0].decision, 'deny')
    assert.equal(refused.audit[0].source, 'reviewer')
    ok('the historical fail-closed deny is preserved (onLowConfidence=deny)')
  } finally {
    await stub.close()
  }
}

{
  const stub = await stubReviewer(CONFIDENT_DENY)
  try {
    const sure = harness({ session: liveSession, cfg: liveCfg(stub.url, 'defer') })
    const outcome = await sure.answerer(sure.ask('call_00_abc|7f3a-4c1d'), async () => 'allowed-once')
    assert.equal(outcome, 'rejected', 'a denial the reviewer is sure about is never deferred')
    assert.equal(sure.audit[0].decision, 'deny')
    assert.equal(sure.audit[0].source, 'reviewer')
    assert.equal(sure.audit[0].risk, 'high')
    ok('a confident denial is never turned into a defer')
  } finally {
    await stub.close()
  }
}

// 6c. A LOOPBACK endpoint needs no key, and the optional request budget rides
//     along as max_len. Self-hosted System One servers (Laya) are commonly
//     unauthenticated and truncate the state at their own default, so both
//     behaviours are what makes a local backend usable at all.
{
  const stub = await stubReviewer(LOW_CONFIDENCE)
  try {
    const local = harness({
      session: liveSession,
      cfg: cfgWith({
        reviewer: {
          ...baseCfg.reviewer,
          protocol: 'systemone',
          baseURL: stub.url,
          model: 'laya-local',
          // No apiKey / apiKeyEnv / apiKeyFile: the keyless path under test.
          systemone: { confidenceThreshold: 0.85, maxLen: 8192 },
        },
        policy: { ...baseCfg.policy, onLowConfidence: 'defer' },
      }),
    })
    const outcome = await local.answerer(local.ask('call_00_abc|7f3a-4c1d'), async () => 'allowed-once')
    assert.equal(outcome, 'allowed-once', 'a keyless loopback endpoint must still be reviewed')
    assert.equal(stub.calls.length, 1)
    assert.equal(stub.calls[0].headers.authorization, undefined, 'no Authorization header may be invented without a key')
    assert.equal(stub.calls[0].body.model, 'laya-local')
    assert.equal(stub.calls[0].body.max_len, 8192, 'the configured max_len must be forwarded')
    assert.ok(stub.calls[0].body.state !== null && typeof stub.calls[0].body.state === 'object',
      'state must stay an object (Laya accepts object states)')
    assert.ok(stub.calls[0].body.questions?.decision !== undefined, 'the decision question must travel with the request')
    ok('a keyless loopback endpoint is reviewed and forwards the configured max_len')
  } finally {
    await stub.close()
  }
}

// 7. Allow-rule prefixes must not be extendable into a different command: a
//    rule for `Get-Process` may not authorize `Get-Process; Remove-Item ...`.
{
  const call = (command, sandbox) => ({
    name: 'pwsh',
    arguments: JSON.stringify(sandbox ? { command, sandbox_permissions: sandbox } : { command }),
  })
  const plain = [{ tool: 'pwsh', operations: ['Get-Process'], escalationTarget: '' }]
  assert.ok(lib.matchAllowRule(plain, call('Get-Process node')), 'a plain prefix match must still grant')
  assert.ok(lib.matchAllowRule(plain, call('Get-Process')), 'an exact operation must still grant')
  assert.equal(lib.matchAllowRule(plain, call('Get-Process; Remove-Item C:\\ -Recurse -Force')), null, 'a chained command must not match')
  assert.equal(lib.matchAllowRule(plain, call('Get-Process | Select-Object -First 1')), null, 'a pipeline must not match')
  assert.equal(lib.matchAllowRule(plain, call('Get-ProcessX')), null, 'the prefix must end at a boundary')
  assert.equal(lib.matchAllowRule(plain, call('Get-Process $(rm -rf /)')), null, 'substitution must not match')
  const escalation = [{ tool: 'pwsh', operations: ['docker ps'], escalationTarget: 'workspace-write' }]
  assert.ok(lib.matchAllowRule(escalation, call('docker ps', 'workspace-write')), 'a named escalation target must still match')
  assert.equal(lib.matchAllowRule(escalation, call('docker ps', 'danger-full-access')), null, 'a rule must never grant a different target')
  assert.ok(lib.matchAllowRule(escalation, call('docker ps -a', 'workspace-write')), 'flag arguments stay argument-like and must match')
  assert.equal(lib.matchAllowRule(escalation, call('docker psql', 'workspace-write')), null, 'the prefix must end at a boundary')
  ok('an allow-rule prefix cannot be extended with shell control characters')
}

// 8. Handing out danger-full-access from a no-review rule is an explicit
//    opt-in: the config is refused while the flag is off.
{
  const withRules = (rules, allow) => ({
    ...cfgWith({}),
    policy: { ...baseCfg.policy, allowRules: rules, allowDangerFullAccessRules: allow },
  })
  const danger = [{ tool: 'pwsh', operations: ['Get-Process'], escalationTarget: 'danger-full-access' }]
  assert.ok(String(lib.validateConfig(withRules(danger, false))).includes('allowDangerFullAccessRules'))
  assert.equal(lib.validateConfig(withRules(danger, true)), null)
  assert.ok(String(lib.validateConfig(withRules([{ tool: 'pwsh', operations: [], escalationTarget: 'workspace-write' }], false)))
    .includes('must pin at least one operation'))
  assert.equal(lib.validateConfig(withRules([{ tool: 'pwsh', operations: ['Get-Process'], escalationTarget: '' }], false)), null)
  ok('a danger-full-access allow rule needs the explicit opt-in')
}

console.log(checks.map((c) => `  ok - ${c}`).join('\n'))
console.log(`\n${checks.length} answerer checks passed`)
