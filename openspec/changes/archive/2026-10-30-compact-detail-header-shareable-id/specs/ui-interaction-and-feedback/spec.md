## MODIFIED Requirements

### Requirement: Draft Autosave and Action Feedback
表单草稿自动保存与一键操作 SHALL 提供微交互确认反馈，消除用户对操作结果的不确定性，并支持任务短 ID 一键复制直达分享链接。

#### Scenario: Draft autosave confirmation
- **WHEN** 方案澄清或输入草稿由后台自动持久化完成时
- **THEN** 状态指示标签 SHALL 触发瞬时翠绿微光闪烁，并平滑渐显“草稿已保存”。

#### Scenario: Async action loading state
- **WHEN** 用户点击异步提交按钮（如验证项目、开始探索、保存配置）时
- **THEN** 按钮在禁用防重的同时 SHALL 在文字左侧展示 14px 微型平滑旋转 Spinner，提示后台正在处理。

#### Scenario: Copy diagnostic feedback
- **WHEN** 用户点击复制诊断或结果信息按钮时
- **THEN** 复制按钮图标 SHALL 在 200ms 内微弹动切换为绿色对勾，并在 2 秒后平滑复原。

#### Scenario: Copy task shareable link
- **WHEN** 用户点击任务详情顶栏的任务 ID 芯片（`#xxxxxxxx`）时
- **THEN** 系统 SHALL 将该任务当前阶段的完整直达分享链接复制到剪贴板，芯片右侧的复制图标瞬时切换为绿色对勾与“已复制”文本，并在 2 秒后平滑复原，同时在屏幕顶部呼出轻量 Toast 提醒。

## ADDED Requirements

### Requirement: Compact Detail Header with Clamped Directive Title
任务详情头部 SHALL 采用紧凑型信息架构与字号层级，控制纵向高度不超过 90px，避免压缩下方实际内容展示空间。

#### Scenario: Detail header compact typography and line clamping
- **WHEN** 打开任务详情弹窗时
- **THEN** 头部顶栏 SHALL 紧凑排布仓库芯片、可复制任务 ID 芯片与状态徽标；下方的任务目标标题字号 SHALL 限制在 14px~15px 间，默认采用 2 行溢出截断（`-webkit-line-clamp: 2`），当鼠标悬停于标题时通过原生文本提示（`title`）完整展现原始需求，杜绝巨型卡片占用可视高度。
