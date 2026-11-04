## MODIFIED Requirements

### Requirement: Stage Flow Stepper Animation
任务详情抽屉头部 SHALL 常驻展示 4 阶段流程状态机（Explore ➔ Propose ➔ Apply ➔ Archive）步进器，呈现清晰的阶段演进连贯性与当前执行阶段的视觉焦点。

#### Scenario: Current stage pulse indication
- **WHEN** 抽屉展示任务详情且当前处于某一活跃执行阶段（如 Explore、Propose、Apply）时
- **THEN** 阶段演进步进器 SHALL 明确标识当前阶段为激活态，指示圆点呈现柔和品牌色脉冲光晕，已完成的历史阶段标记为成功状态，后续未执行阶段呈现浅灰待办态。

#### Scenario: Switching between historical and current stage view
- **WHEN** 任务阶段发生推进或用户查看不同阶段上下文时
- **THEN** 步进器 SHALL 实时同步当前任务所处的实际阶段，并在阶段演进时保持平滑过渡，无视觉跳跃或布局抖动。

## ADDED Requirements

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
- **THEN** 系统 SHALL 在全局横幅区呈现红色警示卡片，展示失败原因与一键“复制诊断”操作，阻断信息跨所有 Tab 强提醒。

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
