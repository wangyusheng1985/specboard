## ADDED Requirements

### Requirement: Vertical Alignment of Status Badge Glyphs
状态徽标（`.badge`）内部的文本字形与状态指示圆点 SHALL 严格在垂直轴线上居中对齐，消除任何向下偏移的视觉错位。

#### Scenario: Rendering status badge in detail header or board card
- **WHEN** 界面在看板卡片或任务详情头部渲染阶段状态徽标（如 `Explore · 执行中`、`Propose · 方案待审批`）时
- **THEN** 徽标胶囊内部的文字基线与左侧状态圆点 SHALL 保持数学级垂直居中，四周内边距对称均衡。

### Requirement: Task Detail Directive Hero Presentation
任务详情弹窗头部 SHALL 采用两层式“元信息操作栏 + 任务目标卡片（Task Hero Banner）”结构，直观凸显该任务的核心目标，并保持仓库标识与操作按钮的整洁排布。

#### Scenario: Opening task detail dialog
- **WHEN** 用户打开任意任务的详情弹窗时
- **THEN** 弹窗头部第一行 SHALL 展示仓库芯片（带代码平台矢量图标）、阶段状态 Badge 与右侧紧凑操作按钮组；第二行 SHALL 以独立带 Accent 侧边条与清晰微标签的卡片形式高亮展示该任务的目标描述文本。

#### Scenario: Task title prominence
- **WHEN** 渲染任务标题卡片时
- **THEN** 该区域 SHALL 呈现“任务目标”语义微标签与高对比度排版，使用户一眼即可明确识别该任务的指令与意图。
