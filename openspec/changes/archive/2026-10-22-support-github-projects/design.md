## Context

参见 `proposal.md`。当前系统仅内置 `GitLabClient` 用于与 GitLab API 通信，项目校验、MR 创建及 Pipeline 轮询均假定为 GitLab 平台。

## Goals / Non-Goals

**Goals:**
- **统一代码托管接口抽象**：提炼 `GitPlatformClient` 通用接口，隔离平台差异。
- **支持 GitHub 协议与 API**：
  - REST API 基础地址：`https://api.github.com`；
  - 认证方式：`Authorization: Bearer <token>`；
  - PR 模型适配：映射到统一的 MR 数据结构（`mrIid` 对应 GitHub PR 的 `number`，`webUrl` 对应 `html_url`）；
  - Actions 模型适配：映射 Workflow Run 的 `status` 与 `conclusion` 到统一的 Pipeline 状态模型。
- **自动检测与无缝兼容**：
  - 根据 URL 自动判定 Provider（`github.com` -> `github`，其余为 `gitlab`）；
  - 允许环境变量 `GIT_ALLOWED_HOSTS` 配置白名单，默认包含 `github.com`。

**Non-Goals:**
- 不支持 GitHub Enterprise Server 的自定义私有域名（后续如需要可扩展）。
- 不改变底层 Git worktree 的本地操作机制。

## Decisions

### 1. 通用客户端接口定义
- **决策**：创建 `src/git-platform.ts`（或在 `mr-service.ts` 中抽象），定义接口：
  ```typescript
  export interface UnifiedMergeRequest {
    iid: number;
    title: string;
    description?: string;
    web_url: string;
    source_branch: string;
    target_branch: string;
  }
  export interface UnifiedPipeline {
    id: number;
    status: 'pending' | 'running' | 'success' | 'failed' | string;
    web_url: string;
  }
  export interface GitPlatformClient {
    createOrUpdateMR(input: {sourceBranch: string; targetBranch: string; title: string; description?: string}): Promise<UnifiedMergeRequest>;
    getLatestPipeline(ref: string): Promise<UnifiedPipeline | null>;
    getFailedJobTrace(pipelineId: number): Promise<{name: string; trace: string} | null>;
  }
  ```
- **备选方案**：直接在 `mr-service.ts` 里堆叠 `if (isGithub)`。放弃原因：会导致逻辑混乱、不易单测。

### 2. GitHub 状态与 GitLab 状态映射
- **决策**：
  - Actions 运行状态映射：
    - `status === 'queued'` 或 `status === 'in_progress'` -> `'running'`
    - `conclusion === 'success'` -> `'success'`
    - `conclusion === 'failure'` 或 `conclusion === 'timed_out'` -> `'failed'`
  - PR 参数映射：
    - GitHub PR 创建入参为 `{head: sourceBranch, base: targetBranch, title, body: description}`；
    - 更新为 `PATCH /repos/{owner}/{repo}/pulls/{number}`。

### 3. 项目验证改造
- **决策**：在 `src/runtime-api.ts` 的 `POST /api/v1/projects` 与 `PUT /api/v1/projects/:id` 中，依据 URL 的 host 分流：
  - 若 `url.host === 'github.com'`：使用 `GitHubClient.validate(owner, repo, branch, token)`；
  - 否则：走现有 GitLab 验证逻辑。

## Risks / Trade-offs

- **[Risk] GitHub API 速率限制 (Rate Limiting)**
  → **Mitigation**：GitHub 对带 Token 的请求提供 5000 次/小时配额，系统轮询间隔设定为 5 秒，单次最大轮询 30 次，消耗极小；在响应中增加速率耗尽检测与异常提示。
