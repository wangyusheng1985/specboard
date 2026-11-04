## Context

当前系统在 Explore 阶段用户提出“基于阶段性结论绘制 demo html”时，出现两处断层：
1. Agent 容器加载的 OpenSpec `explore` 模板自带约束声称“严禁直接修改或编写功能代码并要求用户二次确认”，压制了自主执行能力；
2. 前端虽然有产物预览（`showPreview`），但是直接内联插在产物卡片网格下方，受限于右侧抽屉宽度，Iframe 和 Markdown 视口局促。用户期望直接弹出独立弹窗居中/最大化预览。

详见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 在 `src/agent-container.ts` 和 `src/agent.ts` 中修正系统提示词指令，明确当用户指令要求生成 demo/原型/html 时，立即生成自包含文件并写入工作区，无需反问授权。
- 在 `public/index.html` 中新增 `<dialog id="artifact-preview-dialog" class="artifact-preview-dialog">`，并在 `public/app.js` 中将内嵌展示升级为独立的弹窗式预览（Modal Dialog），提供 iframe 沙箱、在新标签页打开、全屏沉浸和一键 Esc/点击遮罩关闭。
- 确保 Explore 阶段生成的原型文件被自动采集到 `artifacts` 数组并渲染在“阶段成果”标签页。

**Non-Goals:**
- 不允许 Agent 在 Explore 阶段自动修改项目既有的生产业务代码；仅允许创建原型与草稿文件。
- 不引入外部前端富文本弹窗库，使用原生 HTML5 `<dialog>` 与安全沙箱 `<iframe>`。

## Decisions

### 1. Agent 系统指令强化
在 `appendSystemPromptOverride` 的系统提示词中追加强约束：
`"In Explore stage, when user explicitly requests generating or creating a prototype, demonstration, mockup or HTML page (e.g. demo_preview.html), you are ALREADY AUTHORIZED to create that file immediately using your write tool. Do NOT ask for user confirmation or permission again. Create the file directly and report its completion."`
这能覆盖 OpenSpec explore skill 带来的假性拦截。

### 2. 前端模态弹窗预览设计
在 `public/index.html` 添加 `<dialog id="artifact-preview-dialog">`：
- 桌面端视口设为 `width: min(1200px, 94vw); height: min(90dvh, 880px); border-radius: 14px;`；
- Header 包含文件全名、文件格式徽标、在新标签页打开（带有外链图标）、复制内容按钮以及关闭“×”按钮；
- 内部主体铺满，HTML 类型使用 `iframe`（`sandbox="allow-scripts allow-modals allow-forms"`），自适应 100% 高度与宽度。

## Risks / Trade-offs

- **[Risk] iframe 沙箱脚本执行安全**
  → **Mitigation**: 使用 `URL.createObjectURL(new Blob(...))`，配合 `sandbox="allow-scripts allow-modals allow-forms"`，严禁 `allow-same-origin`，隔离父窗口的 Cookie 与 DOM，彻底防御原型中的 XSS。
- **[Risk] Blob URL 内存泄漏**
  → **Mitigation**: 弹窗关闭或切换预览时显式调用 `URL.revokeObjectURL` 释放内存。
