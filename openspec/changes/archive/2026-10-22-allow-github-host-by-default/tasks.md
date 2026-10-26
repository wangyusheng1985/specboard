## 1. 白名单合并算法改造与环境变量模板更新

- [x] 1.1 在 `src/runtime-api.ts` 中重构域名白名单解析：将环境配置（`GIT_ALLOWED_HOSTS` / `GITLAB_ALLOWED_HOSTS`）与保底 `github.com`、`gitlab.com` 取并集。
- [x] 1.2 更新 `compose.yaml` 与 `.env.example`，将原 `GITLAB_ALLOWED_HOSTS` 说明升级为 `GIT_ALLOWED_HOSTS` 并注明其合并特性。

## 2. 自动化测试保障

- [x] 2.1 在 `test/runtime-project-validation.test.ts` 中增加测试用例：当环境变量仅配置私有域名（如 `git.internal.net`）时，验证添加 `github.com` 项目依然合法通过。

## 3. 全量测试与环境部署验证

- [x] 3.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 重新编译 amd64 镜像并部署到测试服务器 `10.9.34.84`，验证真实 GitHub 仓库添加成功。
