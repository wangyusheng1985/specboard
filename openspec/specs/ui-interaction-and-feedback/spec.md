# ui-interaction-and-feedback Specification

## Purpose
为 Specboard 研发协同平台提供专业、克制且高可用的前端 UI 展示效果与交互动画系统，包括统一矢量 SVG 图标、任务执行动态呼吸指示、物理感知拖拽与垃圾桶反馈、流程步骤声呐光波、非侵入式浮动 Toast 通知、表单校验微震展开及无障碍动效降级保障。

## Requirements

### Requirement: Vector SVG Icon System
系统前端 SHALL 全面使用内联或统一风格的矢量 SVG 图标替代原生 Emoji，支持主题色动态适配，并在必要时提供无障碍文本替代。

#### Scenario: Structural icon rendering
- **WHEN** 界面渲染垃圾桶删除区、外链跳转、关闭按钮、状态指示及复制按钮时
- **THEN** 系统 SHALL 渲染一致线宽与风格的矢量 SVG 图标，且用于纯装饰性展示的图标 SHALL 标记 `aria-hidden="true"`，独立可交互图标 SHALL 提供 `aria-label`。

### Requirement: Task Execution Liveness Indicator
系统看板卡片 SHALL 根据任务的实时运行状态提供生动且克制的动态视觉指示，让用户直观识别后台任务活跃度。

#### Scenario: Task is running or recovering
- **WHEN** 任务处于 `running`、`recovering` 或正在执行阶段单元时
- **THEN** 任务卡片状态徽标 SHALL 显示带平滑呼吸光晕的指示点（Pulse Dot），且卡片边缘 SHALL 呈现微弱的流光边框高亮。

#### Scenario: Task is awaiting user input
- **WHEN** 任务处于 `awaiting_answers` 或 `waiting_input` 状态时
- **THEN** 任务卡片状态徽标 SHALL 显示琥珀橙色调并在右侧详情抽屉相应区域高亮指示。

### Requirement: Drag and Drop Tactile Feedback
看板卡片拖拽与垃圾桶删除放置区 SHALL 提供明确的物理感知与状态变换反馈。

#### Scenario: Card drag initiation
- **WHEN** 用户开始拖拽一张任务卡片时
- **THEN** 界面全局 SHALL 进入拖拽态，被拖拽卡片 SHALL 产生轻微倾斜与浮起阴影，所有有效放置目标泳道与垃圾桶区 SHALL 高亮提示。

#### Scenario: Drag over trash drop zone
- **WHEN** 用户将卡片拖至垃圾桶删除区上方（drag-over）时
- **THEN** 垃圾桶图标的顶盖部分 SHALL 向上平移并倾斜打开，放置区背景变为柔和警示红晕并轻微放大。

### Requirement: Stage Flow Stepper Animation
任务详情抽屉中的 5 阶段流程步骤条 SHALL 呈现清晰的阶段递进连贯性与当前进行中阶段的视觉焦点。

#### Scenario: Current stage pulse indication
- **WHEN** 抽屉展示任务详情且当前处于某一活跃执行阶段时
- **THEN** 该阶段的序号圆圈 SHALL 循环播放柔和的声呐波纹扩散动效（Sonar Ripple），明确标识执行进度。

#### Scenario: Switching between historical and current stage view
- **WHEN** 用户点击已完成的历史步骤或当前步骤切换查看内容时
- **THEN** 阶段产物与操作面板内容 SHALL 在 150ms 内平滑淡入（Cross-fade），避免界面剧烈跳变。

### Requirement: Floating Toast Notification System
系统操作反馈与异常提醒 SHALL 通过浮动 Toast 通知展示，确保不破坏页面主体布局且能在合理时间内自动消失。

#### Scenario: Action success notification
- **WHEN** 用户成功触发删除任务、保存项目、切换连接等操作时
- **THEN** 屏幕顶部中置区域 SHALL 弹性滑入一个带有绿色对勾图标的 Success Toast，并在 3.5 秒后自动平滑滑出退场。

#### Scenario: Error notification with pause on hover
- **WHEN** 接口请求失败或操作受阻返回错误提示时
- **THEN** 系统 SHALL 弹性滑入 Error Toast 并伴随轻微横向微震动；当用户鼠标悬停或聚焦于 Toast 上时，自动关闭计时器 SHALL 暂停，移开后恢复。

### Requirement: Form Validation and Error Recovery Feedback
表单提交校验失败、字段不符合要求或需要二次破坏性操作确认时，系统 SHALL 提供明确且自适应容器宽度的视觉警示与确认卡片。

#### Scenario: Form validation failure
- **WHEN** 表单提交失败且服务端或本地校验返回错误时
- **THEN** 对应输入控件 SHALL 呈现红色轮廓并触发 250ms 内的轻微横向微震动，错误说明文本 SHALL 平滑向下展开显示。

#### Scenario: Inline confirmation box in narrow containers
- **WHEN** 用户在抽屉或列表项内部触发二次确认操作（如删除项目）时
- **THEN** 二次确认卡片（`.inline-confirm`）SHALL 具备 100% 容器宽度与独立的块级排版，卡片内的操作按钮强制保持单行不折行（`white-space: nowrap`），杜绝因父级弹性容器挤压导致的竖排变形。

### Requirement: Draft Autosave and Action Feedback
表单草稿自动保存与一键操作 SHALL 提供微交互确认反馈，消除用户对操作结果的不确定性。

#### Scenario: Draft autosave confirmation
- **WHEN** 方案澄清或输入草稿由后台自动持久化完成时
- **THEN** 状态指示标签 SHALL 触发瞬时翠绿微光闪烁，并平滑渐显“草稿已保存”。

#### Scenario: Async action loading state
- **WHEN** 用户点击异步提交按钮（如验证项目、开始探索、保存配置）时
- **THEN** 按钮在禁用防重的同时 SHALL 在文字左侧展示 14px 微型平滑旋转 Spinner，提示后台正在处理。

#### Scenario: Copy diagnostic feedback
- **WHEN** 用户点击复制诊断或结果信息按钮时
- **THEN** 复制按钮图标 SHALL 在 200ms 内微弹动切换为绿色对勾，并在 2 秒后平滑复原。

### Requirement: Accessibility and Reduced Motion Support
所有新增的界面动画与微交互 SHALL 严格遵循无障碍准则，并在用户系统开启减弱动画偏好时优雅降级。

#### Scenario: Reduced motion preference active
- **WHEN** 用户的操作系统启用了减弱动态效果（`prefers-reduced-motion: reduce`）时
- **THEN** 系统所有呼吸灯、流光、弹跳、震动及滑入滑出过渡时间 SHALL 降为 0.01ms 或瞬间完成，仅保留无动效的静态颜色与状态切换。
