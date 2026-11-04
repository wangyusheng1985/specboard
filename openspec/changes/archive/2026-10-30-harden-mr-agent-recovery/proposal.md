## Why

Specboard 当前已经能够识别 GitHub Actions 的流水线和 Job 失败，但在自动修复闭环中仍存在几个可靠性缺口：失败日志可能只截取到清理阶段，导致真正的编译错误没有传递给 Agent；Agent 已经直接创建提交时，MR 服务只检查暂存区而误判“没有修复”；重新推送后可能继续追踪旧的流水线；长时间 MR 会话还可能因上下文增长而停止。需要将这些边界行为固化，避免自动开发任务在无需人工介入时反复失败。

## What Changes

- 改进 GitHub Actions 失败日志提取，优先保留编译器错误、构建失败和关键诊断上下文，而不是简单截取日志尾部。
- 将 Agent 已直接提交但工作区无暂存修改识别为有效修复，并继续推送该提交。
- 重新推送后要求发现新的流水线实例，避免重复轮询旧 Run。
- 为 MR Agent 会话启用有界的自动上下文压缩，保留当前工作区、失败原因和修复上下文。
- 增加上述边界场景的自动化回归测试。
- 本变更仅修改 Specboard 运行时与测试代码，**不修改、不暂停、不接管任何自动开发任务的目标代码工作区**。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `github-integration`: 强化 GitHub Actions 失败诊断、流水线重试与新 Run 绑定语义。

## Impact

- 受影响代码：`src/mr-service.ts`、`src/git-platform.ts`、`src/github-client.ts`、`src/agent-container.ts` 及对应测试。
- 运行时行为：失败自愈将获得更准确的诊断输入，并避免重复使用旧流水线；正常成功路径保持兼容。
- 部署范围：后续实现完成后只部署 Specboard API/Agent 镜像；不触碰目标项目工作区和目标项目的开发任务状态。
