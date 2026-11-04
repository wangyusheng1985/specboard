## Why

在当前 Specboard 的 MR 阶段执行过程中，系统在推送分支并成功创建 GitHub PR 后，会立即单次调用 `getLatestPipeline` 获取 Actions 流水线状态。由于 GitHub Actions 的工作流实例是由远程事件异步触发生成的，通常存在数秒至十几秒的队列时滞；而当前代码在首次返回 `null` 时将其错误视为“已完成或无需处理”，直接中断轮询并默认按成功交付，上报了包含空流水线 ID 的记录，导致界面始终显示“Actions: 等待触发”，且无法对后续真实流水线失败进行自愈。

## What Changes

- **初始流水线发现等待机制**：在推送分支与创建/更新 PR/MR 后，引入有界的初始发现轮询窗口（默认最长等待 30 秒，间隔 3 秒），持续轮询直到远程平台生成该分支或 PR 对应的流水线实例。
- **准确区分未配置 CI 与时滞场景**：仅在发现超时且仓库未包含 CI/Actions 配置文件时，才判定为无流水线安全跳过；严禁在首轮查询返回 `null` 时立即中断退出。
- **严格绑定流水线实例元数据**：严禁在流水线实例尚未生成时将状态兜底上报为 `success`，必须如实上报当前状态并在流水线生成后绑定真实的流水线 ID 与 URL。
- **流水线全生命周期追踪与自愈**：在 Actions 实例处于 `queued` 或 `in_progress` 时持续维持轮询，并在失败时正确拉取 Job 日志进行自主修复。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `github-integration`: 增强 GitHub Actions 与 CI 流水线状态轮询逻辑，引入初始流水线生成等待窗口与有界重试，防止由于时序竞态提前退出导致状态缺失。

## Impact

- 受影响模块：`src/mr-service.ts`（轮询与自愈主流程）、`src/git-platform.ts` / `src/github-client.ts`（工作流运行抓取逻辑）。
- 外部 API：GitHub REST API（`actions.listWorkflowRunsForRepo` 保持兼容）。
- 用户界面：修复 MR 阶段卡片无法展示 GitHub Actions 运行 ID 与真实状态的问题，恢复流水线失败时的自动重试与修复闭环。
