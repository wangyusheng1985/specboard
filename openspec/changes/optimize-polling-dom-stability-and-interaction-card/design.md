## Context

详见 `proposal.md`。现有实现中，`setInterval(..., 1200)` 在详情打开时以 1.2s 频率无条件发起 13 个接口请求，并在每次返回时无脑对 `#runs` 和 `#comments-thread` 调用 `replaceChildren()`，导致用户正在选中的文字因 DOM 节点被销毁而自动丢失，同时高频刷屏网络接口。此外，“用户交互与评论”错置在阶段成果卡片内，各层级字号未经严格比例校准。

## Goals / Non-Goals

**Goals:**
- **彻底保护用户文本选区**：引入 `runsSignature` 与 `commentsSignature` 脏检查，数据不变时严格不碰 DOM，文字选中绝不丢失。
- **大幅降低接口并发与频次**：根据任务是否 active（`running`/`queued`）将轮询间隔调整为 2.5s（执行中）与 8s（非活跃），弹窗打开时暂停 `observeVisibleLaneTasks()` 5 泳道并发请求。
- **架构归位**：将 `#comments-thread` 与 `#message-form` 共同封装进独立的“需求互动与补充反馈”卡片（`#feedback-card`）。
- **SaaS 严谨字号层级**：卡片标题（13.5px~14px）、小节标题（13px~13.5px）、Markdown 标题与正文（13px~14px，行高 1.6）、评论文本（13px）、元数据（11.5px tnum）。

**Non-Goals:**
- 不改变消息发送与任务推进的后端 API 接口契约。

## Decisions

### 1. 签名防重算法（Memoization Signatures）
- `runsSignature`: `selected.id + ':' + viewStage + ':' + completedRuns.map(r => r.id + ':' + r.status + ':' + (r.summary?.length||0) + ':' + (r.result?.length||0) + ':' + (r.ended_at||r.started_at||0)).join('|')`
- `commentsSignature`: `selected.id + ':' + userEvents.map(e => e.id + ':' + e.created_at + ':' + (e.payload?.text?.length||0)).join('|')`
- 仅当当前签名与上一轮签名不一致时，才执行 DOM 节点重建与 Markdown 解析，其余时刻 0 重绘。

### 2. 动态轮询间隔调度
- 替换固定 1.2s 的 `setInterval`，改用自适应 `setTimeout` 递归调度：
  - 若 `selected` 存在且状态为 `running` 或 `queued`：下一次轮询延时 2500ms；
  - 若 `selected` 存在但处于等待或完成状态：下一次轮询延时 8000ms；
  - 若无详情打开且未聚焦：延时 3000ms；
  - 用户触发关键交互（发送消息、点击推进、手动点击刷新按钮）时，立即触发即时轮询并不等待定时器。

## Risks / Trade-offs

- **[风险] 状态变化时延迟 2.5 秒用户是否感知缓慢？** → **[缓解措施]** 所有用户主动操作（发送指令、推进、停止）均在完成后立即调用 `await updateDetail()` 进行即时刷新，无需等待后台定时器。
