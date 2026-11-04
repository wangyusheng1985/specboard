## MODIFIED Requirements

### Requirement: GitHub Actions Workflow Monitoring and Healing
系统 SHALL 能够轮询 GitHub Actions 工作流的运行状态，并在 Actions 运行失败或异常终止时提供自愈修复；在唤醒 Agent 修复时，系统 SHALL 明确指引 Agent 审查并更新工作区中的 CI 配置文件（如 `.github/workflows/ci.yml`）。

#### Scenario: Polling GitHub Actions status
- **WHEN** PR 创建或更新完成且已推送到远程分支时
- **THEN** 系统 SHALL 轮询该分支最新的 GitHub Actions Workflow Run 状态，直到其成功（`conclusion === 'success'`）或失败。

#### Scenario: Healing failed GitHub Actions run
- **WHEN** GitHub Actions 运行失败（`conclusion === 'failure'`、`cancelled` 或 `timed_out`）时
- **THEN** 系统 SHALL 提取失败 Job 的日志信息并注入给 Agent 会话，且在提示词中明确指示 Agent 故障可能由 CI 配置文件（如 `.github/workflows/ci.yml`）中的 Runner 标签过时或构建脚本错误引起，明确授权其审查和修改工作区中的 CI 配置文件，随后通过 `git commit --amend` 与强制推送重新触发流水线。
