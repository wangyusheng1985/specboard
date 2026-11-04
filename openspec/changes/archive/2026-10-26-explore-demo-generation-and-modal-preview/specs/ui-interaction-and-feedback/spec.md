## ADDED Requirements

### Requirement: Modal Artifact Preview System
阶段过程产物（HTML 原型、Markdown 文档、图表代码）SHALL 支持通过大尺寸模态弹窗（Modal Dialog）进行预览，消除在狭窄卡片内滚动折叠受限的问题。

#### Scenario: User clicks preview button on artifact card
- **WHEN** 用户在阶段成果面板中点击某一产物卡片（如 `demo_preview.html`）的“预览”操作时
- **THEN** 界面 SHALL 弹出专用的高对比度模态对话框（宽度 `min(1100px, 94vw)`，高度 `min(88dvh, 900px)`），提供安全的沙箱 iframe 实时交互环境或 Markdown 渲染视图，并提供全屏、复制内容、在新标签页打开和一键关闭操作。

#### Scenario: Autonomous prototype creation during exploration
- **WHEN** 用户在 Explore 阶段发送明确绘制或生成原型/demo/html 的指令时
- **THEN** 系统 Agent SHALL 视该指令为明确授权，无需反复要求用户进行“是/否”文本确认，直接在工作区生成自包含的演示文件并完成该轮交互。
