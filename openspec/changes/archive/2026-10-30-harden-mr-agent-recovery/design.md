## Context

详见 `proposal.md`。当前 MR 流程已经具备流水线发现、失败 Job 检测和 Agent 修复能力，但这些逻辑分布在平台适配、MR 编排和 Agent 容器三个边界中，容易出现状态不一致：日志截取不包含真正错误、Agent 直接提交未被识别、重新推送后重新查询仍拿到旧 Run，以及长会话上下文过大导致恢复中断。

## Goals / Non-Goals

**Goals:**
- 建立可测试的失败日志摘要策略，优先错误行及其有限上下文，并控制传给 LLM 的长度。
- 用 Git 分支相对远程分支的领先提交数与暂存区状态共同判断修复是否有效。
- 记录修复前 Run ID，重新推送后要求新的 Run ID；对旧 Run 的重复返回继续等待。
- 为 Agent SessionManager 配置自动压缩，保留最近失败诊断、恢复消息和工作区状态。
- 保证 Specboard 修复发布只涉及 Specboard 服务和镜像，不触碰目标任务执行控制。

**Non-Goals:**
- 不改变 GitHub API 凭据、权限模型或目标仓库的 CI 配置。
- 不修改目标项目 `retro-ssh` 的业务代码或测试代码。
- 不改变自动恢复预算、阶段状态机和用户审阅/归档规则。

## Decisions

### 决策 1：基于错误标记提取日志摘要
在 GitHub Job 日志中扫描 `error`、`FAILED:`、`fatal:`、编译器错误码、`##[error]` 等标记，选取最后一个有效错误点附近的有限上下文；若没有标记则退回日志尾部。这样比固定截取尾部更能排除 cleanup 噪声，同时保持长度有界。

**替代方案**：把完整日志发送给 Agent。该方案会放大上下文消耗，并可能触发模型限制，因此不采用。

### 决策 2：修复有效性采用双信号判断
修复有效条件为“暂存区有变更”或“当前分支相对 `origin/<task-branch>` 有领先提交”。如果 Agent 已经提交，允许直接推送；如果两者都为空，则明确阻塞。

**替代方案**：只依赖 `git diff --cached`。这正是当前直接提交修复被误判的根源，不采用。

### 决策 3：新流水线必须拥有不同 ID
在修复推送前保存当前 Pipeline ID；推送后即使平台仍返回旧 Run，也继续按发现间隔查询，直到拿到不同 ID 或达到发现超时。该规则同时适用于 GitHub Actions 和可扩展的 GitLab Pipeline 实现。

### 决策 4：Agent 会话启用默认自动压缩
通过 Agent SDK 的会话设置启用自动压缩，设置明确的保留 token 和响应预留空间。压缩由 SDK 负责，不在 Specboard 自己复制或重写会话历史；Specboard 仅继续持久化会话事件。

### 决策 5：修复发布与任务执行隔离
部署操作只替换 Specboard API/Agent 镜像并保留数据卷；不删除目标任务容器、不重置目标任务 Episode、不改写目标项目工作区。目标任务若处于活动状态，部署后由 Dispatcher 按租约恢复或继续运行。

## Risks / Trade-offs

- **[Risk] 某些编译器错误不含统一关键词** → **Mitigation**：保留日志尾部回退，并通过回归测试覆盖 MSVC、Clang、GCC 常见错误格式。
- **[Risk] 新 Run 创建超过发现窗口** → **Mitigation**：继续使用有界超时并上报明确超时；不伪造成功；后续可由用户消息触发恢复。
- **[Risk] 自动压缩丢失较早上下文** → **Mitigation**：保留当前恢复消息、最近错误摘要和工作区事实；原始会话文件仍持久化，不做破坏性删除。
- **[Risk] 部署期间活动 Agent 短暂重启** → **Mitigation**：保留会话/工作区卷，使用租约和 generation 防止旧 Agent 写入，健康检查通过后再恢复 Dispatcher。

## Migration Plan

1. 先添加日志摘要、直接提交识别、新 Run ID 等单元测试。
2. 修改 Specboard 源码并运行 `npm run check`、`npm run lint`、`npm test`。
3. 构建 Linux amd64 API/Agent 镜像，保留测试服务器持久化卷后滚动更新。
4. 仅对 Specboard 服务做健康检查；不自动操作任何目标项目任务。
5. 若部署异常，恢复 `/opt/specboard/compose.before-*.yaml` 与上一版本镜像，数据库 BIGINT 迁移保持兼容。
