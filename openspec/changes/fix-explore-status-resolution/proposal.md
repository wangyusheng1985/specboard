## Why

在当前系统设计中，当任务在 Explore 阶段运行结束或用户提交了澄清回答被消费后，由于底层将 Explore 完成状态粗粒度硬编码为 `clarifying`，且前端状态映射在第一行无条件拦截 `outcome_state === 'clarifying'` 返回“待你澄清”，导致用户在已经回答完所有问题且右上角推进按钮已就绪可用的情况下，看板泳道卡片与详情页头部徽标依然永久显示为“待你澄清”，给用户造成严重的认知困惑与“系统是否未接收到答案”的误解。

同时，浏览器通知在任务更新时若检测到 `outcome_state === 'clarifying'`，会误触发“需要你的回答”通知，导致用户在没有问题需要回答时遭受无效弹窗打扰。因此必须彻底解耦“真实等待澄清回答”与“探索已完成待推进”的状态判定与呈现。

## What Changes

- **精细化前端任务状态展示逻辑**：重构 `public/task-status.js` 中的 `taskStatusLabel` 与 `taskStatusClass`。仅在任务处于 `wait_reason === 'clarification_required'` 或 `status === 'awaiting_answers'` 时呈现“待你澄清 / 等待回答”；当任务处于 Explore 阶段且 `status === 'waiting_input'`（或 `completed`）但 `wait_reason !== 'clarification_required'` 时，明确呈现为“探索完成 · 待推进”，赋予正常就绪样式。
- **校准浏览器通知触发准则**：在 `public/notifications.js` 中优化 `notificationFor`，仅当 Explore 任务真正因未决澄清处于 `wait_reason === 'clarification_required'` 且状态变化时才触发 `clarification_required`（“需要你的回答”）通知，避免探索正常结束待推进时误发催答通知。
- **完善自动化测试覆盖**：在 `test/task-status.test.ts` 与 `test/notifications.test.ts` 中补充 Explore 阶段“已消费澄清/无待答澄清”时的状态标签、CSS 类目以及通知抑制测试。

## Capabilities

### Modified Capabilities
- `saas-kanban-lanes`: 修正 Explore 阶段任务卡片与详情状态徽标，区分真实待回答的“待你澄清”与探索完成无未决问题时的“探索完成 · 待推进”。
- `browser-notifications`: 仅在任务处于真实需要用户回答的澄清状态时触发桌面通知，抑制探索完成待推进时的多余通知。

## Impact

- 前端状态模块：`public/task-status.js`
- 浏览器通知模块：`public/notifications.js`
- 自动化测试用例：`test/task-status.test.ts`, `test/notifications.test.ts`
- 契约兼容性：完全向下兼容既有后端状态机与数据库数据，零破坏性变更。
