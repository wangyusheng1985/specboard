# header-navigation Specification

## Purpose
为 Specboard 顶部全局导航栏提供清晰统一的视觉层次结构、语义化功能分组、实时工作区连接状态指示、全量矢量图标集成以及自适应防折行保护。

## Requirements

### Requirement: Navigation Hierarchy and Semantic Grouping
系统顶部导航栏 SHALL 划分为工作区连接状态组、辅助设置与文档工具组、以及创建任务核心主操作组，建立清晰的视觉层级。

#### Scenario: Visual separation of navigation groups
- **WHEN** 页面头部导航栏渲染时
- **THEN** 界面 SHALL 在工作区连接状态、设置与文档辅助工具组、以及“创建任务”主按钮之间建立明确的视觉区分与合理间距，确保核心主操作具有最高的视觉权重。

### Requirement: Workspace Connection Indicator
连接控制项 SHALL 同时充当当前工作空间连接健康度的实时状态指示器。

#### Scenario: Workspace is connected
- **WHEN** 用户已成功连接到工作空间时
- **THEN** 连接按钮 SHALL 显示绿色微光圆点指示符与“已连接”标签，点击后可断开连接。

#### Scenario: Workspace is disconnected
- **WHEN** 用户未连接到工作空间时
- **THEN** 连接按钮 SHALL 显示灰色指示符与“未连接 / 连接”标签，点击后呼出连接抽屉。

### Requirement: Consistent Vector Icons for Navigation Controls
所有导航栏控制项 SHALL 统一集成特定语义的矢量 SVG 图标，杜绝字体图标缺失或尺寸不一。

#### Scenario: Navigation icon rendering
- **WHEN** 渲染项目配置、LLM 配置、浏览器通知及 API 文档控制项时
- **THEN** 系统 SHALL 为每个控制项渲染尺寸统一（14px~16px）、风格一致且垂直居中对齐的矢量 SVG 图标，且所有图标 SHALL 标记 `aria-hidden="true"`。

#### Scenario: External API documentation link interaction
- **WHEN** 用户鼠标悬停在“API 文档”控制项上时
- **THEN** 控制项内的斜向外链矢量图标 SHALL 在 180ms 内产生平滑的右上微位移（`translate(1px, -1px)`），明确提示外部跳转意图。

### Requirement: Primary Action Anchor
“创建任务”作为系统最核心的操作入口，SHALL 具备高度显著性与视觉锚点。

#### Scenario: Primary create task button presentation
- **WHEN** 头部导航栏完整呈现时
- **THEN** “创建任务”按钮 SHALL 采用 Primary 强调主题色，左侧集成矢量加号图标，并与其他次级设置按钮保持明确的间隙与样式隔离。

### Requirement: Overflow and Word Wrapping Protection
导航栏内部的所有按钮与链接文字 SHALL 受到抗挤压保护。

#### Scenario: Viewport resizing
- **WHEN** 浏览器视口宽度变化时
- **THEN** 所有导航项文本 SHALL 保持 `white-space: nowrap` 单行呈现，严禁单个控制项内部发生字符折行或形状畸变。

### Requirement: Workspace Mode Switching
系统顶部全局导航栏 SHALL 提供高辨识度的“工作模式 / 会话模式”顶层切换控制器，允许用户在研发任务看板流水线与即时智能对话视口之间自由切换。

#### Scenario: Switching from Work Mode to Chat Mode
- **WHEN** 用户在顶部导航栏点击“会话模式”切换项时
- **THEN** 界面主视口 SHALL 平滑切换为即时会话视图，隐藏任务看板泳道与阶段流水线组件，同时保持导航栏全局配置与连接状态不变。

#### Scenario: Switching from Chat Mode to Work Mode
- **WHEN** 用户在顶部导航栏点击“工作模式”切换项时
- **THEN** 界面主视口 SHALL 平滑恢复为标准研发看板视图，重新展示各任务泳道与活跃卡片，未提交的会话输入草稿 SHALL 妥善保留。

#### Scenario: Mode controller visual alignment and icon
- **WHEN** 导航栏渲染模式切换控制器时
- **THEN** 控件 SHALL 采用胶囊分段风格（Segmented Control）呈现，包含专属矢量 SVG 图标（如看板图标代表工作模式，对话气泡图标代表会话模式），且文字不折行。
