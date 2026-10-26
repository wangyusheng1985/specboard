## 1. 结构与样式改造

- [x] 1.1 在 `public/index.html` 中移除 `#detail-dialog` 内的原“阶段流程”大卡片（`#stage-tabs`）与“任务操作”大卡片（`.task-toolbar`）。
- [x] 1.2 在 `public/index.html` 的详情弹窗头部（`.drawer-head`）新增 `.detail-head-actions` 交互按钮组，包含停止（SVG 矢量图标）与主推进操作（自适应 SVG 图标及紧凑文案）。
- [x] 1.3 在 `public/style.css` 中设计精细的 `.detail-head-actions` 与 `.detail-action-btn` 样式，适配悬停动效、Danger 红色警告态、Primary 主题色与禁用态。

## 2. 交互逻辑重构与状态机对齐

- [x] 2.1 修改 `public/app.js` 中的详情渲染逻辑：将原审批、停止与推进状态机无缝绑定到头部两枚新按钮上，并更新头部状态 Badge 显示。
- [x] 2.2 验证在 Explore、Propose、Apply、MR、Archive 阶段以及异常受阻状态下，头部双按钮的文案、图标、状态及交互动作准确无误。

## 3. 全量测试与环境部署

- [x] 3.1 运行全量代码检查与自动化测试（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 跨平台打包构建 amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，在浏览器端验证精简后的详情弹窗布局与头部 SVG 按钮交互。
