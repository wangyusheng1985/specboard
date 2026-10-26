## Context

参见 `proposal.md`。现有 `#detail-dialog` 包含两块巨大的头部卡片：
1. `阶段流程`（五个阶段的 tab 按钮组成的 `stage-flow` 卡片）；
2. `任务操作`（包含版本元信息、停止按钮、方案确认按钮、下一阶段按钮的 `task-toolbar` 卡片）。

这两张卡片占用了顶部超过 220px 的纵向空间，使用户打开弹窗后必须大幅向下滚动才能看到过程产物、提问和实施内容。由于各任务所处阶段在泳道卡片上已经一目了然，此流程卡片纯属冗余。

## Goals / Non-Goals

**Goals:**
- **彻底精简头部冗余**：
  - 从 `public/index.html` 移除独立的“阶段流程”大卡片（`#stage-tabs`）和“任务操作”大卡片（`.task-toolbar`）；
  - 将元信息（项目、阶段、状态）精简为单行集成在头部标题上方。
- **两枚优雅的 SVG 语义操作按钮置顶**：
  - 将操作集中放置在 `.drawer-head` 的右上区域（与右上关闭按钮 `×` 组合为 `.detail-head-actions`）：
    - **按钮 1：停止 / 取消 (Stop Button)**：
      - SVG 停止/终止图标（`<rect x="4" y="4" width="16" height="16" rx="2.5"/>`）；
      - 仅在任务处于活跃态（`running` / `queued` / `waiting_input`）时高亮激活，红色警示 Hover 态；非活跃态自动置灰禁用。
    - **按钮 2：自适应推进 / 确认 / 重试 (Primary Action Button)**：
      - 结合上下文语义动态呈现：
        - 方案待审批时：展示 Checkmark 确认图标 + “确认方案并开始执行”；
        - 可推进至下一阶段时：展示 Arrow Right 图标 + “进入下一阶段”；
        - 运行中（Apply/MR）：展示 Stop-Archive 图标 + “停止并归档”；
        - 执行受阻时：展示 Refresh/Retry 图标 + “重试当前阶段”。
- **释放超过 200px 黄金首屏阅读高度**：
  - 弹窗打开后直接呈现“阶段过程产物”（Demo 原型/总结）与“阶段成果”，极大提升阅读流畅度。

**Non-Goals:**
- 不改变底层状态机推进逻辑与接口契约（继续复用 `api(...)` 的 transition / approveProposal / command 控制流）。

## Decisions

### 1. 头部布局结构设计
- 在 `public/index.html` 中调整 `.drawer-head` 结构：
```html
<div class="drawer-head detail-drawer-head">
  <div class="detail-head-meta">
    <div class="detail-meta-line">
      <span class="eyebrow" id="detail-project"></span>
      <span id="detail-status-badge" class="badge"></span>
    </div>
    <h2 id="detail-title"></h2>
  </div>
  <div class="detail-head-actions">
    <button id="detail-stop-btn" class="detail-action-btn danger" type="button" title="停止执行" aria-label="停止执行" disabled>
      <svg class="action-svg" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
      <span>停止</span>
    </button>
    <button id="detail-advance-btn" class="detail-action-btn primary" type="button" title="推进" aria-label="推进">
      <svg class="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      <span id="detail-advance-label">下一阶段</span>
    </button>
    <button class="icon-button" data-close aria-label="关闭任务详情">×</button>
  </div>
</div>
```

### 2. 状态映射逻辑重构
- 在 `public/app.js` 的 `updateDetail()` 中，直接将原 `approveButton`、`advanceButton`、`data-control="stop"` 的逻辑映射到 `detail-advance-btn` 与 `detail-stop-btn`；
- `viewStage` 默认与当前任务 `task.stage` 保持一致，无需用户手动在五个 tab 间切换。

## Risks / Trade-offs

- **[Risk] 用户若想查看历史阶段的记录怎么办？**
  → **Mitigation**：所有 completedRuns 依然在底部的“阶段执行完成”列表按时间倒序排列展示；同时当前阶段 Process Artifacts 会展示最新产物，完全满足使用需要，且大幅减少操作层级。
