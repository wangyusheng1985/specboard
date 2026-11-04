## MODIFIED Requirements

### Requirement: GitHub Actions Workflow Monitoring and Healing
系统 SHALL 能够轮询 GitHub Actions 工作流的运行状态，并在 Actions 运行失败或异常终止（包括 failure、cancelled、timed_out）时提供自愈修复与失败日志提取；在代码推送后的初次与再次流水线发现（Discovery）阶段，系统 SHALL 严格比对流水线对应的 Commit SHA（`head_sha`）或排除前序流水线 ID，杜绝读取历史已结束流水线。

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
