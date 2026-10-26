## 1. Agent 探索阶段过程文件支持与自动提取

- [x] 1.1 在 `src/agent-container.ts` 与 `src/agent.ts` 中放开 Explore 阶段文件写权限（`write`, `edit` 工具），提示词引导 Agent 支持按需输出原型或设计文件。
- [x] 1.2 在 `src/agent-container.ts` 中实现运行结束产物自动扫描归集：检测新生成的过程文件（如 `.html`, `.md`, `.json`, `.svg` 或 `artifacts/` 目录），并将其读取为 `{ path, content }` 打包进 `artifacts` 数组上传至 `complete` 接口。

## 2. 前端详情页产物模块与沙箱预览组件

- [x] 2.1 在 `public/index.html` 与 `public/app.js` 中增加“阶段生成文件 / 过程产物”卡片（`#artifacts-gallery`）。
- [x] 2.2 实现文件列表展示（文件名、扩展名 Badge、文件大小、查看/预览/在新窗口打开按钮）。
- [x] 2.3 实现安全内嵌交互预览（HTML 原型在 `sandbox="allow-scripts"` iframe 中实时呈现，Markdown 经渲染器排版，代码/文本高亮展示，支持全屏或新标签页预览）。
- [x] 2.4 在 `public/style.css` 中增加文件卡片列表、原型预览容器及全屏操作栏样式。

## 3. 测试验证与环境部署

- [x] 3.1 运行全量代码检查与自动化测试（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 打包构建 amd64 镜像并部署到测试服务器 `10.9.34.84`，验证 Explore 阶段生成 HTML Demo 与 Markdown 过程文件的收集、列出和交互预览。
