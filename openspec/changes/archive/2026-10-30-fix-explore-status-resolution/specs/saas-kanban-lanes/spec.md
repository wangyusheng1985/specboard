## MODIFIED Requirements

### Requirement: Elevated Task Card with Text Clamping
任务卡片 SHALL 具备纯白微浮表面、多层软阴影、微型项目图标、文本行数溢出保护，并根据等待原因准确呈现状态徽标。

#### Scenario: Task card rendering
- **WHEN** 泳道内渲染任务卡片时
- **THEN** 卡片 SHALL 采用纯白底色（`#ffffff`）、柔和多层微投影；卡片顶部展示带代码仓库图标的项目标签，标题限制最多展示 3 行（超出截断以防布局破坏），底部整齐排列状态指示徽标与日期。

#### Scenario: Task card hover and active state
- **WHEN** 用户将鼠标悬停在任务卡片上或点击卡片时
- **THEN** 悬停时卡片边框渐变为品牌蓝、投影提升并在 0.2s 内微浮（`translateY(-2px)`）；按下时触发微缩放弹性反馈（`scale(0.99)`）。

#### Scenario: Explore task status badge differentiation
- **WHEN** 任务处于 Explore 阶段且当前处于等待输入态（`status === 'waiting_input'`）时
- **THEN** 若 `wait_reason === 'clarification_required'` 或状态为 `awaiting_answers`，卡片与详情头部状态徽标 SHALL 呈现为“待你澄清 / 等待回答”；若无未决澄清原因（`wait_reason !== 'clarification_required'`），状态徽标 SHALL 准确呈现为“探索完成 · 待推进”，指示用户可推进至 Propose 阶段，不得显示为“待你澄清”。
