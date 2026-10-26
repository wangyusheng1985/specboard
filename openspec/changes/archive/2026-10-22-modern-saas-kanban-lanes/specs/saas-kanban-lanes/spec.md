## Purpose

为 Specboard 提供符合现代专业级 SaaS 标准的 5 泳道看板系统，包含轻盈通透的泳道容器、列内独立平滑滚动、丰富的信息层级卡片、阶段特征识别度及高质感空状态引导。

## ADDED Requirements

### Requirement: Modern SaaS Lane Container and Independent Scrolling
看板的 5 个阶段泳道 SHALL 具备清晰现代的卡槽容器外观，并支持列内独立纵向平滑滚动。

#### Scenario: Multi-lane board presentation
- **WHEN** 工作看板展示 5 个阶段（Explore, Propose, Apply, MR, Archive）时
- **THEN** 每个泳道 SHALL 具备柔和通透的浅灰底色（`#f1f5f9`）与独立纵向滚动区（限制高度不超过视口高度），保证所有泳道顶部在页面上保持齐平，单列超长不影响全局视口。

### Requirement: Lane Header Hierarchy and Phase Accents
每个阶段泳道的头部 SHALL 具备高识别度的阶段色彩、中英文语义指引与药丸形计数 Badge。

#### Scenario: Lane header rendering
- **WHEN** 泳道头部渲染时
- **THEN** 头部 SHALL 呈现阶段专属主题色圆环、阶段名称、以及居右的现代药丸形计数标签（Pill Badge），且当有更多任务可加载时展示加号指示。

### Requirement: Elevated Task Card with Text Clamping
任务卡片 SHALL 具备纯白微浮表面、多层软阴影、微型项目图标及文本行数溢出保护。

#### Scenario: Task card rendering
- **WHEN** 泳道内渲染任务卡片时
- **THEN** 卡片 SHALL 采用纯白底色（`#ffffff`）、柔和多层微投影；卡片顶部展示带代码仓库图标的项目标签，标题限制最多展示 3 行（超出截断以防布局破坏），底部整齐排列状态指示徽标与日期。

#### Scenario: Task card hover and active state
- **WHEN** 用户将鼠标悬停在任务卡片上或点击卡片时
- **THEN** 悬停时卡片边框渐变为品牌蓝、投影提升并在 0.2s 内微浮（`translateY(-2px)`）；按下时触发微缩放弹性反馈（`scale(0.99)`）。

### Requirement: Empty State Drop Guide
没有任务的空泳道 SHALL 呈现现代 SaaS 风格的虚线卡槽引导。

#### Scenario: Empty lane rendering
- **WHEN** 某一泳道内暂无任务时
- **THEN** 泳道内 SHALL 呈现轻浅虚线卡槽（Dashed Slot），清晰提示无任务或可拖拽放置至此。

#### Scenario: Dragging card over empty or populated lane
- **WHEN** 用户拖拽任务卡片滑过某一泳道上方时
- **THEN** 泳道边框与背景 SHALL 呈现柔和蓝色呼吸发光与轻微内嵌提升，给予直观的吸附放置暗示。
