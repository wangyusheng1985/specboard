## Why

在任务前期（特别是 **Explore 探索调研节点**），用户经常会要求 Agent 在探索过程中产出或生成一些过程成果文件，例如：
1. 一份高保真原型页面（如 `demo.html` / `preview.html`）；
2. 一份技术架构方案或产品对比总结（如 `summary.md` / `explore.md`）；
3. 过程性数据或配置文件（如 JSON / SVG 等）。

然而，目前系统在 Explore 阶段仅展示单次运行的文本总结（`summary`），缺乏对阶段过程生成产物（Artifacts）的结构化收集、列出和直接交互预览能力，用户无法在任务详情中直观查看生成的 HTML 原型或阶段文件。

## What Changes

- **Agent 探索阶段工具链与产物收集机制升级 (`src/agent-container.ts` & `src/agent.ts`)**：
  - 放开 Explore 阶段对工作区临时文件的写入和创建能力（支持创建例如 `artifacts/` 或根目录下指定过程产物文件，如 `.html`, `.md`, `.json`, `.svg`）；
  - Agent 运行结束时，自动扫描并收集阶段内生成的过程文件作为 `artifacts` 成果数组上传至服务端 `complete` 接口。
- **服务端结果存储与接口支持 (`src/runtime-service.ts` & `src/runtime-api.ts`)**：
  - `GET /api/v1/tasks/:id/runs` 既有结构中已包含 `x.artifacts` 字段，确保各阶段（尤其是 Explore 阶段）的过程文件持久化；
  - 新增过程产物安全预览与下载辅助接口（或基于已有成果数组直接在前端安全预览渲染）。
- **前端任务详情过程产物模块（Artifacts Gallery & Preview）(`public/app.js`, `public/index.html`, `public/style.css`)**：
  - 在任务详情弹窗中新增“阶段生成文件 / 过程产物”卡片模块；
  - 清晰列出该阶段所有生成的文件列表（文件名称、大小、生成时间、类型 Badge）；
  - **原生内联即时预览**：
    - 对于 **HTML 高保真原型**（`.html`），支持在安全的沙箱 `iframe`（`sandbox="allow-scripts"`）中一键切换全屏/弹窗内实时交互预览；
    - 对于 **Markdown 总结**（`.md`），调用增强版 Markdown 渲染器展示；
    - 支持一键复制文件内容或新标签页独立预览。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `ui-interaction-and-feedback`: 规范任务详情中 Explore 及其它阶段生成过程文件（HTML 页面、Markdown 文档等）的发现、列表呈现与沙箱安全预览交互规范。

## Impact

- **动态 Agent**：`src/agent-container.ts` 与 `src/agent.ts`，放开探索阶段过程产物收集与保存。
- **前端界面与样式**：`public/index.html`, `public/app.js`, `public/style.css`，新增过程文件卡片、文件列表与安全沙箱预览组件。
- **测试用例**：`test/agent-runtime.test.ts`, `test/stage-verification.test.ts`。
