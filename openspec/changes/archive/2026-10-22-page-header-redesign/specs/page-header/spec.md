## Purpose

为 Specboard 主工作看板页头区域提供精确的组件度量标准、防字符折行控制、左右视觉均衡性保障以及轻量级交互动效响应。

## ADDED Requirements

### Requirement: Page Header Layout and Balance
主工作看板页头（`.heading`）SHALL 采用紧凑且视觉均衡的水平单行对齐布局，消除多余堆叠，同时避免单薄空旷。

#### Scenario: Heading rendering
- **WHEN** 工作看板页面加载渲染时
- **THEN** 界面左侧主标题与所属范围胶囊标签水平居中对齐，与右侧操作按钮处于同一水平基准线，且页头总占用高度不超过 48px。

### Requirement: Action Controls Metric and Anti-wrapping Protection
操作区的所有按钮及拖拽放置区 SHALL 具备严格的几何尺寸、SVG 图标约束以及强制单行防折行保护。

#### Scenario: Refresh button rendering
- **WHEN** 渲染刷新看板按钮（`#refresh`）时
- **THEN** 按钮高度 SHALL 严格固定为 40px，内嵌矢量 SVG 限制为 14px × 14px，按钮文本保持 `white-space: nowrap` 单行呈现，杜绝出现多行或竖排。

#### Scenario: Trash zone dimension parity
- **WHEN** 渲染垃圾桶放置区（`#trash-zone`）时
- **THEN** 放置区高度 SHALL 与相邻的刷新按钮严格等高（40px），确保水平基线一致。

### Requirement: Refresh Button Feedback Animation
刷新看板操作 SHALL 提供明确的视觉物理响应。

#### Scenario: User clicks refresh
- **WHEN** 用户点击刷新看板按钮时
- **THEN** 按钮内部的刷新图标 SHALL 触发 360 度单圈平滑旋转动画（0.4s），直观表达正在执行数据拉取。
