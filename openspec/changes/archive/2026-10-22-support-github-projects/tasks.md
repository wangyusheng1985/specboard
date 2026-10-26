## 1. 客户端抽象与 GitHub Client 实现

- [x] 1.1 新增 `src/github-client.ts`，实现 `GitHubClient` 类，支持仓库与分支验证、Pull Request 获取/创建/更新、最新 Actions Workflow Run 状态获取及失败 Job 日志拉取，并在 `test/github-client.test.ts` 中编写完整的 Mock 单测。
- [x] 1.2 提炼统一的代码托管平台工厂或适配层，使平台通信接口解耦。

## 2. 服务端 API 与项目配置支持

- [x] 2.1 在 `src/runtime-api.ts` 中扩展项目创建与更新逻辑：根据仓库 URL 自动识别 Provider（`github` 或 `gitlab`），并支持在白名单中配置 `github.com`（默认环境变量兼容 `GITLAB_ALLOWED_HOSTS` 与 `GIT_ALLOWED_HOSTS`）。
- [x] 2.2 在 `test/runtime-api.test.ts` 中增加配置 GitHub 项目与校验分支的测试用例。

## 3. MR 阶段自愈与 Actions 轮询整合

- [x] 3.1 重构 `src/mr-service.ts` 中的 `runMRStage`：根据项目 URL 自动选择对应的客户端（GitLab / GitHub）；在 GitHub 模式下使用 Pull Request 与 GitHub Actions，并支持失败日志注入会话及自愈推送。
- [x] 3.2 在 `test/mr-service.test.ts` 中增加针对 GitHub 仓库的 PR 创建、Actions 成功以及 Actions 失败自愈的单测用例。

## 4. 前端展示自适应适配

- [x] 4.1 在 `public/index.html` 的项目配置抽屉中更新文案与提示（标题支持 GitHub/GitLab 项目，Token 提示支持 GitHub PAT）。
- [x] 4.2 在 `public/app.js` 的任务详情 MR 阶段成果展示中，根据仓库 URL 或 provider 动态渲染“GitHub Pull Request”与“Actions 状态”或“GitLab Merge Request”与“CI 状态”。

## 5. 全量验证与测试环境部署

- [x] 5.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有 TypeScript 检查、代码风格及自动化测试全部通过。
