## 1. 服务端状态变更版本化修复

- [x] 1.1 在 `src/runtime-service.ts` 的 `complete(...)` 方法中，在更新 `tasks` 表时追加 `outcome_revision = outcome_revision + 1`，确保每次运行结束生成成果时版本递增。

## 2. 客户端通知观察机制修复

- [x] 2.1 修改 `public/notifications.js` 中的 `notificationFor` 函数：针对状态发生跃迁（`isTransition`）或者首次观察到需要用户介入的任务（`isFirstActionable`）均返回对应的通知类型。
- [x] 2.2 确保通知 Key `notificationKey` 包含 `task.outcome_revision`，保证每轮澄清恰好消费一次通知，不发生漏发或无限重复。
- [x] 2.3 补充 `test/notifications.test.ts` 中的单元测试，覆盖首次观察到待澄清任务以及多次状态流转的通知判定。

## 3. 全量测试与环境验证部署

- [x] 3.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 重新编译 amd64 镜像并滚动更新测试服务器 `10.9.34.84`，验证新建任务进入“待你澄清”时正常触发浏览器桌面通知。
