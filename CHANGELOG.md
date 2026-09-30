# 变更记录

本项目 fork 自 [`gbthui/dsh-auto-review`](https://github.com/gbthui/dsh-auto-review)，以下只记录本 fork 相对上游的改动。

## 0.2.0-jev.0 — 2026-09-30

### 新增

- **`reviewer.protocol: systemone`**：一次审查变成一次 System One 决策 API 调用（`POST {baseURL}/systemone`），并行提出 `decision` 与 `risk` 两个 choice 问题；返回的结构化答案被合成为与 chat 路径完全相同的裁决 JSON，并走同一套严格解析。可选后端：TypeSafe Jev（`https://api.typesafe.ai/v1` + `jev-latest`）、硅基流动（`systemone`，默认 `Kev-4b`）、自部署 Laya（回环地址，免 key）。
- **`reviewer.systemone.confidenceThreshold`**：低于阈值的决策答案不予采信；置信度按 `|p(allow) − 0.5| × 2` 计算。
- **`policy.onLowConfidence: deny | defer`**：不可采信的结论要么失败关闭（`deny`，默认），要么落回人工审批（`defer`，审计记 `source=reviewer-low-confidence`）。
- **`policy.allowRules` + `policy.allowDangerFullAccessRules`**：按 `{ tool, operations[], escalationTarget }` 精确预批，命中即跳过审查器；因此 escalation 规则必须钉住操作前缀，无沙箱放行保持显式 opt-in。
- **设置页编辑器**：reviewer 与 policy 字段（置信度阈值、低置信度动作、免审白名单）都可在 Web 设置页编辑。
- **每次请求的 trace**：`~/.dsh/auto-review-trace.jsonl` 记录这次请求由谁裁决、端点与模型，以及被跳过的原因。
- **冒烟套件**：`test/smoke/` 五个零依赖套件（模块与导出、答案裁决、消息来源准入、trace 落盘、前端契约），直接跑构建产物 `lib/`。

### 修复

- **拒绝通知写坏会话**：旧写法注入的消息来源是 `{ kind: 'plugin', … }`，v4 会话格式会以 `format v4 message requires a producer-owned source kind` 拒绝写入，导致一次拒绝之后会话不可用。现在通知与注入消息统一携带 `plugin:dsh-auto-review`（见 `src/meta.ts`），并补上了使用真实 `inject()` 的回归套件。
- `package.json` 元数据改为指向本仓库；npm scripts 不再引用 fork 中不存在的文件；`test/systemone.test.ts` 的导入路径已可在仓库内解析。
