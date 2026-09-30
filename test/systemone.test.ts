// Integration test — systemone reviewer protocol against a mock decision API.
// Runs on plain Node 24 (type stripping) and imports the TypeScript sources
// directly, so the harness packages must be resolvable from this repository
// (a DSH checkout or an installed profile next to it).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { createAnswerer, DenialLedger } from '../src/approval-answerer.ts'
import { Breaker } from '../src/breaker.ts'
import { createAuditor } from '../src/audit.ts'
import { buildPrompt, parseVerdict, DEFAULT_SYSTEMONE_BASE_URL, DEFAULT_SYSTEMONE_MODEL } from '../src/reviewer.ts'
import type { ResolvedConfig } from '../src/config.ts'

// Audit sink for this suite: a scratch file inside the repository.
const AUDIT_PATH = fileURLToPath(new URL('./scratch/test-audit.jsonl', import.meta.url))
mkdirSync(dirname(AUDIT_PATH), { recursive: true })

type Mode = 'allow-low' | 'allow-critical' | 'allow-lowconf' | 'malformed' | 'delay'
let mode: Mode = 'allow-low'
const bodies: Array<{ url: string; auth: string; body: any }> = []

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    let parsed: any = null
    try { parsed = JSON.parse(raw) } catch { /* keep null */ }
    const url = req.url ?? ''
    const auth = String(req.headers.authorization ?? '')
    if (url !== '/systemone') {
      res.writeHead(404).end('not found')
      return
    }
    // Only chat-shaped systemone requests are expected on this path.
    if (url === '/systemone' && parsed?.messages) {
      res.writeHead(400).end('chat shape sent to systemone')
      return
    }
    // The plugin must call the decision API, never a chat endpoint.
    if (auth !== 'Bearer sk-mock-never') {
      res.writeHead(401).end('unexpected api key: ' + auth)
      return
    }
    bodies.push({ url, auth, body: parsed })
    const mk = (choice: string, confidence: number, probabilities: Record<string, number>) => ({ choice, confidence, probabilities })
    const answers: Record<string, any> = {}
    if (mode === 'allow-low' || mode === 'allow-critical' || mode === 'allow-lowconf') {
      answers.decision = mk('allow', mode === 'allow-lowconf' ? 0.4 : 0.92, { allow: 0.92, deny: 0.08 })
      answers.risk = mode === 'allow-critical'
        ? mk('critical', 0.98, { low: 0.01, medium: 0.01, high: 0.0, critical: 0.98 })
        : mk('low', 0.97, { low: 0.97, medium: 0.03 })
    } else if (mode === 'malformed') {
      answers.decision = mk('allow', 0.9, { allow: 0.9, deny: 0.1 })
      // risk answer intentionally missing
    }
    const payload = { model: parsed?.model ?? DEFAULT_SYSTEMONE_MODEL, answers, usage: { inputTokens: 10, outputTokens: 0 } }
    if (mode === 'delay') {
      setTimeout(() => { res.writeHead(200).end(JSON.stringify(payload)) }, 2000)
      return
    }
    res.writeHead(200).end(JSON.stringify(payload))
  })
})

function config(overrides: Partial<ResolvedConfig['reviewer']> = {}): ResolvedConfig {
  return {
    enabled: true,
    reviewer: {
      protocol: 'systemone',
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      model: '',
      apiKey: 'sk-mock-never',
      apiKeyEnv: '',
      apiKeyFile: '',
      timeoutMs: 3000,
      maxTokens: 1024,
      thinking: 'default',
      extraSystemPrompt: '',
      factFinding: { enabled: true, maxRounds: 2, maxFacts: 3, content: { enabled: false, maxBytes: 4096 } },
      ...overrides,
    } as ResolvedConfig['reviewer'],
    policy: {
      tools: [],
      allowRules: [],
      maxInputChars: 16000,
      denyOnReviewerError: true,
      context: { enabled: true, maxMessages: 10, maxChars: 6000, rawToolResults: false },
    },
    breaker: { enabled: true, consecutiveDenyLimit: 3, windowSize: 50, windowDenyLimit: 10, action: 'cancel' },
    audit: { enabled: true, path: AUDIT_PATH, includeToolInput: false },
  } as ResolvedConfig
}

const injected: unknown[] = []
function mkDeps(c: ResolvedConfig) {
  const ledger = new DenialLedger()
  const breaker = new Breaker()
  const auditor = createAuditor({ cfg: () => c, log: { warn() {}, error() {} } })
  const ctx = {
    logger: () => ({ warn() {}, error() {} }),
    get: () => undefined,
    on: () => undefined,
  }
  return { ledger, breaker, ctx, auditor }
}

/**
 * The diagnostic trace, captured in memory. Passing it into createAnswerer is
 * mandatory: without it the wrapper's catch branch throws over the real
 * exception and hides it — the exact blindness the trace exists to remove.
 */
const traceLines: { phase: string; fields: Record<string, unknown> }[] = []
const tracer = {
  line: (phase: string, fields: Record<string, unknown> = {}) => { traceLines.push({ phase, fields }) },
  enter: (ask: Record<string, unknown>) => { traceLines.push({ phase: 'enter', fields: ask }) },
  skip: (why: string, fields: Record<string, unknown> = {}) => { traceLines.push({ phase: 'skip', fields: { why, ...fields } }) },
  exit: (outcome: string, durationMs: number) => { traceLines.push({ phase: 'exit', fields: { outcome, durationMs } }) },
  error: (error: unknown, where: string) => { traceLines.push({ phase: 'error', fields: { where, message: String((error as Error)?.message ?? error) } }) },
}

function mkAgent(events: unknown[]) {
  return {
    id: 'a1',
    options: { provider: 'deepseek-official', model: 'test-model' },
    session: { id: 's1', cwd: 'E:\\ws', events },
    inject: (m: unknown) => { injected.push(m); return Promise.resolve(true) },
  } as any
}

function events() {
  return [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'list the directory for me' }] } },
    { type: 'tool/call', data: { callId: 'c1', name: 'bash', arguments: '{"command":"dir"}' } },
  ]
}

function freshAudit() { rmSync(AUDIT_PATH, { force: true }) }

test('systemone protocol', { timeout: 30000 }, async (t) => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port

  await t.test('request shape: decision API, one call, policy in state, chat endpoint untouched', async () => {
    mode = 'allow-low'
    freshAudit()
    bodies.length = 0
    const c = config()
    const { ledger, breaker, ctx, auditor } = mkDeps(c)
    const answerer = createAnswerer({ ctx, getService: () => undefined, cfg: () => c, log: { warn() {}, error() {} }, breaker, auditor, ledger, tracer } as any)
    const agent = mkAgent(events())
    const outcome = await answerer(
      { toolName: 'bash', callId: 'c1', reason: 'read directory listing', signal: new AbortController().signal, agent } as any,
      (async () => 'ask' as any),
    )
    assert.equal(outcome, 'allowed-once')
    // exactly one decision call, on the right path, Bearer-authenticated
    assert.equal(bodies.length, 1)
    assert.equal(bodies[0].url, '/systemone')
    assert.ok(bodies[0].auth.startsWith('Bearer sk-mock'))
    const body = bodies[0].body
    assert.equal(body.model, 'Kev-4b') // default resolves when model is empty
    assert.ok(body.state.policy.includes('auto-review guardian'), 'policy text rides in state.policy')
    assert.equal(body.state.request.tool, 'bash')
    assert.equal(body.state.request.toolCall.name, 'bash')
    assert.ok(String(body.state.request.evidence.latest_user_request.text).includes('list the directory'))
    assert.equal(body.questions.decision.type, 'choice')
    assert.ok(Object.keys(body.questions.decision.criteria).join(',') === 'allow,deny' || Object.keys(body.questions.decision.criteria).includes('allow'))
    assert.ok(body.questions.risk.criteria.critical, 'risk criteria carries critical')
    // no chat-completions call anywhere
    assert.ok(!JSON.stringify(body).includes('/chat/completions'))
    // verdict applied
    const audit = (await import('node:fs')).readFileSync(AUDIT_PATH, 'utf8').trim().split('\n')
    const last = JSON.parse(audit[audit.length - 1])
    assert.equal(last.decision, 'allow')
    assert.equal(last.risk, 'low')
    assert.ok((last.reason as string).startsWith('systemone Kev-4b'), `reason synthesized: ${last.reason}`)
    assert.deepEqual(ledger.list('s1'), [])
    assert.equal(injected.length, 0)
    assert.ok(DEFAULT_SYSTEMONE_BASE_URL === 'https://api.siliconflow.cn/v1')
  })

  await t.test('critical risk normalizes an allow into a deny', async () => {
    mode = 'allow-critical'
    freshAudit()
    const c = config()
    const { ledger, breaker, ctx, auditor } = mkDeps(c)
    const answerer = createAnswerer({ ctx, getService: () => undefined, cfg: () => c, log: { warn() {}, error() {} }, breaker, auditor, ledger, tracer } as any)
    const agent = mkAgent(events())
    const outcome = await answerer(
      { toolName: 'bash', callId: 'c1', reason: 'r', signal: new AbortController().signal, agent } as any,
      (async () => 'ask' as any),
    )
    assert.equal(outcome, 'rejected')
    const audit = (await import('node:fs')).readFileSync(AUDIT_PATH, 'utf8').trim().split('\n')
    const last = JSON.parse(audit[audit.length - 1])
    assert.equal(last.decision, 'deny')
    assert.equal(last.risk, 'critical')
    assert.ok((last.reason as string).includes('normalized: critical risk cannot be allowed'), last.reason)
    assert.equal(ledger.list('s1').length, 1)
    assert.equal(ledger.list('s1')[0].risk, 'critical')
    assert.equal(injected.length, 1, 'anti-circumvention notice injected for critical denial')
    injected.length = 0
  })

  await t.test('decision confidence below threshold fails closed as a normal deny', async () => {
    mode = 'allow-lowconf'
    freshAudit()
    const c = config()
    const { ledger, breaker, ctx, auditor } = mkDeps(c)
    const answerer = createAnswerer({ ctx, getService: () => undefined, cfg: () => c, log: { warn() {}, error() {} }, breaker, auditor, ledger, tracer } as any)
    const agent = mkAgent(events())
    const outcome = await answerer(
      { toolName: 'bash', callId: 'c1', reason: 'r', signal: new AbortController().signal, agent } as any,
      (async () => 'ask' as any),
    )
    assert.equal(outcome, 'rejected')
    const audit = (await import('node:fs')).readFileSync(AUDIT_PATH, 'utf8').trim().split('\n')
    const last = JSON.parse(audit[audit.length - 1])
    assert.equal(last.decision, 'deny')
    assert.ok((last.reason as string).includes('below the threshold'), last.reason)
    assert.equal(ledger.list('s1').length, 1)
    assert.equal(injected.length, 0, 'low/medium-risk denial injects no circumvention marker')
  })

  await t.test('malformed answers fail closed as unavailable', async () => {
    mode = 'malformed'
    freshAudit()
    const c = config()
    const { ledger, breaker, ctx, auditor } = mkDeps(c)
    const answerer = createAnswerer({ ctx, getService: () => undefined, cfg: () => c, log: { warn() {}, error() {} }, breaker, auditor, ledger, tracer } as any)
    const agent = mkAgent(events())
    const outcome = await answerer(
      { toolName: 'bash', callId: 'c1', reason: 'r', signal: new AbortController().signal, agent } as any,
      (async () => 'ask' as any),
    )
    assert.equal(outcome, 'unavailable')
  })

  await t.test('timeout fails closed as unavailable', async () => {
    mode = 'delay'
    freshAudit()
    const c = config({ timeoutMs: 250 })
    const { ledger, breaker, ctx, auditor } = mkDeps(c)
    const answerer = createAnswerer({ ctx, getService: () => undefined, cfg: () => c, log: { warn() {}, error() {} }, breaker, auditor, ledger, tracer } as any)
    const agent = mkAgent(events())
    const outcome = await answerer(
      { toolName: 'bash', callId: 'c1', reason: 'r', signal: new AbortController().signal, agent } as any,
      (async () => 'ask' as any),
    )
    assert.equal(outcome, 'unavailable')
  })

  await t.test('buildPrompt: state.request is the chat user JSON, user text unchanged', async () => {
    const prompt = buildPrompt(
      { toolName: 'bash', reason: 'list dir' } as any,
      { name: 'bash', arguments: '{"command":"dir"}' },
      { workspaceRoot: 'E:\\ws', sandboxMode: 'workspace-write' },
      { latestUserRequest: null, priorUserRequests: [], untrustedExecution: [], latestOverBudget: false },
      null,
      [],
    )
    const jsonPart = prompt.user.slice('Review this pending permission request and reply with JSON only.\n\n'.length)
    assert.equal(jsonPart, JSON.stringify(prompt.state.request, null, 2))
    assert.ok(prompt.user.startsWith('Review this pending permission request and reply with JSON only.'))
    assert.ok(prompt.system.length > 0)
    // direct parser check on a synthesized verdict shape
    const v = parseVerdict(JSON.stringify({ decision: 'allow', risk: 'critical', reason: 'systemone test' }))
    assert.equal(v.decision, 'deny')
  })

  server.close()
})
