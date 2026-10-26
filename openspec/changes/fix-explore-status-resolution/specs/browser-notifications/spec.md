## ADDED Requirements

### Requirement: Accurate Clarification Notification Trigger
系统 SHALL 仅在任务因存在未决澄清问题而等待输入时，才派发“需要回答”的浏览器系统通知。

#### Scenario: Explore task enters genuine clarification state
- **WHEN** 任务在 Explore 阶段因 Agent 提出问题而使 `wait_reason` 变为 `clarification_required` 时
- **THEN** 系统 SHALL 派发包含“需要你的回答”的桌面通知。

#### Scenario: Explore task completes without pending questions
- **WHEN** 任务在 Explore 阶段完成执行，或已回答澄清并消费完毕且 `wait_reason !== 'clarification_required'` 时
- **THEN** 系统 SHALL 抑制派发“需要你的回答”通知，避免造成无待答问题时的误提醒骚扰。
