# github-integration Specification

## Purpose
为 Specboard 研发协同系统提供对 GitHub 代码托管平台的完整接入能力，包括 GitHub 仓库配置校验、Pull Request 自动创建与更新、GitHub Actions 工作流状态轮询及失败自愈修复。

## Requirements

### Requirement: GitHub Repository Configuration and Validation
系统 SHALL 支持配置 GitHub 代码仓库，并通过 GitHub REST API 校验仓库与默认分支的有效性，且默认始终内置放行 `github.com` 与 `gitlab.com` 主机。

#### Scenario: Validating GitHub repository
- **WHEN** 用户添加或编辑一个 GitHub 仓库（HTTPS URL 域名为 `github.com`）时
- **THEN** 系统 SHALL 使用用户提供的 Personal Access Token 调用 GitHub API（`GET /repos/{owner}/{repo}/branches/{branch}`）进行可访问性校验。

#### Scenario: Unsupported repository host
- **WHEN** 用户输入的仓库地址既不是环境配置的额外允许域名，也不是默认内置信任的 `github.com` 或 `gitlab.com` 时
- **THEN** 系统 SHALL 拒绝该配置并返回清晰的报错信息。

#### Scenario: Custom allowed hosts environment variable coexistence
- **WHEN** 环境变量（`GIT_ALLOWED_HOSTS` 或 `GITLAB_ALLOWED_HOSTS`）仅配置了私有代码托管域名时
- **THEN** 系统 SHALL 将该配置与默认内置的 `github.com` 和 `gitlab.com` 合并并集，不得因配置了私有域名而屏蔽 `github.com`。

### Requirement: Pull Request Lifecycle Management
在任务进入 `MR` 阶段时，对于 GitHub 项目，系统 SHALL 自动创建或更新 Pull Request（PR）。

#### Scenario: Creating a new Pull Request
- **WHEN** 任务进入 `MR` 阶段且目标分支上尚无打开的 PR 时
- **THEN** 系统 SHALL 调用 GitHub API 创建一个新的 Pull Request，指定 `head` 为任务分支，`base` 为默认分支，并填充标准格式的标题与描述。

#### Scenario: Updating an existing Pull Request
- **WHEN** 目标分支上已存在针对该任务分支打开的 PR 时
- **THEN** 系统 SHALL 复用该 PR 并更新其标题与描述，不重复创建 PR。

### Requirement: GitHub Actions Workflow Monitoring and Healing
系统 SHALL 能够轮询 GitHub Actions 工作流的运行状态，支持异步流水线初始生成的有界等待，并在 Actions 运行失败时提供自愈修复；在代码推送后的初次与再次流水线发现（Discovery）阶段，系统 SHALL 严格比对流水线对应的 Commit SHA（`head_sha`）或排除前序流水线 ID，杜绝读取历史已结束流水线。

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
- **WHEN** PR 创建或更新完成且远程 GitHub Actions 尚未生成流水线实例（查询结果为空）时
- **THEN** 系统 SHALL 维持有界的初始发现轮询（默认持续等待至少 30 秒，间隔 3 秒），严禁将未生成的空实例视为成功或提前中断退出。

#### Scenario: Handling repositories without configured CI
- **WHEN** 初始发现轮询超时，且确认代码仓库未配置 GitHub Actions 工作流文件时
- **THEN** 系统 SHALL 记录无流水线状态并正常推进，且不得上报虚假的流水线 ID。

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

### Requirement: Adaptive UI Presentation for GitHub Projects
前端界面 SHALL 根据项目类型（GitLab / GitHub）自适应调整术语和界面元素展示，且在所有表单状态（新建、重置、编辑、前置校验拦截及运行摘要）中严格杜绝硬编码为单一平台（如仅显示“GitLab 项目”）。

#### Scenario: Displaying GitHub PR status
- **WHEN** 用户查看一个属于 GitHub 项目的任务详情时
- **THEN** 界面在 MR 阶段卡片中 SHALL 展示“GitHub Pull Request 与 Actions 状态”，显示正确的 PR 链接与 Actions 运行状态。

#### Scenario: Resetting or creating repository form
- **WHEN** 用户打开项目抽屉或点击“+ 新增项目”/“清空”重置表单时
- **THEN** 表单标题 SHALL 统一显示中立化的“添加代码仓库（GitHub / GitLab）”，避免退化为硬编码的“添加 GitLab 项目”。

#### Scenario: Editing repository form
- **WHEN** 用户点击编辑某个已配置的项目时
- **THEN** 表单标题 SHALL 根据仓库平台动态展示“编辑 GitHub 项目”/“编辑 GitLab 项目”，或中立展示“编辑项目配置”。

#### Scenario: Intercepting task creation without projects
- **WHEN** 用户在未配置任何项目的情况下点击“创建任务”时
- **THEN** 系统 SHALL 弹出友好提示“请先配置一个代码仓库（GitHub / GitLab）”，不得提示单一平台。
