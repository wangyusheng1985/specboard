## Context

参见 `proposal.md`。通知子系统由 `public/notifications.js`、`public/app.js` 与服务端 `/api/v1/lane`、`/api/v1/tasks/:id` 组成。用户在前端授权开启通知后，前端通过 1.2 秒轮询各泳道拉取顶层 20 条活跃任务，通过快照对比版本与 `outcome_state` 发现状态突变并派发系统通知。

## Goals / Non-Goals

**Goals:**
- **消除数据短路与断层**：在后端 `/api/v1/lane` 为每项任务调用 `projectOutcome(row)`，对齐全局状态机语义。
- **全阶段支持**：更新 `notifications.js` 中的 `STAGES` 为 `['Explore', 'Propose', 'Apply', 'MR', 'Archive']`，新增 MR 阶段交付完成与受阻通知分支。
- **即时测试与自检通路**：在用户完成权限授予时主动发送欢迎测试通知；在已授权状态下提供“测试通知”手动触发，消除“到底开没开成功”的不确定性。
- **跨平台兼容图标**：通知参数使用 `/apple-touch-icon.png` 替代 `/favicon.svg`。

**Non-Goals:**
- 不依赖需要额外后台服务器配置的外部第三方 Web Push 服务（保持系统独立与自包含）。
- 不破坏原有通知去重队列（`consumeKey` 与 `localStorage`）的安全性。

## Decisions

### 1. 服务端状态统一派生（Backend Outcome Projection）
- **决策**：在 `src/runtime-api.ts` 的 `/api/v1/lane` 路由中，查询得到 `rows` 后，使用 `rows.map(row => ({ ...row, outcome_state: projectOutcome(row) }))`，确保客户端观察到的任务数据具有完备的 `outcome_state`。
- **备选方案**：在客户端手写推导逻辑。放弃原因：容易导致客户端与服务端状态机规则不一致，服务端统一派生是单点真理源（Single Source of Truth）。

### 2. 前端阶段定义对齐与 MR 覆盖
- **决策**：在 `public/notifications.js` 中将 `STAGES` 常量更新为与 `app.js` 一致的 5 个阶段，并在 `notificationFor` 中覆盖 `current.stage === 'MR'`：
  - 当 `current.outcome_state === 'delivered' && (current.stage === 'Apply' || current.stage === 'MR')` 触发 `apply_delivered` 通知；
  - 当 `current.outcome_state === 'blocked'` 触发 `execution_blocked` 通知。

### 3. 授权完成即时自检反馈
- **决策**：在 `notifications.notifyTest()` 方法中派发一条验证通知：
  - 标题：`Specboard · 浏览器通知已就绪`
  - 内容：`当任务需要回答、方案待确认或实现完成时将在此提醒。`
  - 图标：`/apple-touch-icon.png`
  - 点击时激活窗口并自动聚焦。

## Risks / Trade-offs

- **[Risk] 操作系统级或浏览器防打扰设置静默拦截通知**
  → **Mitigation**：测试通知发送的同时，界面顶部浮动 Toast 提示：“已向系统发送测试通知，若未看到弹窗，请检查操作系统通知设置或免打扰模式”。
