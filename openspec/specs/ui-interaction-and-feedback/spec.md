# ui-interaction-and-feedback Specification

## Purpose
为 Specboard 研发协同平台提供专业、克制且高可用的前端 UI 展示效果与交互动画系统，包括统一矢量 SVG 图标、任务执行动态呼吸指示、物理感知拖拽与垃圾桶反馈、流程步骤声呐光波、非侵入式浮动 Toast 通知、表单校验微震展开及无障碍动效降级保障。

## Requirements

### Requirement: Vector SVG Icon System
系统前端 SHALL 全面使用内联或统一风格的矢量 SVG 图标替代原生 Emoji，涵盖全局控制、会话引导、思考状态、工具调用与上下文指示，支持主题色动态适配，并在必要时提供无障碍文本替代。

#### Scenario: Structural icon rendering
- **WHEN** 界面渲染垃圾桶删除区、外链跳转、关闭按钮、状态指示及复制按钮时
- **THEN** 系统 SHALL 渲染一致线宽与风格的矢量 SVG 图标，且用于纯装饰性展示的图标 SHALL 标记 `aria-hidden="true"`，独立可交互图标 SHALL 提供 `aria-label`。

#### Scenario: Chat mode vector icon replacement
- **WHEN** 渲染会话模式的快捷探索卡片、深度思考状态徽标、工具调用条目及上下文选择器时
- **THEN** 界面 SHALL 使用精准语义的内联矢量 SVG 图标替代全部原生 Emoji（包括架构分析、代码事实排查、联网检索、生成原型、深度思考、工具执行及项目上下文标签），严禁在 UI 界面中直接渲染 Emoji 字符。

#### Scenario: Tool invocation semantic iconography
- **WHEN** 消息流中呈现智能体调用工具（如 `web_search`、`fetch_content`、`read/grep/find/ls`、`write/edit`）时
- **THEN** 工具卡片 SHALL 搭配专用的矢量 SVG 图标（如搜索放大镜、地球网格、代码终端、文档文件），线宽统一为 1.75px ~ 2.0px 并继承主题配色。

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
任务详情抽屉头部 SHALL 常驻展示 4 阶段流程状态机（Explore ➔ Propose ➔ Apply ➔ Archive）步进器，呈现清晰的阶段演进连贯性与当前执行阶段的视觉焦点。

#### Scenario: Current stage pulse indication
- **WHEN** 抽屉展示任务详情且当前处于某一活跃执行阶段（如 Explore、Propose、Apply）时
- **THEN** 阶段演进步进器 SHALL 明确标识当前阶段为激活态，指示圆点呈现柔和品牌色脉冲光晕，已完成的历史阶段标记为成功状态，后续未执行阶段呈现浅灰待办态。

#### Scenario: Switching between historical and current stage view
- **WHEN** 任务阶段发生推进或用户查看不同阶段上下文时
- **THEN** 步进器 SHALL 实时同步当前任务所处的实际阶段，并在阶段演进时保持平滑过渡，无视觉跳跃或布局抖动。

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

### Requirement: Accessibility and Reduced Motion Support
所有新增的界面动画与微交互 SHALL 严格遵循无障碍准则，并在用户系统开启减弱动画偏好时优雅降级。

#### Scenario: Reduced motion preference active
- **WHEN** 用户的操作系统启用了减弱动态效果（`prefers-reduced-motion: reduce`）时
- **THEN** 系统所有呼吸灯、流光、弹跳、震动及滑入滑出过渡时间 SHALL 降为 0.01ms 或瞬间完成，仅保留无动效的静态颜色与状态切换。

### Requirement: Right Side Detail Drawer Layout
任务详情抽屉在宽屏视口下 SHALL 表现为靠右停靠的标准工作抽屉，窄屏视口下自适应为底部抽屉，避免内容过度横向拉伸。

#### Scenario: Desktop right-side drawer presentation
- **WHEN** 视口宽度大于等于 768px 且用户打开任务详情时
- **THEN** 详情抽屉 SHALL 固定停靠在屏幕右侧，宽度限制为 `min(920px, 82vw)`，高度占满屏幕（`100dvh`），左侧具备平滑滑入动画与立体阴影边框，抽屉头部取消移动端专用的抓手横条。

#### Scenario: Mobile bottom drawer fallback
- **WHEN** 视口宽度小于 768px 且用户打开任务详情时
- **THEN** 详情抽屉 SHALL 自适应降级为贴底抽屉，宽度占满屏幕，顶部保留圆角与安全边距。

### Requirement: Top Level Decision Banners
任务详情页中的澄清确认（Clarification）与失败诊断（Diagnostic）SHALL 作为全局决策横幅置顶于抽屉头部紧下方，不从属于任何子 Tab。

#### Scenario: Clarification pending global banner
- **WHEN** 当前任务存在处于 `pending` 状态的澄清问题批次时
- **THEN** 系统 SHALL 在头部与 Tab 导航之间置顶呈现琥珀色警告横幅，直接展示澄清提问与表单，允许用户立即回答并提交，无需切换到子 Tab。

#### Scenario: Blocked diagnostic global banner
- **WHEN** 任务执行失败且状态处于 `blocked` 或需要人工核查时
- **THEN** 系统 SHALL 在全局横幅区呈现红色警示卡片，以三段式结构展示：
  1. **第一部分**：醒目展示由智能提炼的问题根因；
  2. **第二部分**：以清晰列表呈现至少一条可行的人工介入与排障建议；
  3. **第三部分**：提供可折叠的原始错误信息与堆栈区块，并提供一键“复制原始信息”操作。
  阻断信息跨所有 Tab 强提醒。

#### Scenario: Quiet execution without banners
- **WHEN** 任务正常执行中且没有待回答澄清或严重阻断时
- **THEN** 全局决策横幅区 SHALL 保持静默完全隐藏，不占用页面垂向空间。

### Requirement: Segmented Detail Navigation Tabs
任务详情抽屉 SHALL 提供高对比度、带胶囊底座的分段导航控制器（Segmented Control），并展示动态条目数量 Badge。

#### Scenario: Tab switching and active indicator
- **WHEN** 用户在“阶段成果”、“任务全景与历史”、“互动与指令”之间点击切换时
- **THEN** 被选中的 Tab 按钮 SHALL 呈现纯白卡片底座、品牌色高亮文字与微投影，且对应面板即时显示，其它面板隐藏。

#### Scenario: Tab dynamic badges
- **WHEN** 阶段成果存在产物文件、或互动流中存在用户指令时
- **THEN** 对应 Tab 标签右侧 SHALL 呈现圆角数字 Badge（如产物数量、指令条数），辅助用户感知非当前 Tab 的内容密度。

### Requirement: Standardized Modular Type Scale
任务详情抽屉内的所有文字排版 SHALL 严格收敛至标准五级字阶，消除碎片化字号与行高。

#### Scenario: Typography hierarchy enforcement
- **WHEN** 任务详情抽屉渲染各区域文字时
- **THEN** 任务主标题 SHALL 统一为 16px/1.45 加粗（Weight 650）；模块卡片标题 SHALL 统一为 14px/1.4 加粗（Weight 600）；正文与 Markdown 内容 SHALL 统一为 13px/1.6；辅助说明与时间元数据 SHALL 统一为 12px/1.4；等宽代码与状态标签 SHALL 统一为 11px 等宽字体。

### Requirement: Modal Artifact Preview System
阶段过程产物（HTML 原型、Markdown 文档、图表代码）SHALL 支持通过大尺寸模态弹窗（Modal Dialog）进行预览，消除在狭窄卡片内滚动折叠受限的问题。

#### Scenario: User clicks preview button on artifact card
- **WHEN** 用户在阶段成果面板中点击某一产物卡片（如 `demo_preview.html`）的“预览”操作时
- **THEN** 界面 SHALL 弹出专用的高对比度模态对话框（宽度 `min(1100px, 94vw)`，高度 `min(88dvh, 900px)`），提供安全的沙箱 iframe 实时交互环境或 Markdown 渲染视图，并提供全屏、复制内容、在新标签页打开和一键关闭操作。

#### Scenario: Autonomous prototype creation during exploration
- **WHEN** 用户在 Explore 阶段发送明确绘制或生成原型/demo/html 的指令时
- **THEN** 系统 Agent SHALL 视该指令为明确授权，无需反复要求用户进行“是/否”文本确认，直接在工作区生成自包含的演示文件并完成该轮交互。

### Requirement: Detail Dialog Three-Tier Tab Navigation
任务详情弹窗 SHALL 提供 3 个顶级导航 Tab（基本信息、阶段成果、需求互动与补充反馈），默认选中“基本信息”，支持键盘与鼠标切换视图。

#### Scenario: Switching detail view tabs
- **WHEN** 用户点击“阶段成果”或“需求互动与补充反馈”Tab 选项卡时
- **THEN** 弹窗主体区域 SHALL 瞬间平滑切换显示对应面板的内容，非活动面板自动隐藏，且激活 Tab 保持显著的主题色下划线与高亮状态。

#### Scenario: Default tab selection on open
- **WHEN** 用户从看板点击打开任意任务详情时
- **THEN** 弹窗 SHALL 默认聚焦并激活“基本信息”Tab，清晰呈现任务的阶段、状态、完整需求描述与项目属性。

### Requirement: Collapsible Stage Result Cards with Gradient Fade
“阶段成果”Tab 中的各阶段 Markdown 结果卡片 SHALL 默认处于折叠状态，展示前 5 行预览，并带有平滑的底部虚影遮罩与展开/收起切换按钮。

#### Scenario: Default collapsed rendering with gradient mask
- **WHEN** 用户进入“阶段成果”Tab 时
- **THEN** 各阶段报告卡片 SHALL 默认处于折叠态，最大高度限制在 130px 左右（约 5 行正文），卡片底部覆盖白色半透明渐变虚影，清晰提示下方有未展示完的内容。

#### Scenario: Toggling card expansion
- **WHEN** 用户点击卡片底部的“展开全部”按钮时
- **THEN** 卡片的高度限制与虚影遮罩 SHALL 解除，平滑展开展示完整的 Markdown 长文内容，按钮文本切换为“收起”并更新箭头方向；再次点击时恢复折叠。

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

### Requirement: Compact Detail Header with Clamped Directive Title
任务详情头部 SHALL 采用紧凑型信息架构与字号层级，控制纵向高度不超过 90px，避免压缩下方实际内容展示空间。

#### Scenario: Detail header compact typography and line clamping
- **WHEN** 打开任务详情弹窗时
- **THEN** 头部顶栏 SHALL 紧凑排布仓库芯片、可复制任务 ID 芯片与状态徽标；下方的任务目标标题字号 SHALL 限制在 14px~15px 间，默认采用 2 行溢出截断（`-webkit-line-clamp: 2`），当鼠标悬停于标题时通过原生文本提示（`title`）完整展现原始需求，杜绝巨型卡片占用可视高度。

### Requirement: Low-Noise Clarification Card and Decoupled Feedback Bar
任务详情弹窗 SHALL 遵循克制低噪声原则，仅在存在未决澄清时展示“待你确认”卡片，澄清完成后自动隐藏，并将补充信息表单解耦为独立输入组件。

#### Scenario: Clarification card visible only when questions are pending
- **WHEN** 任务当前阶段存在尚未回答的澄清问题批次（`batch.status === 'pending'`）时
- **THEN** 任务详情弹窗中的“待你确认”卡片（`#clarification-card`）SHALL 展开显示，并渲染选项与草稿自动保存控件供用户回答。

#### Scenario: Clarification card automatically hidden when resolved
- **WHEN** 任务当前阶段没有待回答的澄清批次（如无提问批次、问题已提交且已消费 `consumed`、或探索已完成）时
- **THEN** “待你确认”卡片（`#clarification-card`）SHALL 自动设为隐藏（`hidden`），不再在首屏展示“待你确认”标题或大段历史“问答记录”，将首屏视觉空间让渡给阶段过程产物与成果。

#### Scenario: Decoupled feedback and message submission
- **WHEN** 用户在任何阶段需要向 Agent 补充说明或反馈信息时
- **THEN** 界面 SHALL 提供独立的“补充需求与反馈”卡片（`#feedback-card`），不再嵌套于“待你确认”标题下，确保语义准确且不造成用户误解。

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

### Requirement: Elimination of Stage Animations in Detail View
任务详情弹窗中 SHALL 遵循低视觉噪音准则，移除所有阶段脉冲波纹、呼吸灯动画与视图切换 cross-fade 动效，呈现稳定、静默的阅读环境。

#### Scenario: Detail view status and badge presentation
- **WHEN** 用户在任务详情中查看当前阶段、状态徽标或执行内容时
- **THEN** 状态圆点与内容区域 SHALL 呈现静态清晰的高保真样式，不得播放循环的 ping 扩散光晕或平滑淡入动效。

### Requirement: Pixel-Perfect Native Center Alignment of Bottom Sheet Dialogs
底部弹窗（`.drawer` 及 `dialog.drawer`）SHALL 采用原生标准盒模型实现水平居中（通过 `inset: auto 0 0 0` 与 `margin: 0 auto` 居中），严禁依赖 `left: 50%` 与 `translateX(-50%)` 的复合位移方案。

#### Scenario: Opening dialog on desktop screens
- **WHEN** 用户在宽屏或桌面分辨率下打开任务详情或配置弹窗时
- **THEN** 弹窗两侧外边距 SHALL 完全对称相等，弹窗本体严密居中停靠在视口底部，杜绝向右偏移或被视口截断。

#### Scenario: Opening dialog on mobile devices
- **WHEN** 屏幕视口宽度小于 600px 时
- **THEN** 弹窗宽度自适应为视口 100% 满宽呈现，并保持底部无缝贴合。

### Requirement: Task Detail Header Action Controls
任务详情弹窗 SHALL 移除占用大量纵向空间的独立“阶段流程”步骤条卡片与“任务操作”卡片，改为在详情头部（`.drawer-head`）右侧集成两个具备自适应 SVG 图标与状态感知能力的语义操作按钮。

#### Scenario: Displaying stop and primary advance buttons in detail header
- **WHEN** 用户打开任务详情弹窗时
- **THEN** 弹窗内容区顶部不再显示独立“阶段流程”大卡片与“任务操作”卡片；而在头部右上侧（关闭按钮左侧）展示“停止”与“主推进/确认”两个矢量 SVG 按钮。

#### Scenario: Dynamic primary button state reflection
- **WHEN** 任务处于不同生命周期（如 Explore 完成等待推进、Propose 方案待审批、Apply 运行中、执行受阻时）
- **THEN** 主操作按钮的 SVG 图标、文案和交互逻辑 SHALL 动态对齐：在方案待审批时呈现“确认方案并开始执行”（勾选图标）、在执行受阻时呈现“重试当前阶段”（重试图标）、在可推进时呈现“进入下一阶段”（推进箭头）。

#### Scenario: Stop button availability
- **WHEN** 任务处于后台执行中（`running`）或等待输入（`waiting_input`）状态时
- **THEN** 停止按钮处于可用激活态（点击可触发终止当前执行）；当任务处于未激活状态时，停止按钮保持禁用或静默状态，杜绝无效点击。

### Requirement: Compact Task Meta Header Integration
任务所属项目、阶段与执行状态 SHALL 在详情头部整合为紧凑的一体化信息条，不再分散展示。

#### Scenario: Header status rendering
- **WHEN** 任务详情更新数据时
- **THEN** 头部项目名称右侧 SHALL 展示包含当前阶段与状态的紧凑 Badge（例如 `Explore · 执行中` 或 `Propose · 方案待确认`），让用户无需向下滚动即可获知任务当前核心进展。

### Requirement: Explore Stage Process Artifact Generation and Collection
系统在 Explore 探索阶段 SHALL 支持 Agent 根据用户指令生成过程文件（如 Demo HTML、Markdown 调研总结、JSON 配置等），并在运行结束时自动收集为产物数组（`artifacts`）上传持久化。

#### Scenario: Agent creates demo html or summary markdown during exploration
- **WHEN** 用户在 Explore 阶段提出“生成一份 Demo HTML”或“写一份对比调研 markdown”要求，且 Agent 在工作区中写入对应文件时
- **THEN** 运行结束时系统 SHALL 自动检测并提取这些过程文件，构建包含文件相对路径与文本内容的 `artifacts` 列表。

### Requirement: Artifacts List and Interactive Preview in Task Detail
任务详情弹窗 SHALL 提供专门的“过程生成文件 / 阶段产物”卡片，清晰罗列各阶段产物，并提供无缝的富文本与沙箱内联交互预览。

#### Scenario: Listing generated artifacts
- **WHEN** 任务当前查看阶段存在已生成的产物文件时
- **THEN** 系统 SHALL 展示包含文件名称、大小与类型标识的文件卡片列表，并高亮可交互的操作项。

#### Scenario: Previewing HTML demo in secure sandbox
- **WHEN** 用户点击 `.html` 格式的过程文件卡片时
- **THEN** 系统 SHALL 在隔离的安全 iframe 沙箱容器中内联加载渲染该 HTML 页面，允许用户直接进行按钮点击、表单交互等原型体验，并支持全屏展开与在新窗口打开。

#### Scenario: Previewing Markdown summary document
- **WHEN** 用户点击 `.md` 格式的过程文件卡片时
- **THEN** 系统 SHALL 直接利用内置 Markdown 渲染引擎将其渲染为结构化排版（支持标题、列表、表格与图表），并提供内容复制功能。

### Requirement: Markdown Table Rendering
系统 Markdown 渲染器 SHALL 完整支持 GFM 标准表格语法（表头、对齐分割线、数据行），以结构化的 HTML 表格（`<table>`）形式渲染。

#### Scenario: Rendering standard markdown comparison table
- **WHEN** 任务成果或阶段总结中包含带有管道符 `|` 的表格文本（如 `| 列1 | 列2 |`）以及分割行 `| :--- | ---: |` 时
- **THEN** 系统 SHALL 将其解析为包含 `<thead>`、`<tbody>` 的标准 `<table>` 元素，并根据 `:---:`、`---:` 正确应用文本对齐样式。

#### Scenario: Inline styles within table cells
- **WHEN** 表格单元格中包含加粗语法 `**文本**` 或代码块语法 `` `code` `` 时
- **THEN** 渲染器 SHALL 在单元格内部正确将其转换为 `<strong>` 或 `<code>` 节点，且特殊字符均以文本节点处理，绝不发生 HTML 注入。

### Requirement: PlantUML Architecture Diagram Rendering
系统 Markdown 渲染器 SHALL 支持对 `plantuml` 代码块的可视化图形渲染，并提供源码与图表切换视图。

#### Scenario: Rendering PlantUML code block
- **WHEN** Markdown 文本中包含语言标识为 `plantuml` 的代码块（如 ````plantuml`）或内含 `@startuml ... @enduml` 时
- **THEN** 系统 SHALL 自动将其转换为架构图卡片，展示渲染生成的 SVG 矢量图，并提供“查看源码 / 查看图表”切换按钮。

#### Scenario: Diagram rendering fallback on network or syntax error
- **WHEN** 图表生成失败或网络不可达时
- **THEN** 系统 SHALL 优雅回退显示原始 PlantUML 代码块，并明确标识“图表加载失败”，保障内容可读性不中断。

### Requirement: Bottom Sheet Dialog Presentation and Canvas Width
系统弹窗 SHALL 采用自视口底部向上平滑展开的 Bottom Sheet 模式呈现，为 Markdown 渲染成果及复杂表单提供充足的横向阅读宽度与纵向展示空间。

#### Scenario: Opening task detail dialog
- **WHEN** 用户点击看板卡片打开任务详情（`#detail-dialog`）时
- **THEN** 弹窗 SHALL 从屏幕底部平滑向上滑入，水平方向居中且最大宽度支持扩展到 `min(1360px, 95vw)`，高度占据视口主区域（`min(88dvh, 900px)`），提供大屏 Markdown 呈现效果。

#### Scenario: Opening compact dialogs
- **WHEN** 用户打开工作空间连接、新建任务等表单型弹窗（`.compact-drawer`）时
- **THEN** 弹窗 SHALL 同样从底部向上弹出，宽度适配表单交互并限制为 `min(680px, 92vw)`，保持全站一致的底部抽屉视觉统一性。

### Requirement: Independent Scroll and Background Isolation
底部向上弹窗 SHALL 具备独立的滚动容器体系，且弹窗开启状态下系统全局背景滚动 SHALL 被彻底锁死，杜绝全局与局部滚动条双重滚动冲突。

#### Scenario: Scrolling lengthy markdown content inside dialog
- **WHEN** 任务成果区或执行记录包含大量长篇 Markdown、代码块或表格并发生溢出时
- **THEN** 滚动行为 SHALL 仅在弹窗内部内容容器（`.drawer-body`）中独立触发，页面底层全局看板背景（`body`）保持固定无跳动。

#### Scenario: Clicking backdrop area outside sheet
- **WHEN** 用户在 Bottom Sheet 之外的遮罩暗色区域点击时
- **THEN** 弹窗 SHALL 捕获点击并平滑向下退出关闭，同时恢复页面正常的背景滚动能力。
