## 1. 状态映射与呈现重构

- [x] 1.1 在 `public/task-status.js` 中重构 `taskStatusLabel` 与 `taskStatusClass`，当 `task.wait_reason !== 'clarification_required'` 时正确将 Explore 任务标注为“探索完成 · 待推进”，消除对已消费澄清或无需提问任务的错误拦截。
- [x] 1.2 在 `public/notifications.js` 中优化 `notificationFor`，仅当任务因存在待回答问题（`wait_reason === 'clarification_required'`）而变更时触发系统桌面通知，抑制探索完成待推进时的多余通知。

## 2. 自动化测试用例校验

- [x] 2.1 在 `test/task-status.test.ts` 中补充覆盖 Explore 任务在不同 `wait_reason`（`clarification_required` vs `null`）下的标签及 CSS 类断言。
- [x] 2.2 在 `test/notifications.test.ts` 中补充通知过滤测试，验证无未决问题时的通知抑制逻辑。
- [x] 2.3 运行本地全部质量门禁（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。

## 3. 测试环境打包构建与部署验证

- [x] 3.1 本地交叉编译构建 Linux amd64 API 镜像（`specboard-api:ui-animations-amd64`）。
- [x] 3.2 传输镜像至测试服务器 `10.9.34.84`，滚动重启 Compose 服务，验证服务健康检查及 `retro-ssh` 任务状态正确恢复为“探索完成 · 待推进”。
