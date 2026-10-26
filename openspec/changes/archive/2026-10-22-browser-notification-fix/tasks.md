## 1. 服务端状态派生修复

- [x] 1.1 在 `src/runtime-api.ts` 的 `/api/v1/lane` 路由中，引入 `projectOutcome` 并为查询返回的每个任务对象映射计算 `outcome_state: projectOutcome(row)`，并在 `test/runtime-api.test.ts` 中验证接口返回的任务具备合法的 `outcome_state`。

## 2. 前端通知全阶段覆盖与兼容性修复

- [x] 2.1 在 `public/notifications.js` 中将 `STAGES` 常量扩充为 5 个阶段（含 `MR`），更新 `notificationFor` 使其支持 `MR` 阶段任务交付与受阻判断，并在 `test/notifications.test.ts` 中补齐单测用例。
- [x] 2.2 在 `public/notifications.js` 中将通知图标由 `/favicon.svg` 调整为高兼容性位图 `/apple-touch-icon.png`。

## 3. 即时测试通知与用户交互自检机制

- [x] 3.1 在 `public/notifications.js` 的通知适配器中新增 `notifyTest(origin)` 方法，用于即时向系统通知中心派发一条包含标题和说明的自检测试通知。
- [x] 3.2 在 `public/app.js` 的 `enableNotifications()` 中，当用户首次成功授权允许通知时，自动调用 `notifyTest()` 发送自检通知，并通过 Toast 明确提示用户“已启用通知并派发测试通知”；在通知按钮上补充测试通知快捷触发指引。

## 4. 全量验证与测试环境部署

- [x] 4.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有 TypeScript 检查、代码风格及自动化测试全部通过。
