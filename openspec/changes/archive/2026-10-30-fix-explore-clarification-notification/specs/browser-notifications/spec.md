## MODIFIED Requirements

### Requirement: Complete Stage Support in Task Observation
任务状态监听器 SHALL 完整支持全部 5 个业务阶段（Explore, Propose, Apply, MR, Archive），并在任务因运行完成推进到需要用户澄清决策时，准确触发桌面系统通知。

#### Scenario: Task enters MR or requires review in MR stage
- **WHEN** 任务在 Apply 完成后进入 MR 阶段，或在 MR 阶段发生交付完成待归档、或执行受阻时
- **THEN** 系统 SHALL 准确识别其状态变更，并派发对应的浏览器系统通知，不发生静默丢弃。

#### Scenario: Explore stage completion enters clarifying state
- **WHEN** 新建任务在 Explore 阶段运行结束并转移为“待你澄清”（`outcome_state === 'clarifying'`）状态时
- **THEN** 服务端 SHALL 严格递增该任务的 `outcome_revision`，客户端监听器 SHALL 识别状态跃迁并向已授权的浏览器发出“需要回答”系统通知。

#### Scenario: First observed actionable task
- **WHEN** 客户端监听器首次建立快照基线时，若发现已有处于需要用户立即干预状态（`clarifying`、`awaiting_proposal_approval`、`blocked`、`delivered`）且此前未被消费通知 key 的任务时
- **THEN** 系统 SHALL 适时派发桌面通知，避免页面刷新或重载导致处于待办状态的任务被静默忽略。
