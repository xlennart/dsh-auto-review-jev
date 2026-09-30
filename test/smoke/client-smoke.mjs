// Behavioural smoke test for the hand-written client half.
// Renders the registered component with a stateful React shim, simulates a
// field edit plus the save control, and asserts the write ops it submits.
const registrations = []
const loads = []
globalThis.window = { __ModuleLoader__: { load: (mod) => { loads.push(mod) } } }

await import('../../client.js')

const assert = (label, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`)
  if (!ok) process.exitCode = 1
}

// ---- loader contract -------------------------------------------------------
const mod = loads[0]
assert('one module registered into __ModuleLoader__', loads.length === 1)
assert("loader id is the package name", mod.id === 'dsh-auto-review-jev', mod.id)

// ---- React shim with working hooks ----------------------------------------
let cursor = 0, pending = false, effects = [], hookSlots = [], slotsInUse = 0
const React = {
  createElement(type, props, ...children) {
    const kids = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
    return { type, props: { ...(props ?? {}), ...(kids === undefined ? {} : { children: kids }) } }
  },
  useState(initial) {
    const i = cursor++
    if (i >= hookSlots.length) { hookSlots[i] = { value: typeof initial === 'function' ? initial() : initial, deps: undefined } }
    else if (i >= slotsInUse && !hookSlots[i].assigned) { hookSlots[i] = { value: typeof initial === 'function' ? initial() : initial, deps: undefined } }
    const slot = hookSlots[i]
    slot.assigned = true
    slotsInUse = Math.max(slotsInUse, i + 1)
    const set = (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; pending = true }
    return [slot.value, set]
  },
  useEffect(fn, deps) {
    const i = cursor++
    if (i >= hookSlots.length) hookSlots[i] = { value: undefined, deps: undefined, assigned: true }
    const slot = hookSlots[i]
    const prev = slot.deps
    const changed = prev === undefined || deps === undefined || deps.length !== prev.length || deps.some((d, k) => !Object.is(d, prev[k]))
    slot.deps = deps
    if (changed) effects.push(fn)
  },
}

function renderTree(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(renderTree)
  if (typeof node.type === 'function') return renderTree(node.type(node.props))
  const kids = node.props?.children
  return { type: node.type, props: { ...node.props, ...(kids === undefined ? {} : { children: renderTree(kids) }) } }
}

function render(root) {
  let tree
  for (let pass = 0; pass < 20; pass++) {
    cursor = 0; slotsInUse = 0; pending = false; effects = []
    tree = renderTree(root)
    for (const fn of effects) fn()
    if (!pending) break
  }
  return tree
}

function findAll(node, pred, acc = []) {
  if (node === null || node === undefined || typeof node !== 'object') return acc
  if (Array.isArray(node)) { for (const child of node) findAll(child, pred, acc); return acc }
  if (pred(node)) acc.push(node)
  findAll(node.props?.children, pred, acc)
  return acc
}

// ---- plugin shape ----------------------------------------------------------
const plugin = mod.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})
assert('factory returns a plugin with apply()', typeof plugin?.apply === 'function')

const injected = []
const registered = []
const whileServed = []
const sectionGets = []
const sectionWrites = []
const sectionValue = {
  enabled: true,
  reviewer: { protocol: 'systemone', baseURL: 'https://api.siliconflow.cn/v1', model: 'Kev-4b', systemone: { confidenceThreshold: 0.6 } },
  policy: { denyOnReviewerError: true },
  breaker: { enabled: true },
  audit: { enabled: true },
}
const sectionForm = {
  getSnapshot: () => ({ status: 'ready', value: sectionValue, revision: 3, writable: true, mode: 'host' }),
  subscribe: () => () => undefined,
  mutate: async (ops, revision) => { sectionWrites.push({ ops, revision }); return true },
}
plugin.apply({
  slots: {
    inject: (name, cb) => { injected.push(name); return cb() },
    register: (options, component) => { registered.push({ options, component }); return () => undefined },
  },
  effect: (fn) => fn(),
  configForms: {
    whileServed: (namespaces, register) => { whileServed.push([...namespaces]); return register(new Set(namespaces)) },
    get: (id) => { sectionGets.push(id); return sectionForm },
  },
})

assert('injects the slots it contributes to',
  injected.includes('plugins.row.config') && injected.includes('settings.section'), injected.join(','))
assert('declares the configForms service in inject',
  Array.isArray(plugin.inject) && plugin.inject.includes('configForms'), JSON.stringify(plugin.inject))
assert('registers exactly two contributions', registered.length === 2, String(registered.length))

const sectionRegistration = registered.find((r) => r.options?.name === 'settings.section')
assert("registers a real settings page into 'settings.section'", sectionRegistration !== undefined)
assert('the settings section carries id / order / label',
  JSON.stringify(sectionRegistration?.options) ===
    JSON.stringify({ name: 'settings.section', id: 'auto-review', order: 55, label: '自动审查' }),
  JSON.stringify(sectionRegistration?.options))
assert('the page is registered through whileServed for its namespace',
  JSON.stringify(whileServed) === JSON.stringify([['auto-review']]), JSON.stringify(whileServed))
assert('the form comes from the shared configForms service keyed by entry id',
  JSON.stringify(sectionGets) === JSON.stringify(['auto-review']), JSON.stringify(sectionGets))

const rowRegistration = registered.find((r) => r.options?.name === 'plugins.row.config')
assert('the row registration key matches rowConfigKey(pkg, rowId)',
  rowRegistration?.options?.key === 'dsh-auto-review-jev#auto-review', rowRegistration?.options?.key)
assert('both registrations carry a component',
  typeof rowRegistration?.component === 'function' && typeof sectionRegistration?.component === 'function')

const Component = rowRegistration.component
const Section = sectionRegistration.component

// ---- summary view ----------------------------------------------------------
const summary = Component({ view: 'summary' })
assert('summary view renders a one-liner', typeof summary === 'string' && summary.includes('System One'), String(summary))

// ---- page view renders and writes correct ops ------------------------------
const writes = []
const hostValue = {
  enabled: true,
  reviewer: { protocol: 'systemone', baseURL: 'https://api.siliconflow.cn/v1', model: 'Kev-4b', apiKeyFile: '~/.dsh/reviewer.env', systemone: { confidenceThreshold: 0.6 } },
  policy: { denyOnReviewerError: true },
  breaker: { enabled: true },
  audit: { enabled: true },
}
const form = {
  state: { status: 'ready', value: hostValue, base: undefined, user: undefined, revision: 7, writable: true, mode: 'host' },
  mutate: async (ops, revision) => { writes.push({ ops, revision }); return true },
}

let tree = render({ type: Component, props: { view: 'page', form } })
const inputs = findAll(tree, (n) => n.type === 'input')
const selects = findAll(tree, (n) => n.type === 'select')
const textareas = findAll(tree, (n) => n.type === 'textarea')
assert('page view renders every editable field',
  inputs.length + selects.length + textareas.length === 15,
  `${inputs.length} inputs + ${selects.length} select + ${textareas.length} textarea`)
assert('current values are shown', findAll(tree, (n) => n.type === 'input' && n.props.value === 'Kev-4b').length === 1)
assert('protocol is a select carrying the live value',
  findAll(tree, (n) => n.type === 'select' && n.props.value === 'systemone').length === 1)
assert('save is disabled while nothing changed',
  findAll(tree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0]?.props.disabled === true)

// ---- design contract -------------------------------------------------------
const styles = findAll(tree, (n) => n.type === 'style')
assert('injects exactly one stylesheet for the page', styles.length === 1, String(styles.length))
const css = String(styles[0]?.props?.children ?? '')
assert('the stylesheet is built on theme tokens, not a hard-coded palette',
  css.includes('var(--dsw-alias-brand-primary)') && css.includes('var(--dsw-alias-bg-layer-1)') &&
  css.includes('var(--dsw-alias-label-secondary)') && css.includes('var(--dsw-alias-border-l1)'))
assert('the stylesheet carries what inline styles cannot express',
  css.includes(':focus-visible') && css.includes('.arj-switch input:checked+.arj-track') &&
  css.includes('position:sticky') && css.includes('prefers-reduced-motion') && css.includes('max-width:640px'))
assert('booleans render as switches rather than raw checkboxes',
  findAll(tree, (n) => n.props?.className === 'arj-switch').length === 5,
  String(findAll(tree, (n) => n.props?.className === 'arj-switch').length))
assert('the header states the guardian state as a pill',
  findAll(tree, (n) => n.props?.['data-tone'] === 'on' && n.props?.children?.[1] === '已启用').length === 1)
assert('the page groups fields into titled cards',
  findAll(tree, (n) => n.props?.className === 'arj-card').length === 3,
  String(findAll(tree, (n) => n.props?.className === 'arj-card').length))
assert('the page shows the resolved protocol / model / endpoint / key source',
  findAll(tree, (n) => n.props?.className === 'arj-chip').length === 4,
  String(findAll(tree, (n) => n.props?.className === 'arj-chip').length))
assert('a sticky action bar holds the save controls',
  findAll(tree, (n) => n.props?.className === 'arj-bar').length === 1)
assert('both diagnostic paths are shown as read-only rows',
  findAll(tree, (n) => typeof n.props?.className === 'string' && n.props.className.includes('arj-code')).length === 2,
  String(findAll(tree, (n) => typeof n.props?.className === 'string' && n.props.className.includes('arj-code')).length))

const model = findAll(tree, (n) => n.type === 'input' && n.props['aria-label'] === '审查模型')[0]
model.props.onChange({ target: { value: 'jev-latest' } })
const threshold = findAll(tree, (n) => n.type === 'input' && n.props['aria-label'] === '置信度阈值')[0]
assert('the confidence threshold is a slider over 0.5–1.0',
  threshold?.props.type === 'range' && threshold.props.min === 0.5 && threshold.props.max === 1 && threshold.props.step === 0.01,
  `${threshold?.props.type} ${threshold?.props.min}-${threshold?.props.max}`)
threshold.props.onChange({ target: { value: '0.75' } })
tree = render({ type: Component, props: { view: 'page', form } })
assert('changed rows are marked so the page can highlight them',
  findAll(tree, (n) => n.props?.className === 'arj-row' && n.props['data-dirty'] === 'true').length === 2,
  String(findAll(tree, (n) => n.props?.className === 'arj-row' && n.props['data-dirty'] === 'true').length))
assert('the action bar names the pending fields',
  findAll(tree, (n) => n.props?.className === 'arj-dirty-tag').map((n) => n.props.children).join(',') === '审查模型,置信度阈值',
  findAll(tree, (n) => n.props?.className === 'arj-dirty-tag').map((n) => n.props.children).join(','))

const save = findAll(tree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0]
assert('save reports the pending change count', String(save?.props.children).includes('2'), String(save?.props.children))
await save.props.onClick()
assert('one mutation submitted', writes.length === 1)
assert('mutation carries the revision it read', writes[0]?.revision === 7)
assert('mutation uses path-addressed set ops',
  writes[0]?.ops?.every((op) => op.op === 'set' && Array.isArray(op.path)))
assert('typed value preserved for the number field',
  JSON.stringify(writes[0]?.ops) === JSON.stringify([
    { op: 'set', path: ['reviewer', 'model'], value: 'jev-latest' },
    { op: 'set', path: ['reviewer', 'systemone', 'confidenceThreshold'], value: 0.75 },
  ]), JSON.stringify(writes[0]?.ops))

// ---- the new policy controls: low-confidence mode + allow-rule editor ------
const rulesWrites = []
const rulesForm = { state: { ...form.state }, mutate: async (ops, revision) => { rulesWrites.push({ ops, revision }); return true } }
let rulesTree = render({ type: Component, props: { view: 'page', form: rulesForm } })

const lowConf = findAll(rulesTree, (n) => n.type === 'select' && n.props['aria-label'] === '模型没把握时')[0]
assert('low-confidence behaviour offers defer (the human decides) or deny',
  lowConf !== undefined && lowConf.props.children.map((c) => c.props.value).join(',') === 'defer,deny' &&
  lowConf.props.value === 'deny',
  `${lowConf?.props.value} [${lowConf?.props.children.map((c) => c.props.value).join(',')}]`)
const dangerSwitch = findAll(rulesTree, (n) => n.props['aria-label'] === '白名单可授予完全访问')[0]
assert('granting danger-full-access from a rule is an explicit opt-in, off by default',
  dangerSwitch !== undefined && dangerSwitch.props.checked === false,
  String(dangerSwitch?.props.checked))
const ruleBox = findAll(rulesTree, (n) => n.type === 'textarea' && n.props['aria-label'] === '免审白名单')[0]
assert('the allow-rule list is edited as prefilled JSON',
  ruleBox !== undefined && JSON.stringify(JSON.parse(String(ruleBox.props.value))) === '[]',
  String(ruleBox?.props.value))

// Unparsable JSON must never reach the Host: the whole document write would be
// rejected and every other edit in the same save would be lost with it.
ruleBox.props.onChange({ target: { value: '[{"tool":' } })
rulesTree = render({ type: Component, props: { view: 'page', form: rulesForm } })
const badNote = findAll(rulesTree, (n) => n.props?.className === 'arj-json-note' && n.props['data-tone'] === 'error')
const badSave = findAll(rulesTree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0]
assert('unparsable rules disable the save and say why',
  badNote.length === 1 && badSave?.props.disabled === true,
  `note=${badNote.length} disabled=${badSave?.props.disabled}`)
await badSave.props.onClick()
assert('an invalid rules edit submits nothing', rulesWrites.length === 0, String(rulesWrites.length))

const ruleList = [{ tool: 'pwsh', operations: ['Get-Process'], escalationTarget: '' }]
findAll(rulesTree, (n) => n.type === 'textarea')[0].props.onChange({ target: { value: JSON.stringify(ruleList, null, 2) } })
rulesTree = render({ type: Component, props: { view: 'page', form: rulesForm } })
assert('a valid rules edit is marked pending',
  findAll(rulesTree, (n) => n.props?.className === 'arj-json-note' && n.props['data-tone'] === 'dirty').length === 1)
assert('the pending list names the rule list',
  findAll(rulesTree, (n) => n.props?.className === 'arj-dirty-tag').map((n) => n.props.children).join(',') === '免审白名单',
  findAll(rulesTree, (n) => n.props?.className === 'arj-dirty-tag').map((n) => n.props.children).join(','))
await findAll(rulesTree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0].props.onClick()
assert('the rule list is submitted as a parsed array, not a string',
  JSON.stringify(rulesWrites[0]?.ops) === JSON.stringify([{ op: 'set', path: ['policy', 'allowRules'], value: ruleList }]),
  JSON.stringify(rulesWrites[0]?.ops))

// ---- the optional context budget: an int box where empty means "not sent" ---
const intWrites = []
const budgetValue = JSON.parse(JSON.stringify(hostValue))
budgetValue.reviewer.systemone.maxLen = 8192
const budgetForm = { state: { ...form.state, value: budgetValue }, mutate: async (ops, revision) => { intWrites.push({ ops, revision }); return true } }
let budgetTree = render({ type: Component, props: { view: 'page', form: budgetForm } })
const budgetBox = findAll(budgetTree, (n) => n.type === 'input' && n.props['aria-label'] === '上下文长度上限')[0]
assert('the context budget is an integer box showing the saved value',
  budgetBox !== undefined && budgetBox.props.type === 'number' && budgetBox.props.value === '8192',
  `${budgetBox?.props.type} ${JSON.stringify(budgetBox?.props.value)}`)
budgetBox.props.onChange({ target: { value: 'abc' } })
budgetTree = render({ type: Component, props: { view: 'page', form: budgetForm } })
const badBudgetSave = findAll(budgetTree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0]
assert('a non-numeric budget disables the save', badBudgetSave?.props.disabled === true, String(badBudgetSave?.props.disabled))
await badBudgetSave.props.onClick()
assert('a non-numeric budget submits nothing', intWrites.length === 0, String(intWrites.length))

findAll(budgetTree, (n) => n.type === 'input' && n.props['aria-label'] === '上下文长度上限')[0]
  .props.onChange({ target: { value: '' } })
budgetTree = render({ type: Component, props: { view: 'page', form: budgetForm } })
await findAll(budgetTree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0].props.onClick()
assert('emptying the budget sends an unset op, never a zero',
  JSON.stringify(intWrites[0]?.ops) === JSON.stringify([{ op: 'unset', path: ['reviewer', 'systemone', 'maxLen'] }]),
  JSON.stringify(intWrites[0]?.ops))

// ---- write-only secret field ----------------------------------------------
const secretWrites = []
const secretForm = { state: { ...form.state }, mutate: async (ops, revision) => { secretWrites.push({ ops, revision }); return true } }
let secretTree = render({ type: Component, props: { view: 'page', form: secretForm } })
const password = findAll(secretTree, (n) => n.type === 'input' && n.props.type === 'password')
assert('the api key control is a password box that never echoes a stored value',
  password.length === 1 && password[0].props.value === '' && password[0].props.placeholder === '留空表示不改动',
  `count=${password.length} value=${JSON.stringify(password[0]?.props.value)}`)
assert('an untouched secret is not submitted along with other edits',
  writes[0].ops.every((op) => op.path.join('.') !== 'reviewer.apiKey'))

password[0].props.onChange({ target: { value: 'sk-typed-key' } })
secretTree = render({ type: Component, props: { view: 'page', form: secretForm } })
const secretSave = findAll(secretTree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0]
await secretSave.props.onClick()
assert('a typed key is submitted as a set op on reviewer.apiKey',
  JSON.stringify(secretWrites[0]?.ops) === JSON.stringify([{ op: 'set', path: ['reviewer', 'apiKey'], value: 'sk-typed-key' }]),
  JSON.stringify(secretWrites[0]?.ops))

const clearButton = findAll(secretTree, (n) => n.type === 'button' && n.props.children === '清除')[0]
assert('the secret field offers a clear control', clearButton !== undefined)
await clearButton.props.onClick()
assert('clearing sends an unset op',
  JSON.stringify(secretWrites[1]?.ops) === JSON.stringify([{ op: 'unset', path: ['reviewer', 'apiKey'] }]),
  JSON.stringify(secretWrites[1]?.ops))

// ---- readonly + unavailable paths -----------------------------------------
const ro = render({ type: Component, props: { view: 'page', form: { state: { ...form.state, writable: false }, mutate: form.mutate } } })
assert('readonly document disables the controls',
  findAll(ro, (n) => n.type === 'input').every((n) => n.props.disabled === true))
const unavailableTree = render({ type: Component, props: { view: 'page', form: { state: { status: 'unavailable' }, mutate: form.mutate } } })
assert('unavailable status renders a notice',
  findAll(unavailableTree, (n) => typeof n.props?.children === 'string' && n.props.children.includes('不可用')).length === 1)
const loadingTree = render({ type: Component, props: { view: 'page', form: { state: { status: 'loading' }, mutate: form.mutate } } })
assert('loading status renders a skeleton instead of a bare line',
  findAll(loadingTree, (n) => n.props?.className === 'arj-skeleton').length === 1 &&
  findAll(loadingTree, (n) => n.type === 'i').length === 3)

// ---- the settings page itself ---------------------------------------------
// A different component tree: clear the shared slot array so the Section's own
// hooks do not inherit the row page's state.
hookSlots.length = 0

let sectionTree = render({ type: Section, props: { close: () => undefined } })
const sectionHeadings = findAll(sectionTree, (n) => n.type === 'h2').map((n) => String(n.props.children))
assert('the settings page renders its heading',
  sectionHeadings.some((t) => t.includes('自动审查')), JSON.stringify(sectionHeadings))
assert('the settings page renders the same 15 editable fields',
  findAll(sectionTree, (n) => n.type === 'input').length + findAll(sectionTree, (n) => n.type === 'select').length
    + findAll(sectionTree, (n) => n.type === 'textarea').length === 15,
  String(findAll(sectionTree, (n) => n.type === 'input').length + findAll(sectionTree, (n) => n.type === 'select').length
    + findAll(sectionTree, (n) => n.type === 'textarea').length))
assert('the settings page shows the live host values',
  findAll(sectionTree, (n) => n.type === 'input' && n.props.value === 'Kev-4b').length === 1)

const sectionModel = findAll(sectionTree, (n) => n.type === 'input' && n.props['aria-label'] === '审查模型')[0]
assert('the settings page exposes every field by aria-label', sectionModel !== undefined)
sectionModel.props.onChange({ target: { value: 'Qwen3-8B' } })
sectionTree = render({ type: Section, props: { close: () => undefined } })
await findAll(sectionTree, (n) => n.type === 'button' && String(n.props.children).startsWith('保存'))[0].props.onClick()
assert('a settings-page edit submits through the shared form',
  JSON.stringify(sectionWrites[0]?.ops) === JSON.stringify([{ op: 'set', path: ['reviewer', 'model'], value: 'Qwen3-8B' }]),
  JSON.stringify(sectionWrites[0]?.ops))

console.log(process.exitCode === 1 ? '\nclient smoke: FAILURES above' : '\nclient smoke: all checks passed')
