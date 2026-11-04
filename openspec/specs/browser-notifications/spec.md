# browser-notifications Specification

## Purpose
为 Specboard 提供稳定、跨阶段（全 5 阶段含 MR）、具备自检验证与高兼容性的浏览器系统级通知服务，确保关键决策（待回答、方案待确认、执行受阻、交付待审阅）在后台能够精准送达用户。

## Requirements

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

### Requirement: Derived Outcome State in Lane Queries
后端看板接口（`/api/v1/lane`）返回的任务数据 SHALL 包含经 `projectOutcome` 派生的完整 `outcome_state`，与单任务详情接口对齐。

#### Scenario: Lane polling returns tasks
- **WHEN** 客户端调用 `/api/v1/lane` 拉取任一泳道的任务列表时
- **THEN** 服务端返回的每项任务对象中的 `outcome_state` 字段 SHALL 包含当前语义状态（如 `clarifying`、`awaiting_proposal_approval`、`blocked`、`delivered`、`executing` 等），杜绝空值脱节。

### Requirement: Instant Verification Notification on Permission Grant
当用户开启浏览器通知权限时，系统 SHALL 立即发送一条自检确认通知，并支持手动触发测试通知。

#### Scenario: User enables notifications
- **WHEN** 用户点击“启用通知”并成功授权允许通知时
- **THEN** 系统 SHALL 立即向系统通知中心派发一条包含“Specboard · 通知已成功启用”的即时验证通知，让用户直观确认权限已打通。

#### Scenario: User clicks test notification trigger
- **WHEN** 已启用通知的用户触发测试通知功能时
- **THEN** 系统 SHALL 发送一条测试样例通知，验证图标、标题、点击激活与跳转行为正常。

### Requirement: Compatible Notification Icon Asset
浏览器系统通知的图标资源 SHALL 采用广泛兼容所有桌面与移动操作系统的 PNG 格式。

#### Scenario: Notification payload generation
- **WHEN** 生成系统通知的载荷参数时
- **THEN** 通知配置中的 `icon` SHALL 引用 `/apple-touch-icon.png` 格式的矢量渲染位图，确保 macOS、Windows 与 Linux 下的各类浏览器均能正常渲染通知图标。

### Requirement: Accurate Clarification Notification Trigger
系统 SHALL 仅在任务因存在未决澄清问题而等待输入时，才派发“需要回答”的浏览器系统通知。

#### Scenario: Explore task enters genuine clarification state
- **WHEN** 任务在 Explore 阶段因 Agent 提出问题而使 `wait_reason` 变为 `clarification_required` 时
- **THEN** 系统 SHALL 派发包含“需要你的回答”的桌面通知。

#### Scenario: Explore task completes without pending questions
- **WHEN** 任务在 Explore 阶段完成执行，或已回答澄清并消费完毕且 `wait_reason !== 'clarification_required'` 时
- **THEN** 系统 SHALL 抑制派发“需要你的回答”通知，避免造成无待答问题时的误提醒骚扰。
