## ADDED Requirements

### Requirement: Markdown Table Rendering
系统 Markdown 渲染器 SHALL 完整支持 GFM 标准表格语法（表头、对齐分割线、数据行），以结构化的 HTML 表格（`<table>`）形式渲染。

#### Scenario: Rendering standard markdown comparison table
- **WHEN** 任务成果或阶段总结中包含带有管道符 `|` 的表格文本（如 `| 列1 | 列2 |`）以及分割行 `| :--- | ---: |` 时
- **THEN** 系统 SHALL 将其解析为包含 `<thead>`、`<tbody>` 的标准 `<table>` 元素，并根据 `:---:`、`---:` 正确应用文本对齐样式。

#### Scenario: Inline styles within table cells
- **WHEN** 表格单元格中包含加粗语法 `**文本**` 或代码块语法 `` `code` `` 时
- **THEN** 渲染器 SHALL 在单元格内部正确将其转换为 `<strong>` 或 `<code>` 节点，且特殊字符均以文本节点处理，绝不发生 HTML 注入。

### Requirement: PlantUML Architecture Diagram Rendering
系统 Markdown 渲染器 SHALL 支持对 `plantuml` 代码块的可视化图形渲染，并提供源码与图表切换视图。

#### Scenario: Rendering PlantUML code block
- **WHEN** Markdown 文本中包含语言标识为 `plantuml` 的代码块（如 ````plantuml`）或内含 `@startuml ... @enduml` 时
- **THEN** 系统 SHALL 自动将其转换为架构图卡片，展示渲染生成的 SVG 矢量图，并提供“查看源码 / 查看图表”切换按钮。

#### Scenario: Diagram rendering fallback on network or syntax error
- **WHEN** 图表生成失败或网络不可达时
- **THEN** 系统 SHALL 优雅回退显示原始 PlantUML 代码块，并明确标识“图表加载失败”，保障内容可读性不中断。
