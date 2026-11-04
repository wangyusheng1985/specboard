## 1. 结构重构（Tab 导航与多面板划分）

- [x] 1.1 在 `public/index.html` 中为 `#detail-dialog` 引入三项 Tab 导航（基本信息、阶段成果、需求互动与补充反馈），并将现有卡片分别归入 `#panel-info`、`#panel-results` 和 `#panel-interaction` 三个独立面板。
- [x] 1.2 在 `public/style.css` 中设计现代 SaaS 风格的 Tab 选项卡（`.detail-nav-tabs`、`.detail-tab-btn`），包含微下划线高亮、悬停微光与面板显隐切换样式。

## 2. 成果折叠卡片与虚影渲染实现

- [x] 2.1 在 `public/style.css` 中实现折叠卡片样式（`.run-card-collapsible`、`.is-collapsed`、底部渐变虚影遮罩、`.card-expand-toggle` 按钮）。
- [x] 2.2 在 `public/app.js` 中实现阶段成果卡片默认折叠与“展开详情/收起”动态交互，并在内容少于 5 行时自动免折叠。
- [x] 2.3 在 `public/app.js` 中实现 Tab 切换逻辑，打开详情时默认重置为“基本信息”Tab，并在后台数据刷新期间稳定维持当前选中的 Tab。

## 3. 全量校验与部署验证

- [x] 3.1 运行全量代码检查与自动化测试（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 跨平台打包构建 amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，在浏览器端验证 Tab 切换、默认聚焦基本信息，以及阶段成果多卡片折叠（5 行渐变虚影）与展开收起效果。
