## Context

参见 `proposal.md`。目前系统在任务各阶段的执行结果已经记录在 `runtime_results` 表中（包含 `artifacts` 字段，且 `GET /api/v1/tasks/:id/runs` 已将其全量输出）。但在 Explore 阶段，Agent 原本被限制为纯只读，且没有扫描工作区过程文件的机制；同时前端在任务详情的阶段成果区仅渲染了 `summary`，缺少展示和交互预览文件列表的界面容器。

用户要求：
1. Explore 阶段 Agent 能够根据需要创建过程文件（如 Demo HTML 原型、Markdown 方案总结等）；
2. 任务详情中有一个独立、优雅的模块，能将这些过程文件列出，并支持内联安全预览（如 HTML 原型和 Markdown 预览）。

## Goals / Non-Goals

**Goals:**
- **阶段过程文件生成与收集 (Artifacts Collection)**：
  - 在 `src/agent-container.ts` 与 `src/agent.ts` 中：
    - 放开 Explore 阶段对工作区临时文件的写入权限（如 `edit`、`write` 工具），允许 Agent 根据用户指令编写 Demo 原型或方案文件；
    - 运行完成前，通过 git status/扫描检测工作区中新生成的文件（或规范存放在 `artifacts/` 及根目录下的过程文件，如 `*.html`, `*.md`, `*.json`, `*.svg`），自动将它们作为 `{ path, content }` 包装入 `artifacts` 数组中上传至服务端的 `complete` 接口。
- **前端过程产物模块（Artifacts Gallery & Preview）**：
  - 在 `#detail-dialog` 的阶段成果部分上方/内新增专门的“过程生成文件 / 阶段产物”卡片（`.detail-card.artifacts-section`）；
  - 列出文件卡片（文件名、大小、拓展名 Badge、操作按钮）；
  - **HTML 原型预览**：采用 `Blob URL` 或 `srcdoc` 载入 `<iframe sandbox="allow-scripts">`，在任务详情内提供可交互的原型体验面板，并支持“在新标签页打开 / 全屏弹窗预览”；
  - **Markdown 文件预览**：利用 `markdown.js` 直接渲染；
  - **代码与文本预览**：以带有复制按钮的代码块展示。

**Non-Goals:**
- 不支持超大二进制文件（如大型音视频）的直接上传（限制文本文件单个在 512KB 以内）；
- 不做云端独立托管存储（过程产物随单次运行成果持久化存储于 PostgreSQL `runtime_results` 表中）。

## Decisions

### 1. Agent 产物自动提取逻辑
- **决策**：
  在 `src/agent-container.ts` 中：
  ```typescript
  const artifacts: Array<{ path: string; content: string }> = [];
  // 扫描工作区新增或修改的特定扩展名文件 (.html, .md, .json, .svg 等)
  // 或 artifacts/ 目录下的所有文件
  const untracked = (await exec('git', ['status', '--porcelain'], { cwd, env })).stdout;
  // 解析出新增文件并读取内容（单个文件限制 <= 500KB，避免超出 payload 限制）
  ```
  这样无需侵入业务流程，Agent 只要响应用户要求生成了 `demo.html` 或 `summary.md`，系统自动打包归集。

### 2. 前端 HTML 原型沙箱化预览 (Sandboxed iframe)
- **安全与隔离**：
  HTML Demo 可能包含 JS 脚本（实现交互式原型），为防止窃取用户工作空间 Token 或干扰看板 DOM，必须使用沙箱 `iframe`：
  ```html
  <iframe sandbox="allow-scripts allow-modals" referrerpolicy="no-referrer"></iframe>
  ```
  通过 `srcdoc` 或 `URL.createObjectURL(new Blob([content], { type: 'text/html' }))` 注入内容，彻底隔离看板宿主环境。

### 3. UI 交互设计
- 在卡片顶部提供文件 Tab / 列表，点击某个文件后下方展开内联预览区域（带文件头部操作：在新标签页独立打开、复制原始内容、关闭预览）。

## Risks / Trade-offs

- **[Risk] 用户生成的 HTML 原型过大导致数据库 JSON 膨胀？**
  → **Mitigation**：单个文件截断或限制为 500KB，总产物大小限制在 2MB 以内，满足高保真 HTML 原型、CSS 内嵌与 Markdown 需求。
- **[Risk] iframe 脚本恶意跳转或弹窗？**
  → **Mitigation**：iframe 沙箱严格移除 `allow-top-navigation` 与 `allow-same-origin`，阻止其操控宿主或访问看板敏感存储（如 apiKey）。
