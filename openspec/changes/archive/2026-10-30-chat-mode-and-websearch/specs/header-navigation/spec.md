## ADDED Requirements

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
