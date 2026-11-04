## 1. 运行时 Agent Explore 阶段提示词修正

- [x] 1.1 在 `src/agent-container.ts` 与 `src/agent.ts` 中修正 Explore 阶段系统提示词覆盖逻辑：明确当用户要求绘制/生成原型、demo 页面或 HTML 时，Agent 直接执行写操作生成文件，不再返回确认阻断。

## 2. 产物独立模态弹窗预览（Modal Preview）实现

- [x] 2.1 在 `public/index.html` 中新增 `<dialog id="artifact-preview-dialog">` 模态弹窗结构，包含标题栏、在新标签页打开链接、复制按钮与独立关闭操作。
- [x] 2.2 在 `public/style.css` 中定义 `#artifact-preview-dialog` 样式体系（大尺寸居中弹窗、微阴影、全高自适应 iframe 及暗调半透明 backdrop 遮罩）。
- [x] 2.3 在 `public/app.js` 中将原先内联折叠的预览逻辑升级为打开 `#artifact-preview-dialog` 弹窗预览，并在关闭时安全回收 `Blob URL`。

## 3. 验证与测试

- [x] 3.1 运行全量代码验证（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过无回归。
