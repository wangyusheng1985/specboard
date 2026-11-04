## Why

Specboard 在 Explore、Propose、Apply 等阶段成果中会展示大量技术方案、架构对比与时序设计。但目前的 Markdown 渲染器（`public/markdown.js`）仅支持最基础的段落、标题、列表和代码块，**完全不支持 GFM 表格（`| col | col |`）**，表格内容会被退化为零散普通文本；同时对于架构图、时序图、流程图（如 `plantuml` 或文本图形），缺乏直观的可视化图表渲染能力。

在已完成底部宽屏弹窗（Bottom Sheet）改造后，前端已拥有充裕的水平视口大画布。增强 Markdown 表格与图表渲染，能够大幅提升技术方案对比审阅与架构设计的阅读质量。

## What Changes

- **GFM Markdown 表格渲染支持 (`public/markdown.js`)**：
  - 支持解析并渲染 GitHub Flavored Markdown 规范的标准表格语法（表头、分割行、对齐方式 `:---:`、数据行）；
  - 采用安全 DOM 节点构建 `table`、`thead`、`tbody`、`th`、`td`，单元格内继续支持行内加粗和行内代码；
  - 配套在 `public/style.css` 中增加现代化表格美化样式（斑马纹、微边框、自适应横向微滚动、圆角封装）。
- **图表（PlantUML / Mermaid）可视化渲染与兜底**：
  - 识别 ````plantuml`（或 `@startuml ... @enduml`）代码块：
    - 采用标准 PlantUML 文本编码算法（Deflate + 64-char 变体编码），转换为安全的 SVG 图表渲染预览；
    - 提供“图表 / 源码”一键切换查看，并配备渲染加载态与防错机制；
  - 针对纯 ASCII 图形或一般代码块，维持清晰高保真等宽代码排版。
- **XSS 安全防护保证**：
  - 所有解析过程维持通过 `document.createElement` 与 `document.createTextNode` 构建，严禁直接拼接 `innerHTML`，防范脚本注入。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `ui-interaction-and-feedback`: 扩展 Markdown 渲染规范，包含 GFM 标准表格排版与 PlantUML 架构图表渲染契约。

## Impact

- **前端渲染模块**：`public/markdown.js`（增加表格解析状态机与 PlantUML 编码/SVG 渲染支持）。
- **前端视觉样式**：`public/style.css`（表格视觉规范与图表切换卡片样式）。
- **自动化测试**：增加 `test/markdown.test.ts` 专项单元测试，验证表格结构解析正确性与 XSS 安全防御。
