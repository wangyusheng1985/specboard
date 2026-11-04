## Context

详见 `proposal.md`。当前 `src/mr-service.ts` 中的 `runMRStage` 在调用 `platform.createOrUpdateMR` 之后，立即单次调用 `platform.getLatestPipeline(branch)`。此时 GitHub/GitLab 异步队列通常尚未创建工作流运行实例，导致 `pipeline` 为 `null`。随后的 `while (pipeline && ...)` 直接跳过，而 `if (!pipeline || pipeline.status === 'success') break` 又将其作为成功直接跳出，最终以 `pipeline_id = undefined` 和 `pipelineStatus = 'success'` 写入数据库，造成时序竞态漏洞。

## Goals / Non-Goals

**Goals:**
- 将流水线跟踪拆分为“初始生成发现等待”与“运行状态轮询与自愈”两个清晰阶段。
- 在创建/更新 PR/MR 后，提供有界（默认 45 秒，每 3 秒一次）的初始发现轮询窗口，直到远程平台返回流水线实例。
- 区分代码仓库是否配置了 CI：若配置了 CI 但超时未触发，视为调度超时或异常；若未配置 CI，则安全跳过流水线校验，且明确标识无 CI。
- 修复状态兜底逻辑：严禁在 `pipeline` 仍为 `null` 时上报 `success` 并静默通过。

**Non-Goals:**
- 不重构 `GitHubClient` / `GitLabClient` 的底层通讯架构。
- 不变更系统核心阶段状态机模型（`Explore -> Propose -> Apply -> MR -> Archive`）。

## Decisions

### 决策 1：拆分初始发现（Discovery）与运行轮询（Execution Polling）
- **方案**：在 `runMRStage` 中引入独立的 `discoverPipeline` 辅助循环，在 PR 创建后以 3 秒为间隔进行有界轮询（最大 15 次，总计 45 秒）。一旦发现流水线实例，立即上报真实 `pipelineId` 并进入现有的运行状态追踪与多轮自愈循环。
- **替代方案考虑**：仅在现有 `while (rounds < maxRounds)` 循环中增加 `null` 处理。缺点是会把“等待流水线创建”与“修复代码重新触发”的重试轮数（`rounds`）混在一起，导致逻辑混乱。

### 决策 2：仓库 CI 配置的存在性判定
- **方案**：在发现超时后，检查工作区根目录下是否存在 `.github/workflows`（针对 GitHub）或 `.gitlab-ci.yml`（针对 GitLab）。
  - 若存在对应配置但未抓取到流水线，则认定为流水线触发失败或排队超时，抛出异常进入自愈/人工介入流程。
  - 若仓库确实未配置任何 CI 工作流，则将 `pipelineStatus` 标记为 `'none'` 或跳过校验，不在数据库中记录虚假的 `pipeline_id`。
- **替代方案考虑**：无条件将未发现视为错误。缺点是对没有 CI 的轻量项目造成阻塞无法归档。

### 决策 3：前端展示与状态上报一致性
- **方案**：调用 `/internal/v1/runs/:id/mr` 时，如未触发流水线，上报 `pipelineStatus: 'none'`，前端显示“无需流水线”或“未配置 CI”，彻底消除“Actions: 等待触发”卡死状态。

## Risks / Trade-offs

- **[Risk] GitHub API 访问频率限制（Rate Limit）** → **Mitigation**：初始发现轮询间隔设为 3 秒，最长 45 秒仅消耗最多 15 次 API 调用，处于远低于 GitHub API 速率限制的安全区间。
- **[Risk] 极端情况下 Actions 排队超过 45 秒** → **Mitigation**：支持通过 `ctx.discoveryTimeoutMs` 覆盖默认等待时间，并在日志中输出等待探测进度。

## Migration Plan

1. 编写针对 `src/mr-service.ts` 的初始发现与时序竞态回归测试用例。
2. 修复 `src/mr-service.ts` 中的轮询与状态判定逻辑。
3. 运行本地验证：`npm run check`、`npm run lint`、`npm test`。
4. 部署到测试服务器 `10.9.34.84` 并验证。
