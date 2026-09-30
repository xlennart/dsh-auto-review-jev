// Regression for the 2026-10-01 wedge: the denial notice was injected with the
// RETIRED v3 source wrapper `{kind:'plugin', plugin:NS}`. DSH's v4 session
// format refuses that row at adoption time
// (packages/session/session-format-v3-to-v4/src/message-sources.ts:
//  "format v4 message requires a producer-owned source kind"), so a single
// denial broke the session instead of merely adding a notice. The previous
// suites could not catch it because their stub agents had no inject() at all.
import assert from 'node:assert/strict'
import http from 'node:http'
import { writeFileSync } from 'node:fs'

const lib = await import('../../lib/index.js')

/** The harness admission rule, verbatim from message-sources.ts `source()`. */
const admitsAsV4Source = (source) => typeof source === 'object' && source !== null
  && typeof source.kind === 'string' && source.kind.length > 0 && source.kind !== 'plugin'

let currentRisk = 'high'
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      model: 'stub-echo',
      answers: {
        decision: { choice: 'deny', confidence: 1, probabilities: { allow: 0 } },
        risk: { choice: currentRisk, confidence: 0.9, probabilities: { critical: currentRisk === 'critical' ? 1 : 0 } },
      },
      usage: {},
    }))
  })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const baseURL = 'http://127.0.0.1:' + server.address().port + '/v1'

const cfg = lib.plainConfig(lib.Config({
  enabled: true,
  reviewer: { protocol: 'systemone', baseURL, model: 'laya-local', timeoutMs: 10000, systemone: { confidenceThreshold: 0.5 } },
  policy: { denyOnReviewerError: false, onLowConfidence: 'defer' },
}))

const events = (callId) => ([
  { type: 'user/message', seq: 1, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '请只读地看一下这个目录' }] } },
  { type: 'tool/call', seq: 2, data: { turn: 1, step: 1, callId, name: 'pwsh', arguments: JSON.stringify({ command: 'Remove-Item -Recurse -Force C:\\Windows\\Temp\\*' }) } },
])

async function run(risk) {
  currentRisk = risk
  const injected = []
  const audit = []
  const answerer = lib.createAnswerer({
    ctx: {}, getService: () => undefined, cfg: () => cfg,
    log: { warn() {}, info() {}, error() {}, debug() {} },
    breaker: { note() {}, reason: () => undefined, reset() {} },
    auditor: { record: async (_r, _a, _s, entry) => { audit.push(entry) } },
    ledger: { consume: () => undefined, record() {} },
    tracer: { line() {}, enter() {}, exit() {}, error() {}, skip() {} },
  })
  const session = { header: { id: 's-inject', cwd: 'E:\\ws' }, snapshotEvents: () => events('call_inj') }
  const agent = { id: 'agent-inject', session, inject: (message) => { injected.push(message) } }
  const outcome = await answerer({ agent, toolName: 'pwsh', callId: 'call_inj|aaaa', reason: 'clean temporary files' }, async () => 'allowed-once')
  return { outcome, injected, audit }
}

const out = []
let failures = 0
const check = (label, condition, detail) => {
  if (!condition) failures += 1
  out.push((condition ? 'PASS  ' : 'FAIL  ') + label + (detail === undefined ? '' : ' :: ' + detail))
}

out.push('sourceKind = ' + JSON.stringify(lib.sourceKind))
check('the plugin declares a producer-owned kind', admitsAsV4Source({ kind: lib.sourceKind }), String(lib.sourceKind))

const high = await run('high')
check('a high-risk denial injects exactly one notice', high.injected.length === 1, String(high.injected.length) + ' injected')
if (high.injected.length > 0) {
  const message = high.injected[0]
  const source = message?.source
  out.push('  injected source = ' + JSON.stringify(source))
  check('the injected source is admitted by the v4 rule', admitsAsV4Source(source), JSON.stringify(source))
  check('the injected source is not the retired plugin wrapper', source?.kind !== 'plugin', String(source?.kind))
  check('the injected source drops the retired plugin field', source?.plugin === undefined, JSON.stringify(source))
  check('the notice still carries its form/summary', source?.form === 'notice' && typeof source?.summary === 'string', JSON.stringify(source))
  check('the notice body is the fixed constant', Array.isArray(message?.content) && message.content[0]?.type === 'text', JSON.stringify(message?.content))
}

const low = await run('low')
check('a low-risk denial still injects nothing', low.injected.length === 0, String(low.injected.length) + ' injected')

server.close()
out.push('')
out.push(failures === 0 ? 'inject-source smoke: all checks passed' : 'inject-source smoke: ' + failures + ' check(s) FAILED')
writeFileSync(new URL('./inject-source-smoke.txt', import.meta.url), out.join('\n'), 'utf8')
console.log(failures === 0 ? 'inject-source smoke passed' : 'inject-source smoke FAILED (' + failures + ')')
assert.equal(failures, 0)
