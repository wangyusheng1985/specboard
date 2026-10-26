## Why

当前 Specboard 仅支持 GitLab 项目接入。在 `MR` 阶段，系统依赖 GitLab 专属的 `/api/v4/` 接口创建 Merge Request（MR），并轮询 GitLab CI Pipeline 状态。这导致 GitHub 项目无法被正常接入与验证。GitHub 与 GitLab 在术语、API 路径、鉴权方式及 CI 流水线结构上存在显著差异（如 GitHub 称为 Pull Request / PR，CI 称为 Actions，鉴权使用 Bearer Token 等）。

为了扩展 Specboard 的生态兼容性，需要系统性地调查并实现 GitHub 项目的接入、PR 创建、Actions 流水线轮询与自愈修复能力。

## What Changes

本变更为系统引入 GitHub 项目支持，包含以下核心改造点：

- **项目类型自动识别与配置**：
  - 在项目配置中引入 `provider` 字段（`gitlab` 或 `github`），根据仓库 HTTPS 地址自动识别（如 `github.com` 自动识别为 `github`，`gitlab.com` 识别为 `gitlab`）。
  - 数据库 `projects` 表增加 `provider` 字段，持久化项目类型。
- **GitHub API 客户端实现 (`GitHubClient`)**：
  - 新增 `src/github-client.ts`，实现 GitHub REST API v3 客户端，支持：
    - 校验仓库与默认分支是否存在（`GET /repos/{owner}/{repo}` 与 `GET /repos/{owner}/{repo}/branches/{branch}`）；
    - 创建或更新 Pull Request（`POST /repos/{owner}/{repo}/pulls` 与 `PATCH /repos/{owner}/{repo}/pulls/{pull_number}`）；
    - 查询指定分支的最新 Actions 运行状态（`GET /repos/{owner}/{repo}/actions/runs?branch={branch}`）；
    - 获取失败 Job 的日志（`GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`）。
- **MR 阶段服务重构 (`mr-service.ts`)**：
  - 将 `runMRStage` 抽象为支持多 Provider 的统一流程。
  - 在 GitHub 模式下，将术语“MR”映射为“PR”，将“Pipeline”映射为“Actions Run”。
  - 支持 GitHub Actions 失败日志的提取、诊断与自愈修复（Amend Commit + Force Push + 重新轮询）。
- **前端项目配置与展示适配**：
  - 在项目配置抽屉中增加“代码托管平台”选择（GitLab / GitHub），并动态调整表单提示（如 Token 提示、仓库地址占位符）。
  - 在任务详情抽屉的 MR 阶段成果展示中，根据项目类型动态显示“GitLab Merge Request”或“GitHub Pull Request”及对应的 CI 状态。

## Capabilities

### New Capabilities
- `github-integration`: 为 Specboard 提供 GitHub 项目接入、Pull Request 创建与 GitHub Actions 流水线轮询自愈能力。

### Modified Capabilities
<!-- 本次不修改已有规范契约 -->

## Impact

- **数据库与迁移**：
  - `src/runtime-migration.ts`：为 `projects` 表增加 `provider` 字段（默认 `'gitlab'`）。
- **后端服务与 API**：
  - `src/runtime-api.ts`：更新项目创建与更新接口，支持 `provider` 字段，并在验证仓库时根据 `provider` 调用对应的 API。
  - `src/github-client.ts`：新增 GitHub API 客户端。
  - `src/mr-service.ts`：重构 `runMRStage`，支持 GitHub 模式。
- **前端界面**：
  - `public/index.html`：项目配置表单增加平台选择。
  - `public/app.js`：更新项目列表展示与任务详情中的 MR/PR 渲染逻辑。
- **测试**：
  - `test/github-client.test.ts`：新增 GitHub 客户端单元测试。
  - `test/mr-service.test.ts`：补充 GitHub 模式下的 MR 阶段测试。
