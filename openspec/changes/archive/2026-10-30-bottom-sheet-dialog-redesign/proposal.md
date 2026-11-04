## Why

当前系统中的所有弹窗（连接工作空间、项目配置、创建任务、LLM 中转配置，尤其是**任务详情弹窗** `#detail-dialog`）均采用右侧滑入抽屉（Side Drawer，宽度仅 `min(820px, 100vw)`，在移动端为底部抽屉）。

这种设计的核心缺陷是：
1. **水平视口受限，Markdown 呈现效果差**：研发任务在 Explore、Propose、Apply、MR 阶段会生成大量长篇结构化 Markdown，包括方案规划、对比表格、代码块（`pre/code`）、执行日志和复杂的时序步骤。在右侧抽屉仅数百像素的狭窄容器内，文本被迫大幅折行，表格产生嵌套横向滚动，代码块严重挤压，阅读和审查体验较差。
2. **滚动条冲突与高度浪费**：抽屉与全局页面共存时，左右分栏在小屏或笔记本上破坏看板心流；抽屉内容如果过长，在狭窄空间内频繁滚动容易与页面全局产生滚动冲突。

因此，将抽屉交互整体升级为**底部向上平滑展开的底部弹窗（Bottom Sheet Drawer）**，在拥有充足宽度（支持居中最大 `min(1360px, 94vw)` 宽屏阅读画布）的同时，占据垂直视口 `85dvh ~ 92dvh`，并且在内部实现独立平滑滚动（`overflow-y: auto`），在弹窗打开时页面全局禁止滚动（`body:has(dialog[open]) { overflow: hidden; }`），彻底根除滚动条冲突问题。

## What Changes

- **抽屉布局与动效重构 (`public/style.css`)**：
  - 将 `.drawer` 默认排版定位从右侧 `inset: 0 0 0 auto; transform: translateX(100%);` 改为**底部向上弹出的 Bottom Sheet 布局**：`inset: auto auto 0 50%; transform: translate(-50%, 100%);`，开启时 `transform: translate(-50%, 0);`。
  - 宽度从狭窄的 560px/820px 扩展为**居中宽屏大画布**：`width: min(1360px, 95vw)`（对于 `#connect-dialog`、`#task-dialog` 等轻量面板可通过 `.compact-drawer` 设为 `min(680px, 92vw)`）。
  - 高度统一设置为视口高度的 `min(88dvh, 900px)`，并设置顶端优雅圆角（`border-radius: 20px 20px 0 0;`）与顶部把手装饰条（Drag Handle Indicator），带来现代移动端与桌面端统一的 Bottom Sheet 质感。
  - 弹窗进入动效改为底部向上平滑浮现（`animation: sheet-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)`）。
- **滚动条隔离与内容排版优化**：
  - 弹窗主体内部划分为固定头部（`.drawer-head`）与可滚动内容区（`.drawer-body`），确保 `.drawer-body` 独立滚动；
  - 针对 Markdown 长文本、表格（`table`）及代码块（`pre code`）优化宽屏布局，提供清爽的左右边距与行宽限制，杜绝内容穿透与外层滚动联动。
  - 保留并强化 `body:has(dialog[open]) { overflow: hidden; }`，弹窗呼出时锁死看板背景滚动，杜绝全局与局部滚动条双重晃动冲突。
- **点击遮罩关闭与辅助交互兼容**：
  - 更新 `setupDrawer` 中的命中检测逻辑（`hit(event)`），兼容居中底部 Bottom Sheet 的边界计算，点击遮罩透明区域可正常平滑关闭。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `ui-interaction-and-feedback`: 规范全局弹窗交互模型从右侧抽屉全面演进为底部向上弹出（Bottom Sheet），并提供防冲突的隔离滚动与宽屏 Markdown 呈现规范。

## Impact

- **前端样式**：`public/style.css`（抽屉尺寸、定位、动画及滚动机制重构）。
- **前端交互脚本**：`public/app.js`（弹窗遮罩点击与开闭行为）。
- **测试用例**：`test/detail-refresh-state.test.ts` 及相关 UI 交互单测。
