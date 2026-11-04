## Why

在 Explore 探索阶段，用户经常提出绘制交互式原型、demo 页面或架构图的探索需求。当前系统存在两处体验阻碍：
1. Agent 容器的 Explore 阶段系统提示词虽然允许生成原型，但 OpenSpec 内置的 `explore` skill 模板强行约束“严禁直接修改或编写功能代码并要求用户二次确认”，导致 Agent 在收到“绘制高保真 demo html”的用户指令时反复询问确认，无法直接自主生成文件；
2. 阶段成果中的产物列表目前采用在卡片下方内联嵌入展开的方式，在右侧抽屉宽度有限时阅读与交互空间狭窄，用户期望点击产物卡片能弹出沉浸式的全屏/居中弹窗预览（Modal Preview）。

## What Changes

- **Explore 指令自主执行（Autonomous Prototype Generation）**：在 `src/agent-container.ts` 和 `src/agent.ts` 中明确强化 Explore 阶段的指令覆盖：当用户通过指令明确要求生成原型、demo 页面或演示文件（如 demo_preview.html）时，Agent 拥有直接写权限且无需重复要求用户二次确认，直接完成文件生成并写入工作区。
- **产物弹窗预览（Modal Artifact Preview）**：重构 `public/index.html`、`public/style.css` 和 `public/app.js` 中的产物预览交互，将原先内联折叠的预览容器升级为专业的模态预览弹窗（支持全屏/大视口 IFrame 渲染、代码高亮、复制内容及在新标签页打开）。
- **阶段成果联动展示（Artifacts In Stage Results）**：Agent 在 Explore 阶段完成原型或产物生成后，该产物自动收集并挂载于“阶段成果”标签页中的过程产物卡片，并实时点亮 Tab Badge。

## Capabilities

### Modified Capabilities
- `ui-interaction-and-feedback`: 增强阶段过程产物的沉浸式弹窗预览（Modal Artifact Preview）机制，优化 iframe 隔离与全屏交互体验。

## Impact

- **运行时 Agent 执行逻辑**：优化 `src/agent-container.ts` 和 `src/agent.ts` 的系统提示词覆盖，解除用户显式指示生成 Demo 时的虚假确认拦截。
- **前端展示与预览交互**：更新 `public/index.html`（添加 `#artifact-preview-dialog`）、`public/style.css`（定义预览 Modal 样式）与 `public/app.js`（弹窗唤起与清理逻辑）。
