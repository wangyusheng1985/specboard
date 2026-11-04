## MODIFIED Requirements

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
