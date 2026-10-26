## Why

用户在前端开启了系统浏览器通知，新建了一个任务后，任务在经过 Agent 调研后进入了“待你澄清”状态，但用户未收到任何 Chrome 浏览器桌面通知。

经过系统性排查，根本原因由两部分组成：
1. **服务端状态机在运行完成更新时遗漏了 `outcome_revision = outcome_revision + 1`**：在 `src/runtime-service.ts` 的 `complete(...)` 中，当 Agent 运行完成并更新 `outcome_state`（如从 `executing` 更新为 `clarifying` 或 `awaiting_proposal_approval`）时，SQL 中仅更新了 `status`, `outcome_state`, `summary`, `updated_at`，而**遗漏了递增 `outcome_revision`**。
2. **前端轮询详情状态覆盖与观察时序错位**：当任务详情抽屉（`#detail-dialog`）打开时，1.2 秒的周期轮询执行 `updateDetail()` 并调用 `observeVisibleLaneTasks()`。如果前端先前未缓存过初始快照，或者状态变更未引起 `version` 或 `outcome_revision` 递增，通知比较器 `notificationFor(prior, current)` 就会因为状态版本未变化或首次进入无基线而直接返回 `null`，导致通知完全漏发。

## What Changes

- **服务端状态变更版本递增 (`src/runtime-service.ts`)**：
  - 在 `complete(...)` 方法的 `UPDATE tasks` SQL 语句中，显式追加 `outcome_revision = outcome_revision + 1`，确保每次运行结束导致结果状态演进时，严格递增版本号，向所有订阅客户端（SSE、轮询、通知观察器）发射强烈的状态跃迁信号。
- **通知观察器基线首次感知策略优化 (`public/notifications.js`)**：
  - 检查 `notificationFor(previous, current)`：除了针对有 `previous` 的状态跃迁，针对进入系统首次观察到的且已处于关键待办状态（如 `clarifying`、`awaiting_proposal_approval`、`blocked`、`delivered`）的任务，如果尚未被通知过（未消费通知 key），允许触发即时通知提醒，避免“用户刷新页面后刚好任务处于待澄清状态却永远不再提醒”的痛点。
- **通知 Key 细化防重**：
  - 通知 Key 结合 `task.id`、`task.stage`、`task.outcome_state`、`task.outcome_revision`，保证每轮澄清恰好提醒一次，不重复轰炸。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `browser-notifications`: 规范任务状态演进（包括 Explore 阶段调研完成进入澄清）触发系统桌面通知的完整性与及时性保障契约。

## Impact

- **服务端**：`src/runtime-service.ts`，修复状态完成更新的 `outcome_revision` 递增。
- **前端通知逻辑**：`public/notifications.js`，完善状态变更通知触发与首轮状态提醒。
- **自动化测试**：`test/notifications.test.ts`、`test/runtime-api.test.ts`。
