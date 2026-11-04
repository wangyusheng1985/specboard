## 1. 表格与图表解析渲染核心实现

- [x] 1.1 在 `public/markdown.js` 中重构解析管线，支持多行缓冲判定 GFM 表格语法（表头、分割行、对齐方式与行内加粗/代码解析），生成结构化 `<table>` DOM 树。
- [x] 1.2 在 `public/markdown.js` 中增加代码块语言识别，对 `plantuml` 类型代码块生成带有“图表预览 / 查看源码”切换开关的可视化图表卡片，集成 PlantUML 编码与 SVG 预览，并提供容错降级。
- [x] 1.3 在 `public/style.css` 中增加表格（`.markdown table`、`th`、`td`、斑马纹、圆角边框、横向滚动包装）与图表卡片（`.diagram-card`、切换按钮、图片自适应）样式规范。

## 2. 自动化测试与边界验证

- [x] 2.1 编写 `test/markdown.test.ts` 单元测试，覆盖标准表格解析、列对齐、单元格行内样式、PlantUML 代码块识别及 XSS 防御测试。
- [x] 2.2 运行全量检查与测试套件（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。

## 3. 测试环境打包与滚动部署

- [x] 3.1 跨平台编译 `specboard-api:ui-animations-amd64` 镜像，并传输部署至 `10.9.34.84` 测试服务器。
- [x] 3.2 在测试环境中验证复杂任务方案中的 Markdown 表格渲染与 PlantUML 架构图呈现。
