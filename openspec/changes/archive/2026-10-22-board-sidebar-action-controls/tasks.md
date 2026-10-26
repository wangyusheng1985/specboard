## 1. HTML DOM 结构重构

- [x] 1.1 从 `public/index.html` 中移除 `.heading`（包含 `<h1>全局工作看板</h1>` 与 `<span class="heading-badge">全部项目</span>`）。
- [x] 1.2 在 `public/index.html` 中新增右侧居中浮动操作容器 `.floating-sidebar-actions`，内部放置刷新按钮 `#refresh`（上方）与拖拽垃圾桶 `#trash-zone`（下方），均仅保留 SVG 图标与 title 提示。

## 2. 样式重构与视口空间优化

- [x] 2.1 在 `public/style.css` 中移除原本 `.heading` 及相关子元素的布局样式。
- [x] 2.2 在 `public/style.css` 中为 `.floating-sidebar-actions` 及其子按钮（42px × 42px，微圆角，微投影）定义右侧垂直居中悬浮样式，优化图标居中与悬浮/拖拽高亮开盖动效。
- [x] 2.3 调整看板泳道高度（`max-height: calc(100dvh - 110px)`），让出更多纵向视口给任务列表展示。

## 3. 全量测试与环境验证

- [x] 3.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有相关测试通过。
- [x] 3.2 重新编译 amd64 镜像并滚动更新测试服务器 `10.9.34.84`，验证页面布局与右侧居中按钮交互效果。
