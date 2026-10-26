## Why

当前系统的 5 个看板泳道（Explore, Propose, Apply, MR, Archive）设计偏向简易的原型风格：泳道底色发灰单调、卡片边框阴影生硬、卡片内部排版层级扁平、缺乏独立列滚动与现代空状态卡槽，整体观感与现代主流研发 SaaS 产品（如 Linear、GitLab Boards、GitHub Projects）相比存在明显视觉代差。

为了让 Specboard 具备真正的现代高级 SaaS 研发工作台质感，需要对 5 个泳道的容器结构、头部信息、卡片微质感、拖拽放置与交互动效进行系统级重构。

## What Changes

- **现代 SaaS 风格泳道容器（SaaS Lane Container）**：
  - 采用通透干净的浅雾蓝灰底色（`#f1f5f9`）与极细边框（`rgba(0,0,0,0.06)`）；
  - 引入列内独立平滑滚动（`max-height: calc(100vh - 175px)`），保证首屏视口规整，避免某一列过长破坏全局布局；
  - 自定义精致微型滚动条，避免默认粗滚动条破坏美感。
- **阶段泳道头部质感重构（Lane Header & Badge）**：
  - 泳道标题整合阶段主题色指示环与更具辨识度的阶段命名；
  - 任务数量采用现代胶囊形计数 Badge（Pill Counter），数字居中，视觉清晰精致；
  - 各阶段拥有独立的特征色系统（Explore 靛蓝、Propose 暖金、Apply 翡翠绿、MR 丁香紫、Archive 中性灰）。
- **任务卡片现代设计（Task Card Elevation & Hierarchy）**：
  - 卡片采用纯白表面（`#ffffff`）搭配多层微投影（Soft Multi-layer Elevation），营造悬浮空间层次感；
  - 项目名称集成微型仓库矢量图标，避免单一纯文字；
  - 任务描述标题设置最大行数保护（`-webkit-line-clamp: 3`），长文本优雅省略截断，杜绝布局撑破；
  - 底部状态 Badge 与时间戳精准对齐；
  - 悬停（Hover）呈现柔和流光提升与边框渐变，按下（Active）呈现真实物理微弹动。
- **空状态卡槽与拖拽引导（Empty Slot & Drop Guide）**：
  - 空泳道采用优雅的极浅虚线引导槽，提示“可拖拽任务至此”；
  - 拖拽卡片掠过泳道时，泳道触发深层呼吸蓝色虚线高亮与轻微内发光，给予强烈的放置安全感。
- **分页加载更多按钮现代感改造**：
  - “加载更多”重构为通透的幽灵按钮，悬停柔和变蓝。

## Capabilities

### New Capabilities
- `saas-kanban-lanes`: 为 Specboard 5 泳道看板系统提供现代 SaaS 风格的容器、列内独立滚动、卡片空间微层次、阶段头部与空状态拖拽指引体系。

### Modified Capabilities
<!-- 本次不修改已有规范 -->

## Impact

- **前端展示与样式代码**：
  - `public/style.css`：重构 `.board`、`.lane`、`.cards`、`.card`、`.count` 与空状态样式体系；
  - `public/app.js`：优化 `renderLane` 中卡片的结构输出（项目图标、时间图标与标题结构）及空状态呈现。
- **服务端与 API**：无任何破坏性变更（纯视觉与交互层级优化）。
