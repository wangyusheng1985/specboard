## MODIFIED Requirements

### Requirement: GitHub Actions Workflow Monitoring and Healing
系统 SHALL 能够轮询 GitHub Actions 工作流的运行状态，支持异步流水线初始生成的有界等待，准确提取失败 Job 的有效诊断，并在代码修复后只绑定新的流水线实例进行后续验证；在代码推送后的初次与再次流水线发现（Discovery）阶段，系统 SHALL 严格比对流水线对应的 Commit SHA（`head_sha`）或排除前序流水线 ID，杜绝读取历史已结束流水线。

#### Scenario: Polling GitHub Actions status
- **WHEN** PR 创建或更新完成且已推送到远程分支时
- **THEN** 系统 SHALL 轮询该分支最新的 GitHub Actions Workflow Run 状态，直到其成功（`conclusion === 'success'`）或失败/异常终止（`conclusion` 为 `failure`、`cancelled`、`timed_out` 等）。

#### Scenario: Discovering newly triggered pipeline matching current commit
- **WHEN** 代码推送至远端分支且系统启动流水线发现轮询（Discovery）时
- **THEN** 系统 SHALL 轮询直到获取到的 Workflow Run 对应的 `head_sha` 严格匹配当前推送的 Commit SHA，或者其流水线 ID 严格不同于前一次执行记录的流水线 ID，严禁将推送前已结束的旧流水线直接判定为当前流水线结果。

#### Scenario: Healing failed GitHub Actions run
- **WHEN** GitHub Actions 运行结束且判定为未成功（`conclusion` 为 `failure`、`cancelled` 或 `timed_out`），或者单个 Job 异常终止时
- **THEN** 系统 SHALL 检索该 Workflow 下所有未成功的 Job（包括 `failure`、`cancelled`、`timed_out`），提取其真实名称与日志信息注入给 Agent 会话以诊断和修改工作区或 CI 配置，随后通过 `git commit --amend` 与强制推送重新触发流水线。

#### Scenario: Accurately reporting cancelled or timed out jobs
- **WHEN** GitHub Actions 因 Runner 资源不可用被官方取消（`conclusion === 'cancelled'`）或执行超时（`conclusion === 'timed_out'`）时
- **THEN** 系统 SHALL 准确识别该未成功的 Job 名称（例如 `Build (macos-13 - x86_64)`）及异常状态，严禁退化标记为 `job unknown` 或返回空白日志。

#### Scenario: Initial pipeline discovery wait
- **WHEN** PR 创建或更新完成且远程 GitHub Actions 尚未生成流水线实例时
- **THEN** 系统 SHALL 在有界时间窗口内继续轮询，且不得将空实例视为成功。

#### Scenario: Extracting actionable failure diagnostics
- **WHEN** Workflow Run 或其 Job 已失败时
- **THEN** 系统 SHALL 优先向 Agent 提供包含编译器错误、构建失败标识及其上下文的有效日志片段，不得仅提供清理阶段或日志末尾的无关内容。

#### Scenario: Recognizing an agent-created fix commit
- **WHEN** Agent 已在工作区直接创建修复提交，但暂存区为空且当前分支相对远程分支存在领先提交时
- **THEN** 系统 SHALL 将该提交识别为有效修复并推送，不得错误报告“没有代码变更”。

#### Scenario: Binding a new workflow after repair push
- **WHEN** 系统已推送修复提交并触发新的 GitHub Actions Workflow Run 时
- **THEN** 系统 SHALL 等待并绑定与修复前不同的 Run ID，禁止继续将旧失败 Run 作为修复后的流水线状态。

#### Scenario: Preserving long-running recovery context
- **WHEN** MR Agent 会话经过多轮失败诊断与恢复且上下文接近模型限制时
- **THEN** 系统 SHALL 在保留当前工作区、最近失败诊断和恢复意图的前提下自动压缩上下文，并继续执行当前自动开发任务。

#### Scenario: Isolating automatic task execution
- **WHEN** Specboard 正在执行 MR 自动恢复时
- **THEN** 系统 SHALL 只操作 Specboard 自身的运行时、Agent 会话和对应任务工作区，不得因为修复 Specboard 而暂停、重置、删除或接管其他自动开发任务。
