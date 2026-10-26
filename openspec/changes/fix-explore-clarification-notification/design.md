## Context

参见 `proposal.md`。当前系统在新建任务进入 Explore 阶段时，状态先由 `enqueue` 置为 `outcome_state='executing', outcome_revision=1`。当 Agent 运行完成调用 `complete(...)` 时，更新语句为：
```sql
UPDATE tasks SET status=$2, outcome_state=$5, summary=$3, updated_at=$4 WHERE id=$1
```
遗漏了 `outcome_revision = outcome_revision + 1`。导致此时虽然 `outcome_state` 由 `executing` 变更为 `clarifying`，但 `outcome_revision` 依然停留在 `1`。
同时，在客户端轮询和初次页面建立快照时，若任务在初始快照之前就已经进入了 `clarifying`，`notificationFor(previous, current)` 因 `!previous` 返回 `null`，导致该待办通知丢失。

## Goals / Non-Goals

**Goals:**
- **服务端结果更新严格版本化**：
  - 在 `src/runtime-service.ts` 的 `complete(...)` 中增加 `outcome_revision = outcome_revision + 1`。
- **客户端通知监听器全覆盖**：
  - 在 `public/notifications.js` 中优化 `notificationFor`：
    - 维持状态转移校验：`previous.outcome_state !== current.outcome_state || previous.outcome_revision !== current.outcome_revision`；
    - 针对首次观察到的任务（`previous === undefined`），若已处于行动待办状态（`clarifying`、`awaiting_proposal_approval`、`blocked`、`delivered`），同样生成对应通知类型，由幂等性 `consumeKey` 决定是否发射通知，彻底杜绝首轮漏发。

## Decisions

### 1. 服务端 `complete` SQL 修复
- **决策**：
  ```sql
  UPDATE tasks SET status=$2, outcome_state=$5, summary=$3, updated_at=$4, outcome_revision=outcome_revision+1 WHERE id=$1
  ```
  这样从 `executing` 到 `clarifying`，`outcome_revision` 从 1 递增至 2，版本发生明确跃迁。

### 2. 客户端通知生成算法调整
- **决策**：
  在 `notificationFor(previous, current)` 中：
  ```javascript
  if (!STAGES.includes(current.stage)) return null;
  // 首次观察到的任务或状态发生变化的任务
  const isTransition = previous && (
    previous.outcome_state !== current.outcome_state ||
    previous.outcome_revision !== current.outcome_revision ||
    previous.version !== current.version
  );
  const isFirstActionable = !previous && ['clarifying', 'awaiting_proposal_approval', 'blocked', 'delivered'].includes(current.outcome_state);
  if (!isTransition && !isFirstActionable) return null;
  ```
  配合持久化 `consumeKey`（保存在 localStorage 中的消费队列），已经提醒过的任务绝对不会重复弹窗，而真正需要用户处理的通知绝不漏发。

## Risks / Trade-offs

- **[Risk] 用户刷新页面时是否会弹出一批旧通知？**
  → **Mitigation**：不会，因为所有已触发过的通知都根据 `notificationKey`（包含了 `task.id`, `task.stage`, `task.version`, `task.outcome_revision`, `type`）记录在浏览器的 `localStorage` 中（`consumeKey`）。只有尚未提醒过的全新版本才会触发弹窗。
