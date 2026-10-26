## 1. 矢量 SVG 图标与基础结构升级

- [x] 1.1 在 `public/index.html` 中将垃圾桶 `🗑️` emoji 替换为双路径 SVG 矢量图标（桶身与可旋转倾斜的桶盖），外链替换为清晰的斜向箭头 SVG，所有装饰图标补齐 `aria-hidden="true"`，并通过浏览器检查结构正确渲染。
- [x] 1.2 在 `public/index.html` 顶部增加全局浮动通知容器 `<div id="toast-container" class="toast-container" role="region" aria-live="polite"></div>`，并验证其不影响底层页面元素的点击穿透（`pointer-events: none`）。

## 2. 状态映射与任务卡片呼吸流光体系

- [x] 2.1 在 `public/task-status.js` 中增加 `taskStatusClass(task)` 辅助函数，将任务状态映射为对应的视觉状态类（`status-running`、`status-waiting`、`status-delivered`、`status-failed`），并在 `test/task-status.test.ts` 中编写单测验证映射逻辑。
- [x] 2.2 在 `public/style.css` 中实现运行中呼吸灯（`pulse-dot` 与 `@keyframes ping`）和卡片环境流光边框（`@keyframes card-glow`），确保状态切换时无生硬跳变。
- [x] 2.3 在 `public/app.js` 的 `renderLane` 与 `syncBoardTask` 中为任务卡片和徽标绑定对应的状态类与呼吸指示点，验证 1.2 秒轮询时动画能够平滑持续播放而不被反复打断。

## 3. 看板拖拽与垃圾桶物理微动效

- [x] 3.1 在 `public/style.css` 中增加拖拽态增强样式：卡片抓取时轻微旋转（`rotate(2deg) scale(1.02)`）与加深阴影、目标泳道呼吸虚线高亮（`lane.drop`）。
- [x] 3.2 在 `public/style.css` 中针对 `.trash-zone.drag-over` 编写桶盖物理弹起位移与微旋动效（`transform: translateY(-3px) rotate(-18deg)`），并在悬停时呈现柔和危险红晕。
- [x] 3.3 在 `public/app.js` 的拖拽事件中确保 `is-dragging` 和 `drag-over` 类名在拖拽启动、离开、放置、取消时准确增删，验证卡片拖至垃圾桶时盖子丝滑弹开。

## 4. 阶段流转步骤条声呐光波与内容过渡

- [x] 4.1 在 `public/style.css` 中为 `.stage-step.current .step-number` 增加声呐波纹扩散动画（`@keyframes pulse-ring`），并为步骤之间增强连接线与当前阶段高光底色。
- [x] 4.2 在 `public/style.css` 中新增 `.view-fade` 平滑淡入关键帧（`@keyframes view-crossfade`，150ms 优雅减速）。
- [x] 4.3 在 `public/app.js` 的 `updateDetail` 中，当用户点击历史或当前步骤切换查看时，对展示容器施加平滑淡入效果，验证切换阶段内容无突兀闪烁。

## 5. 浮动 Toast 通知调度系统

- [x] 5.1 在 `public/style.css` 中编写 `.toast`、`.toast-success`、`.toast-error`、`.toast-info` 的滑入（`toast-in` 0.24s）与滑出（`toast-out` 0.18s）动画及悬停阴影。
- [x] 5.2 在 `public/app.js` 中实现 `showToast(message, type, duration)` 管理器：支持自动倒计时退场（默认 3.5s）、鼠标悬停/获得焦点时暂停计时、移出后恢复、右上角关闭按钮，并保留最多 3 条并发队列。
- [x] 5.3 在 `public/app.js` 中将全局 `notice(text)` 函数无缝重定向为 `showToast`（区分成功、失败与一般提示），在抽屉开启时同步智能呈现，验证各类操作完成时 Toast 优雅滑入并按时退场。

## 6. 表单错误震颤、展开与草稿/复制微交互

- [x] 6.1 在 `public/style.css` 中实现表单错误输入框水平微震动（`@keyframes input-shake`，250ms）及错误说明文本的平滑下落展开（`max-height` 与 `opacity` 过渡）。
- [x] 6.2 在 `public/app.js` 的表单提交（连接工作空间、添加项目、创建任务）捕获到异常时，将对应的 input 添加 `.is-invalid` 类并展开错误文本；在用户重新聚焦输入（`input` 事件）时平滑收起。
- [x] 6.3 在 `public/style.css` 与 `public/app.js` 中将问答澄清表单的“草稿已保存”重构为状态微胶囊，保存成功触发轻微绿点弹动（`dot-pop`）与翠绿微光高亮。
- [x] 6.4 在 `public/app.js` 中为异步提交按钮（如验证并保存、开始探索）增加内置旋转微型 Spinner（`.btn-spinner`），并在复制诊断按钮点击后呈现微弹动对勾反馈，2 秒后平滑恢复原状。

## 7. 全量集成验证与无障碍降级检查

- [x] 7.1 在 `public/style.css` 末尾审查并严格应用 `@media (prefers-reduced-motion: reduce)`，确保在启用系统减弱动效时所有关键帧与过渡时间强制降为 0.01ms，功能正常且无眩晕。
- [x] 7.2 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有 TypeScript 检查、代码风格及自动化测试全部通过。
