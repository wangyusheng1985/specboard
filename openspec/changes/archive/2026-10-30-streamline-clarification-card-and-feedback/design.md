## Context

详见 `proposal.md`。当前详情弹窗中，无论任务是否已经回答澄清并探索完成，`.detail-card` 都以大标题“待你确认”常驻首屏，内部嵌套已回答完毕的“问答记录”以及“补充信息”表单，占据超过 300px 纵向高度，严重挤占了下游“阶段过程产物”（交互式原型、架构图）和“阶段成果”的展示空间，并给用户产生“到底还要我确认什么”的严重困惑。

## Goals / Non-Goals

**Goals:**
- 实现澄清卡片的“按需可见，无问即隐”（Contextual Visibility）：仅在 `batches.some(b => b.stage === viewStage && b.status === 'pending')` 时展示 `#clarification-card`，其余情况自动隐藏（`hidden = true`）。
- 将用户消息发送表单（`#message-form`）从澄清卡片中完全剥离，成为独立的微交互卡片（`#feedback-card`，标题为“补充需求与反馈”），放置在阶段成果区下方或底部，去除“待你确认”误导语义。
- 历史问答沉淀：将已解决的问答作为决策记录在阶段成果详情或历史线程中展示，不占首屏。
- 释放首屏给“阶段过程产物”（`#artifacts-card`）与“阶段成果”，让用户打开已完成的探索任务时第一眼看到产出的原型和分析。

**Non-Goals:**
- 不改变 `/api/v1/clarifications/:id/answers` 或草稿保存的底层接口契约。
- 不影响消息发送 `api('/api/v1/tasks/:id/commands', {type:'message', ...})` 的底层调度与恢复逻辑。

## Decisions

### 1. 澄清卡片与消息表单物理结构拆分
- **原有结构**：
  ```html
  <section class="detail-card">
    <div class="detail-card-head"><h3>待你确认</h3><span id="clarification-status"></span></div>
    <div class="detail-card-body">
      <div id="clarification-content"></div>
      <form id="message-form">...</form>
    </div>
  </section>
  ```
- **重构后结构**：
  ```html
  <!-- 仅在有待回答问题时展示，无问题时 hidden -->
  <section class="detail-card" id="clarification-card" hidden>
    <div class="detail-card-head">
      <h3>待你确认</h3>
      <span id="clarification-status" role="status"></span>
    </div>
    <div class="detail-card-body" id="clarification-content"></div>
  </section>

  <!-- 阶段过程产物 (有产物时自动呈现) -->
  <section class="detail-card" id="artifacts-card" hidden>...</section>

  <!-- 阶段成果与记录 -->
  <section class="detail-card" id="results-card">...</section>

  <!-- 独立的补充信息交流栏 -->
  <section class="detail-card" id="feedback-card">
    <div class="detail-card-head"><h3>补充需求与反馈</h3></div>
    <div class="detail-card-body">
      <form id="message-form">
        <label><textarea name="text" rows="2" required placeholder="在此输入补充说明、新约束或调整指令，系统将保留上下文继续执行…"></textarea></label>
        <div class="actions"><button class="primary">发送指令</button></div>
      </form>
    </div>
  </section>
  ```

### 2. 状态驱动的澄清卡片显隐逻辑（`renderClarifications`）
- 在 `public/app.js` 中：
  ```javascript
  const pendingBatch = history.find(b => b.status === 'pending');
  const card = $('#clarification-card');
  if (card) {
    card.hidden = !pendingBatch || !editable;
  }
  ```
- 当 `pendingBatch` 存在时才展开卡片，渲染单选、多选、文本及“提交并继续”按钮；
- 当没有待答批次时，卡片彻底隐藏，不占用任何 DOM 空间。

## Risks / Trade-offs

- **[风险] 用户若想查阅之前选了哪个方案怎么看？** → **[缓解措施]** 在阶段成果的 Agent 摘要和历史记录中均完整包含了 Agent 采纳的方案结论（例如 `收到您的明确决策！采用方案 A...`）；且历史问答记录在澄清卡片隐藏后仍作为不可变快照保存在服务端并可通过日志/成果流随时回溯。
