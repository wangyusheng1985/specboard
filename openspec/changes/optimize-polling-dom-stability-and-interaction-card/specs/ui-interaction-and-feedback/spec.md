## ADDED Requirements

### Requirement: DOM Signature Memoization and Text Selection Preservation
任务详情弹窗在后台轮询刷新时 SHALL 进行数据签名脏检查，当数据未发生实质性变化时，SHALL 跳过 DOM 节点重建，保护用户的文本选区与滚动状态。

#### Scenario: Detail polling with unchanged data
- **WHEN** 后台轮询返回的任务执行报告（Runs）或评论流（Comments）数据与当前渲染状态签名一致时
- **THEN** 系统 SHALL 严格跳过 DOM 节点的清空与重建（不执行 `replaceChildren`），确保用户当前选中的文本选区不被取消，页面不发生闪烁。

### Requirement: Adaptive State-Aware Polling
看板与任务详情的后台轮询 SHALL 根据任务状态自适应调整频率，并在详情打开时挂起无关的泳道全量监听请求。

#### Scenario: Polling frequency adaptation
- **WHEN** 任务处于活跃执行状态（`running` 或 `queued`）时
- **THEN** 系统 SHALL 以约 2.5 秒的间隔进行详情轮询；
- **WHEN** 任务处于非活跃状态（如探索完成待推进、方案待确认、已完成或已停止）时
- **THEN** 系统 SHALL 将轮询间隔降频至约 8~10 秒，并在详情弹窗打开期间挂起 5 个泳道的全量列表请求。

### Requirement: Unified Interaction and Feedback Card
用户历史交互评论与补充信息输入框 SHALL 整合在同一个独立卡片中，形成时间线对话与输入闭环。

#### Scenario: Interaction card layout
- **WHEN** 渲染任务详情弹窗时
- **THEN** “用户交互与评论” SHALL 从“阶段成果”卡片中迁出，与“发送消息输入框”共同放置于独立的“需求互动与补充反馈”卡片（`#feedback-card`）中，历史评论在上方以时间线呈现，输入框在下方。

### Requirement: Consistent Typography Scale
任务详情弹窗内各层级标题与正文 SHALL 遵循统一的 SaaS 字号比例规范，消除字号过大或比例失调。

#### Scenario: Typography rendering
- **WHEN** 渲染详情卡片标题、小节标题、元信息及 Markdown 正文时
- **THEN** 卡片主标题字号 SHALL 限制在 13.5px~14px（650 字重），小节标题限制在 13px~13.5px（600 字重），Markdown 正文限制在 13px（行高 1.6），元信息限制在 11.5px 并启用等宽数字（`tnum`）。
