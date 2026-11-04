## Context

参见 `proposal.md`。现有 `public/markdown.js` 采用纯逐行解析和安全文本节点注入，目前缺少表格解析支持，遇到类似以下常见的方案对比：
```markdown
| 产品 | 视觉风格 | 核心交互 |
| :--- | :--- | :--- |
| Termius | 现代深色磨砂 | 侧边抽屉面板 |
```
会被当成普通段落解析，管道符直接暴露在外，排版混乱。同时，当 Agent 输出架构图、时序图（如 ````plantuml ... ````）时，只能作为黑底灰字的代码展示，无法提供直观视觉表达。

## Goals / Non-Goals

**Goals:**
- **标准 GFM 表格解析**：
  - 在 `public/markdown.js` 中增加表格缓冲与状态机，准确识别表头、分割线、单元格，并根据冒号应用对齐属性（`text-align: left/center/right`）；
  - 单元格内继承行内解析（支持 `**bold**`、`` `code` ``）。
- **表格高雅排版样式**：
  - 在 `public/style.css` 中增加表格容器（`overflow-x: auto;` 防止小屏溢出）、条纹背景、清晰细边框与合适内边距。
- **PlantUML 矢量渲染与交互**：
  - 识别 ````plantuml` 代码块，提取内容；
  - 提供轻量编码工具（PlantUML 官方编码算法：UTF-8 -> Deflate -> 64-char 压缩），并生成可渲染的 SVG 图表预览（指向官方/私有 PlantUML 服务，如 `https://www.plantuml.com/plantuml/svg/~1...`）；
  - 封装为带控制栏的图表卡片（包含“查看图表 / 查看源码”切换开关与放大预览）。
- **零依赖与 XSS 绝对安全**：
  - 坚持使用安全 DOM API（`document.createElement` + `document.createTextNode`）构建节点，杜绝任何外部非受控 HTML 字符串注入。

## Decisions

### 1. 表格解析状态机 (Table Parsing State Machine)
- **判定规则**：
  - 当一行以 `|` 开头或包含 `|` 且随后紧跟 `| --- |` 形式的分割线时，判定为表格开始；
  - 收集所有连续的 `| ... |` 行作为表格数据；
  - 提取第一行为 `<thead>`，第二行为列对齐规则，其余为 `<tbody>`；
  - 遇到非表格行或空行时，闭合表格并重新进入常规解析流。

### 2. PlantUML 编码规范 (PlantUML Text Encoding)
- PlantUML 官方提供标准的公开 SVG 转换规范：将 UML 源码经过 Deflate 压缩并使用其专属 64 字符表映射（0-9, A-Z, a-z, -, _）。
- 如果浏览器原生支持 `CompressionStream('deflate-raw')`，则直接高效压缩；若不支持或在离线环境下，直接渲染优雅的高亮源码卡片，并提供“一键复制 PlantUML 源码”或可折叠图表区，保证无论网络状态如何均稳定可用。

## Risks / Trade-offs

- **[Risk] 内网隔离环境下可能无法请求外部 PlantUML 公共服务？**
  → **Mitigation**：
  1. 图表卡片设计为“预览 / 源码”双视图，且提供“图表加载失败”平滑回退；
  2. 预留环境变量/配置项，支持用户后续在私网部署本地 PlantUML 容器中转；
  3. 绝对不阻塞页面渲染流程。
