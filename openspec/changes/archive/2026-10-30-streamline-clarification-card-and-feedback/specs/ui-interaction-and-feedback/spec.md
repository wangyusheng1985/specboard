## ADDED Requirements

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
