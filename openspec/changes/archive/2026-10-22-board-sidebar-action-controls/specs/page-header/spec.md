## MODIFIED Requirements

### Requirement: Page Header Layout and Balance
主工作看板 SHALL 移除冗余的页面级标题文案（“全局工作看板”与“全部项目”），将纵向视口空间完全释放给核心泳道看板区域。

#### Scenario: Heading rendering
- **WHEN** 工作看板页面加载渲染时
- **THEN** 界面主内容区域（`main`）上方不再渲染 `.heading` 标题文案区，视口纵向直接展示 5 泳道看板主体，减少视口占用。

### Requirement: Action Controls Metric and Anti-wrapping Protection
操作控件（刷新与拖拽删除）SHALL 脱离原顶部标题栏，重构为固定在屏幕右侧居中对齐的纯 SVG 浮动工具栏，且垂直排列（刷新在上，垃圾桶在下）。

#### Scenario: Refresh button rendering
- **WHEN** 渲染刷新看板控件（`#refresh`）时
- **THEN** 控件作为右侧居中浮动按钮组的上层项，呈现为具备微投影与背景毛玻璃质感的纯 SVG 按钮，带有旋转动画与“刷新看板”Title 提示。

#### Scenario: Trash zone dimension parity
- **WHEN** 渲染垃圾桶放置区（`#trash-zone`）时
- **THEN** 放置区作为右侧居中浮动按钮组的下层项，尺寸与刷新按钮等宽等高，具备物理开盖微动效与拖拽删除提示，不依赖冗余文字排版。

### Requirement: Refresh Button Feedback Animation
刷新看板操作 SHALL 提供明确的视觉物理响应。

#### Scenario: User clicks refresh
- **WHEN** 用户点击刷新看板按钮时
- **THEN** 按钮内部的刷新图标 SHALL 触发 360 度单圈平滑旋转动画（0.4s），直观表达正在执行数据拉取。
