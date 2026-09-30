/**
 * Browser half of dsh-auto-review-jev.
 *
 * Where the page lives: `settings.section` — "one settings page per list
 * entry" — registered only while the Host actually serves the `auto-review`
 * namespace (`configForms.whileServed`, the documented route for a page that
 * edits a namespace another plugin owns). `plugins.row.config` additionally
 * gives the row its configure control on the Plugins page.
 *
 * How it looks: every colour is a `--dsw-alias-*` theme token, so the page
 * follows the shell's own light/dark switch instead of hard-coding a palette.
 * The injected stylesheet buys hover states, focus rings, the switch and the
 * sticky action bar — none of which inline styles can express. The row grid
 * collapses to one column on a narrow panel.
 *
 * Hand-written rather than bundled: the artifact format is plain script — a
 * lazy factory registered into `window.__ModuleLoader__` whose id is the
 * package name, with React taken from the browser module table.
 */
window.__ModuleLoader__.load({
  id: 'dsh-auto-review-jev',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** The row id this bundle's patch declares; also the settings namespace. */
    const ROW_ID = 'auto-review'
    /** The Host plugin entry id, which is also its settings namespace. */
    const NS = 'auto-review'
    /** Position of this page among the other `settings.section` entries. */
    const SECTION_ORDER = 55
    /** `rowConfigKey(packageName, rowId)` from the Plugins page contract. */
    const SLOT_KEY = 'dsh-auto-review-jev#' + ROW_ID
    /** The fixed diagnostic sink (src/trace.ts), shown for support. */
    const TRACE_PATH = '~/.dsh/auto-review-trace.jsonl'

    const CSS = `
.arj{display:flex;flex-direction:column;gap:12px;max-width:54rem;padding-bottom:4px;
  font-family:var(--dsw-font-family,inherit);font-size:13px;line-height:1.55;
  color:var(--dsw-alias-label-primary)}
.arj *{box-sizing:border-box}
.arj-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.arj-head-text{display:flex;flex-direction:column;gap:2px;min-width:14rem;flex:1 1 16rem}
.arj-title{margin:0;font-size:15px;font-weight:600;letter-spacing:.01em}
.arj-sub{margin:0;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.arj-head-actions{display:flex;align-items:center;gap:10px;margin-left:auto}
.arj-chips{display:flex;flex-wrap:wrap;gap:6px}
.arj-chip{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 9px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);font-size:11.5px;white-space:nowrap;max-width:100%;overflow:hidden}
.arj-chip b{font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis}
.arj-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;font-variant-numeric:tabular-nums}
.arj-code{display:block;padding:3px 7px;border-radius:6px;background:var(--dsw-alias-bg-base);
  border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);
  overflow-wrap:anywhere;max-width:100%}
.arj-state{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);
  font-size:11.5px;font-weight:600;white-space:nowrap}
.arj-state[data-tone=on]{color:var(--dsw-alias-state-success-primary)}
.arj-state[data-tone=off]{color:var(--dsw-alias-state-idle-primary)}
.arj-state[data-tone=warn]{color:var(--dsw-alias-state-warn-primary)}
.arj-state[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.arj-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.arj-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;
  background:var(--dsw-alias-bg-layer-1)}
.arj-card-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:10px 14px;
  border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.arj-card-title{margin:0;font-size:12.5px;font-weight:600}
.arj-card-note{margin:0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.arj-rows{display:flex;flex-direction:column}
.arj-row{position:relative;display:grid;grid-template-columns:minmax(11rem,1fr) minmax(0,1.1fr);
  gap:6px 16px;align-items:center;padding:10px 14px;
  border-top:1px solid var(--dsw-alias-border-l1);transition:background-color .12s ease}
.arj-row:first-child{border-top:none}
.arj-row:hover{background:var(--dsw-alias-bg-layer-2)}
.arj-row[data-dirty=true]{background:var(--dsw-alias-bg-layer-2)}
.arj-row[data-dirty=true]:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;
  border-radius:2px;background:var(--dsw-alias-state-warn-primary)}
.arj-label{display:flex;flex-direction:column;gap:2px;min-width:0}
.arj-label-name{font-weight:500}
.arj-hint{font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.arj-ctl-wrap{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.arj-input,.arj-select{width:100%;height:30px;padding:0 10px;border-radius:8px;font:inherit;font-size:12.5px;
  color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);
  border:1px solid var(--dsw-alias-border-l1);
  transition:border-color .12s ease,box-shadow .12s ease}
.arj-input:hover:not(:disabled),.arj-select:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}
.arj-input:focus,.arj-select:focus{outline:none;border-color:var(--dsw-alias-brand-primary);
  box-shadow:0 0 0 3px rgba(120,140,255,.22)}
.arj-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}
.arj-input:disabled,.arj-select:disabled{opacity:.55;cursor:not-allowed}
.arj-input.arj-secret{letter-spacing:.14em}
.arj-input.arj-json{height:auto;min-height:118px;padding:8px 10px;resize:vertical;white-space:pre;overflow:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6}
.arj-json-note{margin-top:6px;font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.arj-json-note[data-tone="dirty"]{color:var(--dsw-alias-state-warn-primary)}
.arj-json-note[data-tone="error"]{color:var(--dsw-alias-state-error-primary)}
.arj-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 13px;border-radius:8px;
  font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;
  color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);
  border:1px solid var(--dsw-alias-border-l1);
  transition:background-color .12s ease,border-color .12s ease,opacity .12s ease,filter .12s ease}
.arj-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.arj-btn:focus-visible,.arj-input:focus-visible,.arj-select:focus-visible,.arj-switch input:focus-visible+.arj-track,
.arj-range:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.arj-btn:disabled{opacity:.45;cursor:not-allowed}
.arj-btn-primary{color:#fff;background:var(--dsw-alias-brand-primary);border-color:transparent}
.arj-btn-primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);border-color:transparent;filter:brightness(1.08)}
.arj-btn-sm{height:26px;padding:0 10px;font-size:11.5px}
.arj-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.arj-switch input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.arj-track{position:relative;flex:none;width:34px;height:20px;border-radius:999px;
  background:var(--dsw-alias-state-idle-primary);border:1px solid var(--dsw-alias-border-l2);
  transition:background-color .16s ease,border-color .16s ease}
.arj-knob{position:absolute;top:1px;left:1px;width:14px;height:14px;border-radius:50%;background:#fff;
  box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .16s cubic-bezier(.16,1,.3,1)}
.arj-switch input:checked+.arj-track{background:var(--dsw-alias-brand-primary);border-color:transparent}
.arj-switch input:checked+.arj-track .arj-knob{transform:translateX(14px)}
.arj-switch input:disabled+.arj-track{opacity:.5;cursor:not-allowed}
.arj-switch-text{font-size:11.5px;color:var(--dsw-alias-label-secondary);min-width:2.2em}
.arj-range{width:100%;min-width:6rem;height:20px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.arj-range:disabled{cursor:not-allowed;opacity:.55}
.arj-value{min-width:2.8em;text-align:right;font-weight:600;font-size:12.5px;font-variant-numeric:tabular-nums}
.arj-info{display:flex;gap:8px;padding:9px 12px;border-radius:10px;font-size:11.5px;line-height:1.5;
  color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);
  border:1px solid var(--dsw-alias-border-l1)}
.arj-bar{position:sticky;bottom:0;z-index:1;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 12px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-1)}
.arj-dirty-list{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-right:auto}
.arj-dirty-tag{padding:1px 7px;border-radius:6px;font-size:11px;color:var(--dsw-alias-label-secondary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
.arj-bar-note{font-size:12px;color:var(--dsw-alias-label-secondary)}
.arj-bar-note[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}
.arj-bar-note[data-tone=warn]{color:var(--dsw-alias-state-warn-primary)}
.arj-bar-note[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.arj-empty{margin:0;padding:18px 14px;border-radius:12px;text-align:center;font-size:12.5px;
  color:var(--dsw-alias-label-secondary);border:1px dashed var(--dsw-alias-border-l1)}
.arj-skeleton{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:12px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.arj-skeleton i{display:block;height:10px;border-radius:6px;background:var(--dsw-alias-bg-layer-2)}
.arj-skeleton i:nth-child(1){width:32%}
.arj-skeleton i:nth-child(2){width:78%}
.arj-skeleton i:nth-child(3){width:56%}
@media (max-width:640px){.arj-row{grid-template-columns:1fr}.arj-head-actions{margin-left:0}}
@media (prefers-reduced-motion:reduce){.arj *{transition:none!important}}
`

    /**
     * Editable fields, grouped exactly as the page lays them out. Every path
     * lives under a `.volatile()` subtree of the plugin's Config schema, which
     * is what makes it writable through the settings document. The API key is a
     * write-only secret: its stored value rides redacted, so the box never
     * echoes it and an empty box submits nothing.
     */
    const FIELDS = [
      {
        group: 'master',
        path: ['enabled'],
        label: '启用守护者',
        type: 'boolean',
        hint: '关闭后所有审批请求直接交给人工确认',
      },
      {
        group: 'backend',
        path: ['reviewer', 'protocol'],
        label: '审查协议',
        type: 'enum',
        options: ['systemone', 'chat'],
        hint: 'systemone＝决策 API（一次调用同时问 decision 与 risk）；chat＝OpenAI 兼容端点',
      },
      {
        group: 'backend',
        path: ['reviewer', 'baseURL'],
        label: '端点 baseURL',
        type: 'text',
        placeholder: 'https://api.siliconflow.cn/v1',
        hint: '硅基流动 https://api.siliconflow.cn/v1 ／ TypeSafe https://api.typesafe.ai/v1 ／ 自部署 Laya http://127.0.0.1:8000/v1',
      },
      {
        group: 'backend',
        path: ['reviewer', 'model'],
        label: '审查模型',
        type: 'text',
        placeholder: 'Kev-4b',
        hint: '硅基流动 Kev-4b；TypeSafe jev-latest',
      },
      {
        group: 'backend',
        path: ['reviewer', 'systemone', 'confidenceThreshold'],
        label: '置信度阈值',
        type: 'number',
        min: 0.5,
        max: 1,
        step: 0.01,
        hint: 'decision 置信度低于此值一律按拒绝处理（0.5–1.0）；critical 风险无视置信度永远拒绝',
      },
      {
        group: 'backend',
        path: ['reviewer', 'systemone', 'maxLen'],
        label: '上下文长度上限',
        type: 'int',
        min: 0,
        max: 200000,
        placeholder: '留空＝沿用服务端预算',
        hint: '仅 systemone 协议，作为 max_len 发送。留空＝不发送：自部署后端（Laya）会用自身默认值截断 state，长证据链建议填 8192',
      },
      {
        group: 'backend',
        path: ['reviewer', 'apiKey'],
        label: 'API 密钥',
        type: 'secret',
        hint: '仅写入、不回显；留空表示不改动已保存的密钥。本机端点（127.0.0.1/localhost）可整段留空，插件不发 Authorization',
      },
      {
        group: 'backend',
        path: ['reviewer', 'apiKeyEnv'],
        label: '密钥环境变量',
        type: 'text',
        placeholder: 'SILICONFLOW_API_KEY',
        hint: '与密钥文件二选一，二者都设时环境变量优先',
      },
      {
        group: 'backend',
        path: ['reviewer', 'apiKeyFile'],
        label: '密钥文件',
        type: 'text',
        placeholder: '~/.dsh/reviewer.env',
        hint: '文件内容写 KEY=… 或直接写密钥本身',
      },
      {
        group: 'policy',
        path: ['policy', 'denyOnReviewerError'],
        label: '审查器异常时拒绝',
        type: 'boolean',
        hint: '超时、不可达、返回不可解析时按拒绝处理（fail closed）',
      },
      {
        group: 'policy',
        path: ['policy', 'onLowConfidence'],
        label: '模型没把握时',
        type: 'enum',
        options: ['defer', 'deny'],
        fallback: 'deny',
        hint: 'defer＝转交你批准；deny＝直接拒绝。只影响「决策置信度低于阈值」这一种情况，模型确信危险时始终拒绝',
      },
      {
        group: 'policy',
        path: ['policy', 'allowRules'],
        label: '免审白名单',
        type: 'json',
        rows: 6,
        hint: 'JSON 数组，命中即不经审查直接放行。每项 {"tool":"pwsh","operations":["Get-Process"],"escalationTarget":""}；前缀之后若出现 ; | & > < 反引号 $ ( ) 等控制字符则不匹配',
      },
      {
        group: 'policy',
        path: ['policy', 'allowDangerFullAccessRules'],
        label: '白名单可授予完全访问',
        type: 'boolean',
        hint: '默认关闭：白名单只能放行普通请求与 workspace-write 升级。开启后规则才可写 danger-full-access —— 那是免审放开沙盒，请谨慎',
      },
      {
        group: 'policy',
        path: ['breaker', 'enabled'],
        label: '熔断器',
        type: 'boolean',
        hint: '同一轮内连续拒绝、或窗口内拒绝过多时，后续请求直接取消',
      },
      {
        group: 'observability',
        path: ['audit', 'enabled'],
        label: '审计留痕',
        type: 'boolean',
        hint: '每次裁决追加一行 JSONL，含工具、风险等级与理由',
      },
    ]

    const GROUPS = [
      { id: 'backend', title: '审查后端', note: '审查请求发往哪、用哪个模型、如何鉴权' },
      { id: 'policy', title: '策略与安全', note: '审查器异常与连续拒绝时的兜底行为' },
      { id: 'observability', title: '可观测性', note: '裁决与诊断的落盘位置' },
    ]

    const MASTER = FIELDS[0]
    const SECRET = FIELDS.find((field) => field.type === 'secret')
    const RULES = FIELDS.find((field) => field.type === 'json')

    const read = (value, path) => path.reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), value)
    const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b)
    const keyOf = (field) => field.path.join('.')

    function StyleTag() {
      return h('style', { key: 'arj-styles', 'data-dsh-auto-review': 'styles' }, CSS)
    }

    function Switch(field, on, common, edit) {
      return h('label', { className: 'arj-switch', key: 'switch' }, [
        h('input', {
          ...common,
          key: 'input',
          type: 'checkbox',
          checked: on,
          onChange: (event) => edit(field, event.target.checked),
        }),
        h('span', { key: 'track', className: 'arj-track' }, h('span', { key: 'knob', className: 'arj-knob' })),
        h('span', { key: 'text', className: 'arj-switch-text' }, on ? '开启' : '关闭'),
      ])
    }

    function Editor({ snap, mutate }) {
      const [draft, setDraft] = React.useState({})
      const [busy, setBusy] = React.useState(false)
      const [note, setNote] = React.useState(null)
      // The allow-rule list is edited as JSON TEXT and validated here, so an
      // unparsable edit can never reach the Host as a config write (the Host
      // would reject the whole document, losing the other fields too).
      const [rulesText, setRulesText] = React.useState(null)

      // Host values win whenever the namespace revision moves (a write landed,
      // or another editor changed the document).
      React.useEffect(() => { setDraft({}); setNote(null); setRulesText(null) }, [snap.revision])

      const base = snap.value === undefined || snap.value === null ? {} : snap.value
      const readonly = snap.writable === false

      const rulesSaved = RULES === undefined ? [] : (read(base, RULES.path) || [])
      const rulesShown = rulesText === null ? JSON.stringify(rulesSaved, null, 2) : rulesText
      const rulesParsed = (() => {
        try {
          const value = JSON.parse(rulesShown.trim() === '' ? '[]' : rulesShown)
          if (!Array.isArray(value)) return { ok: false, error: '顶层必须是数组' }
          for (const [index, rule] of value.entries()) {
            if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) return { ok: false, error: '第 ' + (index + 1) + ' 项不是对象' }
            if (typeof rule.tool !== 'string' || rule.tool.trim() === '') return { ok: false, error: '第 ' + (index + 1) + ' 项缺少 tool' }
            if (rule.operations !== undefined && !Array.isArray(rule.operations)) return { ok: false, error: '第 ' + (index + 1) + ' 项的 operations 必须是数组' }
          }
          return { ok: true, value }
        } catch (error) {
          return { ok: false, error: error && error.message ? error.message : String(error) }
        }
      })()
      const rulesChanged = rulesParsed.ok && JSON.stringify(rulesParsed.value) !== JSON.stringify(rulesSaved)
      const valueOf = (field) => {
        const key = keyOf(field)
        return Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : read(base, field.path)
      }
      const draftOf = (field) => {
        const key = keyOf(field)
        return Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : undefined
      }
      const edit = (field, value) => setDraft((current) => ({ ...current, [keyOf(field)]: value }))
      const fieldOf = (key) => FIELDS.find((candidate) => keyOf(candidate) === key)
      const changed = Object.keys(draft).filter((key) => {
        // An untouched (empty) secret box means "leave the stored key alone".
        if (fieldOf(key) !== undefined && fieldOf(key).type === 'secret' && (draft[key] === '' || draft[key] === undefined)) return false
        return !same(draft[key], read(base, key.split('.')))
      })
      const dirty = (field) => (field.type === 'json' ? rulesChanged : changed.indexOf(keyOf(field)) !== -1)
      // 'int' fields are edited as TEXT so they can be emptied (= unset). They
      // convert to a number only at save time, and anything unparsable blocks
      // the save instead of reaching the Host as a rejected document write.
      const intProblem = (() => {
        for (const field of FIELDS) {
          if (field.type !== 'int') continue
          const key = keyOf(field)
          if (changed.indexOf(key) === -1) continue
          const raw = String(draft[key] === undefined || draft[key] === null ? '' : draft[key]).trim()
          if (raw === '') continue
          if (!/^\d+$/.test(raw)) return { label: field.label, why: '必须是整数' }
          const numeric = Number(raw)
          if (field.min !== undefined && numeric < field.min) return { label: field.label, why: '不得小于 ' + field.min }
          if (field.max !== undefined && numeric > field.max) return { label: field.label, why: '不得大于 ' + field.max }
        }
        return null
      })()
      // Everything the save button would submit, in display order.
      const pending = [
        ...changed.map((key) => {
          const field = fieldOf(key)
          return { key, label: field === undefined ? key : field.label }
        }),
        ...(RULES !== undefined && rulesChanged ? [{ key: keyOf(RULES), label: RULES.label }] : []),
      ]

      const save = async () => {
        if (intProblem !== null) { setNote({ tone: 'error', text: intProblem.label + '：' + intProblem.why }); return }
        if (!rulesParsed.ok) { setNote({ tone: 'error', text: '白名单 JSON 无效，无法保存' }); return }
        if (pending.length === 0 || busy) return
        setBusy(true)
        try {
          const ops = changed.map((key) => {
            const field = fieldOf(key)
            if (field !== undefined && field.type === 'int') {
              const raw = String(draft[key] === undefined || draft[key] === null ? '' : draft[key]).trim()
              // Emptying the box means "do not send this at all", not "send 0".
              return raw === ''
                ? { op: 'unset', path: key.split('.') }
                : { op: 'set', path: key.split('.'), value: Number(raw) }
            }
            return { op: 'set', path: key.split('.'), value: draft[key] }
          })
          if (RULES !== undefined && rulesChanged) ops.push({ op: 'set', path: RULES.path, value: rulesParsed.value })
          const accepted = await mutate(ops, snap.revision)
          setNote(accepted ? { tone: 'ok', text: '已保存' } : { tone: 'error', text: '宿主拒绝了这次修改' })
          if (accepted) { setDraft({}); setRulesText(null) }
        } catch (error) {
          setNote({ tone: 'error', text: '保存失败：' + (error && error.message ? error.message : String(error)) })
        } finally {
          setBusy(false)
        }
      }

      const clearSecret = async (field) => {
        if (busy) return
        setBusy(true)
        try {
          const accepted = await mutate([{ op: 'unset', path: field.path }], snap.revision)
          setNote(accepted ? { tone: 'ok', text: '已清除已保存的密钥' } : { tone: 'error', text: '宿主拒绝了这次修改' })
          if (accepted) setDraft({})
        } catch (error) {
          setNote({ tone: 'error', text: '清除失败：' + (error && error.message ? error.message : String(error)) })
        } finally {
          setBusy(false)
        }
      }

      const disabled = readonly || busy

      const control = (field) => {
        const value = valueOf(field)
        const common = { disabled, 'aria-label': field.label }
        if (field.type === 'secret') {
          return [
            h('input', {
              ...common,
              key: 'input',
              className: 'arj-input arj-secret',
              type: 'password',
              autoComplete: 'new-password',
              placeholder: draftOf(field) === undefined ? '留空表示不改动' : '',
              value: draftOf(field) === undefined ? '' : String(draftOf(field)),
              onChange: (event) => edit(field, event.target.value),
            }),
            h('button', {
              key: 'clear',
              className: 'arj-btn arj-btn-sm',
              type: 'button',
              disabled,
              onClick: () => { void clearSecret(field) },
            }, '清除'),
          ]
        }
        if (field.type === 'boolean') return Switch(field, value === true, common, edit)
        if (field.type === 'json') {
          return [
            h('textarea', {
              ...common,
              key: 'text',
              className: 'arj-input arj-json',
              rows: field.rows === undefined ? 6 : field.rows,
              spellCheck: false,
              placeholder: field.placeholder === undefined ? undefined : field.placeholder,
              value: rulesShown,
              onChange: (event) => setRulesText(event.target.value),
            }),
            h('div', {
              key: 'json-note',
              className: 'arj-json-note',
              'data-tone': rulesParsed.ok ? (rulesChanged ? 'dirty' : 'ok') : 'error',
            }, rulesParsed.ok
              ? (rulesChanged
                ? '已修改，保存后生效：' + rulesParsed.value.length + ' 条规则'
                : '与已保存内容一致：' + rulesParsed.value.length + ' 条规则')
              : 'JSON 无效：' + rulesParsed.error),
          ]
        }
        if (field.type === 'enum') {
          return h('select', {
            ...common,
            key: 'select',
            className: 'arj-select',
            // With no explicit host value the effective schema default is shown
            // (fallback) instead of an empty box, so the page never implies
            // "unset" where the Host actually applies a default.
            value: value === undefined || value === null
              ? (field.fallback === undefined ? '' : field.fallback)
              : String(value),
            onChange: (event) => edit(field, event.target.value),
          }, (field.options || []).map((option) => h('option', { key: option, value: option }, option)))
        }
        if (field.type === 'int') {
          const own = draftOf(field)
          // An empty box means "not sent"; a saved 0 also shows as empty, since
          // 0 is exactly what "inherit the endpoint's own budget" is.
          const shown = own !== undefined
            ? String(own)
            : (value === undefined || value === null || Number(value) === 0 ? '' : String(value))
          return h('input', {
            ...common,
            key: 'int',
            className: 'arj-input',
            type: 'number',
            min: field.min,
            max: field.max,
            step: 1,
            inputMode: 'numeric',
            placeholder: field.placeholder === undefined ? '留空＝不发送' : field.placeholder,
            value: shown,
            onChange: (event) => edit(field, event.target.value),
          })
        }
        if (field.type === 'number') {
          const current = value === undefined || value === null || value === '' ? undefined : Number(value)
          return [
            h('input', {
              ...common,
              key: 'range',
              className: 'arj-range',
              type: 'range',
              min: field.min,
              max: field.max,
              step: field.step,
              value: current === undefined ? field.min : current,
              onChange: (event) => edit(field, Number(event.target.value)),
            }),
            h('span', { key: 'value', className: 'arj-value' }, current === undefined ? '—' : current.toFixed(2)),
          ]
        }
        return h('input', {
          ...common,
          key: 'input',
          className: 'arj-input',
          type: 'text',
          placeholder: field.placeholder === undefined ? undefined : field.placeholder,
          value: value === undefined || value === null ? '' : String(value),
          onChange: (event) => edit(field, event.target.value),
        })
      }

      const row = (field) => {
        const rendered = control(field)
        return h('div', {
          key: keyOf(field),
          className: 'arj-row',
          'data-dirty': dirty(field) ? 'true' : undefined,
        }, [
          h('div', { key: 'label', className: 'arj-label' }, [
            h('span', { key: 'name', className: 'arj-label-name' }, field.label),
            field.hint === undefined ? null : h('span', { key: 'hint', className: 'arj-hint' }, field.hint),
          ]),
          h('div', { key: 'control', className: 'arj-ctl-wrap' }, Array.isArray(rendered) ? rendered : [rendered]),
        ])
      }

      const infoRow = (key, name, hint, text) => h('div', { key, className: 'arj-row' }, [
        h('div', { key: 'label', className: 'arj-label' }, [
          h('span', { key: 'name', className: 'arj-label-name' }, name),
          h('span', { key: 'hint', className: 'arj-hint' }, hint),
        ]),
        h('div', { key: 'control', className: 'arj-ctl-wrap' },
          h('code', { className: 'arj-mono arj-code' }, text)),
      ])

      const card = (group) => h('section', { key: group.id, className: 'arj-card' }, [
        h('header', { key: 'head', className: 'arj-card-head' }, [
          h('h3', { key: 'title', className: 'arj-card-title' }, group.title),
          h('p', { key: 'note', className: 'arj-card-note' }, group.note),
        ]),
        h('div', { key: 'rows', className: 'arj-rows' }, [
          ...FIELDS.filter((field) => field.group === group.id).map(row),
          ...(group.id === 'observability' ? [
            infoRow('audit-path', '审计文件', '每次裁决追加一行 JSONL（随配置变化）',
              String(read(base, ['audit', 'path']) || '~/.dsh/auto-review-audit.jsonl')),
            infoRow('trace-path', '诊断日志', '每阶段一行：boot／enter／skip／exit／error，固定路径',
              TRACE_PATH),
          ] : []),
        ]),
      ])

      const protocol = read(base, ['reviewer', 'protocol'])
      const endpoint = read(base, ['reviewer', 'baseURL'])
        || (protocol === 'systemone' ? 'https://api.siliconflow.cn/v1（默认）' : '会话模型（不外发）')
      const model = read(base, ['reviewer', 'model'])
        || (protocol === 'systemone' ? 'Kev-4b（默认）' : '会话默认模型')
      const keySource = draftOf(SECRET) !== undefined && draftOf(SECRET) !== ''
        ? '本次输入的密钥'
        : read(base, ['reviewer', 'apiKeyEnv'])
          || read(base, ['reviewer', 'apiKeyFile'])
          || '未设置'
      const enabled = valueOf(MASTER) === true
      const chips = [
        { k: '协议', v: protocol === undefined || protocol === null || protocol === '' ? '（默认）' : String(protocol) },
        { k: '模型', v: String(model) },
        { k: '端点', v: String(endpoint) },
        { k: '密钥', v: String(keySource) },
      ]

      return h('div', { className: 'arj' }, [
        StyleTag(),
        h('header', { key: 'head', className: 'arj-head' }, [
          h('div', { key: 'text', className: 'arj-head-text' }, [
            h('h2', { key: 'title', className: 'arj-title' }, '自动审查'),
            h('p', { key: 'sub', className: 'arj-sub' },
              '审批请求在交给人工之前先由 System One 决策 API 裁决：critical 风险永远拒绝，decision 置信度低于阈值强制拒绝。'),
          ]),
          h('div', { key: 'actions', className: 'arj-head-actions' }, [
            h('span', { key: 'state', className: 'arj-state', 'data-tone': enabled ? 'on' : 'off' }, [
              h('i', { key: 'dot', className: 'arj-dot' }),
              enabled ? '已启用' : '已关闭',
            ]),
            control(MASTER),
          ]),
        ]),
        h('div', { key: 'chips', className: 'arj-chips' },
          chips.map((chip, index) => h('span', { key: index, className: 'arj-chip' }, [
            chip.k + '：',
            h('b', { key: 'value' }, chip.v),
          ]))),
        ...GROUPS.map(card),
        h('div', { key: 'info', className: 'arj-info' },
          '外发内容：用户请求、工具参数、执行上下文、工作区与沙箱事实。硅基流动端点若走本地代理常无响应，建议直连（把 api.siliconflow.cn 加入 NO_PROXY）。'),
        h('div', { key: 'bar', className: 'arj-bar' }, [
          pending.length === 0
            ? h('span', { key: 'clean', className: 'arj-bar-note' }, '没有未保存的改动')
            : h('div', { key: 'tags', className: 'arj-dirty-list' }, pending.map((item) =>
              h('span', { key: item.key, className: 'arj-dirty-tag' }, item.label))),
          h('button', {
            key: 'reset',
            className: 'arj-btn',
            type: 'button',
            disabled: busy || pending.length === 0,
            onClick: () => { setDraft({}); setRulesText(null); setNote(null) },
          }, '撤销'),
          h('button', {
            key: 'save',
            className: 'arj-btn arj-btn-primary',
            type: 'button',
            disabled: disabled || pending.length === 0 || !rulesParsed.ok || intProblem !== null,
            onClick: save,
          }, busy ? '保存中…' : pending.length === 0 ? '保存' : '保存 ' + pending.length + ' 项改动'),
          note === null ? null : h('span', {
            key: 'note',
            className: 'arj-bar-note',
            'data-tone': note.tone,
          }, note.text),
        ]),
        readonly
          ? h('p', { key: 'readonly', className: 'arj-empty' }, '当前文档不接受写入：该部署的配置是只读的。')
          : null,
      ])
    }

    function Loading() {
      return h('div', { className: 'arj' }, [
        StyleTag(),
        h('div', { key: 'skeleton', className: 'arj-skeleton' }, [
          h('i', { key: 'a' }), h('i', { key: 'b' }), h('i', { key: 'c' }),
        ]),
        h('p', { key: 'text', className: 'arj-empty' }, '正在读取配置…'),
      ])
    }

    function Unavailable() {
      return h('div', { className: 'arj' }, [
        StyleTag(),
        h('p', { key: 'text', className: 'arj-empty' }, '该配置当前不可用。'),
      ])
    }

    function AutoReviewConfig(props) {
      // A row with no description falls back to this one-liner.
      if (props.view === 'summary') return 'System One 决策 API 审查（硅基流动 Kev-4b ／ TypeSafe Jev）'
      if (props.form === undefined) return h('p', { className: 'arj-empty' }, '该入口的配置未暴露给此客户端。')
      const snap = props.form.state
      if (snap.status === 'loading') return h(Loading, null)
      if (snap.status === 'unavailable') return h(Unavailable, null)
      return h(Editor, { snap, mutate: props.form.mutate })
    }

    return {
      name: 'dsh-auto-review-jev-client',
      inject: ['slots', 'configForms'],
      apply(ctx) {
        // `whileServed` is the documented route for a page that edits a
        // namespace ANOTHER plugin owns (ui-settings README): the registrations
        // run only once the Host actually serves `auto-review`, so a profile
        // that never composed the guardian shows no orphan page, and they are
        // withdrawn if the namespace leaves the describe mirror. The official
        // Plugins-page companions compose it the same way, with `plugins.item`.
        ctx.effect(() => ctx.configForms.whileServed([NS], () => {
          const form = ctx.configForms.get(NS)

          function Section() {
            const [snap, setSnap] = React.useState(() => form.getSnapshot())
            React.useEffect(() => form.subscribe(() => { setSnap(form.getSnapshot()) }), [])
            return h(Editor, { snap, mutate: form.mutate.bind(form) })
          }

          // The real settings page: one entry in `settings.section` ("one
          // settings page per list entry"), beside 通用 / 模型 / 插件 …
          const offSection = ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: ROW_ID,
            order: SECTION_ORDER,
            label: '自动审查',
          }, Section))

          // Secondary entry: the row's configure control on the Plugins page.
          const offRow = ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
            name: 'plugins.row.config',
            key: SLOT_KEY,
          }, AutoReviewConfig))

          return () => { offSection(); offRow() }
        }))
      },
    }
  },
})
