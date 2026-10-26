## 1. 模板骨架拆分与独立表单

- [x] 1.1 在 `public/index.html` 中为澄清卡片添加 `#clarification-card` 并默认 `hidden`，将 `#message-form` 拆离并放入独立的 `#feedback-card`（“补充需求与反馈”），调整卡片纵向排布顺序。
- [x] 1.2 在 `public/style.css` 中为 `#feedback-card` 及表单区域添加紧凑优化的样式，确保视觉低噪声与开阔感。

## 2. 状态机与条件渲染重构

- [x] 2.1 在 `public/app.js` 的 `renderClarifications` 中重构卡片显隐控制：仅当当前阶段存在 `status === 'pending'` 的澄清批次且处于当前阶段时才展示 `#clarification-card`，其余情况自动隐藏。
- [x] 2.2 确保用户通过独立 `#message-form` 发送消息后，当前阶段能够正常推进与刷新。

## 3. 质量门禁与部署验证

- [x] 3.1 运行全量代码检查与自动化测试（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 跨平台打包构建 amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，在浏览器端验证已完成的探索任务不再展示“待你确认”和旧问答记录，首屏直达过程产物与成果。
