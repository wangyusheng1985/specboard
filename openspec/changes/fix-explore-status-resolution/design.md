## Context

详见 `proposal.md`。Explore 阶段在服务端状态机中，当 Run 执行完成时，`tasks.status` 变更为 `waiting_input`，而由于早期模型简化，`tasks.outcome_state` 被固定记录为 `clarifying`。当存在待回答问题时，`wait_reason` 会被置为 `clarification_required`；而当用户提交回答被消费或无需提问时，`wait_reason` 为 `NULL`。

前端 `public/task-status.js` 目前在第一行根据 `outcome_state === 'clarifying'` 一刀切直接返回“待你澄清”，导致无法展示“探索完成 · 待推进”，造成逻辑遮蔽。

## Goals / Non-Goals

**Goals:**
- 准确解耦“真实需要回答澄清”与“探索完成就绪推进”的前端语义表达。
- 在 `public/task-status.js` 中重构状态映射函数，支持 `task.wait_reason` 与 `stage` 联合判定。
- 在 `public/notifications.js` 中将澄清类系统通知触发条件严格约束为真实存在 `clarification_required`。
- 零数据库迁移，零后端 API 契约破坏，保证向下完全兼容既有存储数据。

**Non-Goals:**
- 不变更 PostgreSQL `tasks` 表既有字段与行锁租约机制。
- 不影响 Propose、Apply、MR、Archive 阶段既有的状态流转契约。

## Decisions

### 1. 显式结合 `wait_reason` 消除前端拦截遮蔽
- **决策**：在 `public/task-status.js` 的 `taskStatusLabel` 中：
  ```javascript
  if(task.outcome_state==='clarifying'){
    if(task.wait_reason==='clarification_required'||task.status==='awaiting_answers'){
      return '待你澄清';
    }
    if(task.stage==='Explore'&&(task.status==='waiting_input'||task.status==='completed')){
      return '探索完成 · 待推进';
    }
    return '待你澄清';
  }
  ```
- **理由**：既有后端架构在运行时已正确维护 `wait_reason`（在提问时设为 `clarification_required`，在消费答案时清除为 `NULL`）。结合该真实字段即可完全区分两种状态，无需改动复杂的状态迁移 SQL。
- **替代方案考虑**：
  - *修改数据库 tasks.outcome_state 为新的枚举值（如 'explored'）*：需要修改数据库约束、状态转换枚举、旧数据回填与所有测试桩，成本高且影响面过大。

### 2. 状态胶囊色彩与交互映射适配
- **决策**：在 `taskStatusClass` 中，仅当 `task.wait_reason === 'clarification_required'` 时呈现 `status-waiting`（琥珀黄色预警）；当探索完成待推进（`wait_reason !== 'clarification_required'`）时，映射为 `status-delivered` 或 `status-waiting` 中的平和态，避免产生错误的操作紧迫感。

### 3. 浏览器通知触发精确化
- **决策**：在 `public/notifications.js` 的 `notificationFor` 中，当 `current.outcome_state === 'clarifying'` 时，仅当 `current.wait_reason === 'clarification_required'` 才返回 `clarification_required`，否则返回 `null`。
- **理由**：避免当 Explore 阶段运行完毕（`outcome_revision` 增加）时向用户手机或桌面误推送“需要你的回答”。

## Risks / Trade-offs

- **[风险] 旧版单元测试对 `taskStatusLabel({outcome_state: 'clarifying'})` 有断言** → **[缓解措施]** 在 `test/task-status.test.ts` 中补充带有/不带有 `wait_reason` 的不同用例，当仅传入 `{outcome_state: 'clarifying'}` 且无其他上下文时维持兜底返回“待你澄清”，保证既有基础断言兼容。
