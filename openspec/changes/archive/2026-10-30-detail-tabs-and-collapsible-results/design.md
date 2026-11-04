## Context

详见 `proposal.md`。目前任务详情弹窗把基本信息、诊断、澄清、产物、阶段成果、评论和消息输入框纵向堆积在同一个滚动容器中。随着阶段深入，报告内容动辄几千字，导致页面高度剧增，用户寻找关键信息极不方便。

## Goals / Non-Goals

**Goals:**
- **三 Tab 结构解耦**：
  - `[基本信息 (默认)]`：任务描述、项目信息、当前阶段、未决澄清（如有）、失败诊断（如有）、阶段过程产物（HTML 沙箱预览等）；
  - `[阶段成果]`：按阶段汇总的多卡片成果展示区（MR 状态、tasks.md、各阶段完成的 Runs Markdown 报告）；
  - `[需求互动与反馈]`：用户与 Agent 的历史对话时间线气泡流 + 底部发送指令输入框。
- **阶段成果折叠虚影体验**：
  - 卡片内容区域包裹 `.run-card-collapsible`；
  - 默认加上 `.is-collapsed` 类（`max-height: 135px; overflow: hidden; position: relative`）；
  - 使用伪元素 `::after` 实现底部 `linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 75%, #ffffff 100%)` 虚影；
  - 底部居中放置紧凑按钮 `<button class="card-expand-toggle">展开详情 ↓</button>`；
  - 点击切换 `.is-collapsed`，平滑展开至 `max-height: none`，按钮文本变为 `收起 ↑`。
- **状态维持与平滑轮询**：
  - 保证 Tab 切换时记忆当前选中的 Tab 索引，轮询时不丢失用户的 Tab 切换与折叠展开状态。

**Non-Goals:**
- 不改变任务执行与命令提交的底层逻辑。

## Decisions

### 1. Tab 组件规范设计
- 采用符合 WAI-ARIA 规范的标准结构：
  ```html
  <nav class="detail-nav-tabs" role="tablist">
    <button type="button" role="tab" class="detail-tab-btn active" data-tab="info">基本信息</button>
    <button type="button" role="tab" class="detail-tab-btn" data-tab="results">阶段成果</button>
    <button type="button" role="tab" class="detail-tab-btn" data-tab="interaction">需求互动与反馈</button>
  </nav>
  ```
- 容器使用 `.tab-panel`：
  - `#panel-info` (默认显示)
  - `#panel-results` (hidden)
  - `#panel-interaction` (hidden)

### 2. 折叠卡片与虚影设计
- 虚影高度设计为 `60px`，折叠容器总高 `135px`（约等价于 5 行 13px 行高 1.6 的 Markdown 文字）。
- 点击“展开全部”后移除遮罩与高度限制。
- 如果卡片实际高度小于 160px，自动不显示“展开”按钮，直接全量呈现，避免无谓的操作。

## Risks / Trade-offs

- **[风险] 切换 Tab 时滚动条位置是否需要处理？** → **[缓解措施]** 切换 Tab 时滚动容器 `.drawer-body` 平滑滚动至顶部，让用户从头阅读新面板内容。
