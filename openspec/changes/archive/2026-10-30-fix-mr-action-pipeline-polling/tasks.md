## 1. 测试用例与时序竞态模拟

- [x] 1.1 在 `test/mr-service-github.test.ts` 中新增异步流水线初始发现延迟测试用例，模拟前 2 次查询返回 `null`、第 3 次返回 `queued` 的场景，验证其能正确等待并捕获流水线
- [x] 1.2 在 `test/mr-service-github.test.ts` 中新增有 CI 配置超时未触发的异常用例及无 CI 配置的安全跳过用例，验证状态区分准确性

## 2. 核心轮询与状态判定实现

- [x] 2.1 在 `src/mr-service.ts` 中引入有界的初始流水线发现轮询逻辑（`discoverPipeline`），避免在 PR 创建后因即时查询返回 `null` 而提前退出
- [x] 2.2 增加对工作区是否存在 CI 配置文件（`.github/workflows` 或 `.gitlab-ci.yml`）的判定机制，严禁在 `pipeline === null` 时默认按 `success` 上报
- [x] 2.3 修正流水线状态与元数据上报逻辑，确保成功获取到流水线实例后立即绑定真实的 `pipelineId`、`pipelineStatus` 并进入后续轮询与失败自愈流程

## 3. 全量校验与部署验证

- [x] 3.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有类型检查、代码风格及自动化测试全部通过
- [x] 3.2 自动构建 Linux amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，验证容器健康及服务就绪
