## 1. 前端表单与拦截提示中立化改造

- [x] 1.1 修改 `public/app.js` 中的 `resetProjectForm`，将表单标题设为“添加代码仓库（GitHub / GitLab）”，避免点击重置或新增时标题退化为“添加 GitLab 项目”。
- [x] 1.2 修改 `public/app.js` 中的编辑项目点击处理，根据仓库 URL 动态将标题设为“编辑 GitHub 项目”或“编辑 GitLab 项目”。
- [x] 1.3 修改 `public/app.js` 中的创建任务（`#new-task`）按钮点击逻辑，当无项目配置时，将错误提示改为“请先配置一个代码仓库（GitHub / GitLab）”。

## 2. 运行时阶段摘要与验证提示自适应

- [x] 2.1 修改 `src/agent-container.ts` 中的 MR 阶段完成摘要，根据 `mrResult.mr.is_pr` 动态输出 `GitHub Pull Request #${mrResult.mr.iid} created and Actions passed.` 或 `GitLab Merge Request !${mrResult.mr.iid} created and CI pipeline passed.`。
- [x] 2.2 修改 `src/stage-verification.ts` 中的 MR 阶段检查项文本，使用中立的“Code review request (MR/PR) verified and pipeline passed”。

## 3. 全量测试与环境验证

- [x] 3.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有相关测试通过。
- [x] 3.2 重新编译 amd64 镜像并滚动更新测试服务器 `10.9.34.84`，验证前端页面与抽屉展示。
