## 1. 布局结构重组与 Badge 居中修复

- [x] 1.1 修复 `public/style.css` 中 `.badge` 的行高、内边距与对齐方式，显式声明 `line-height: 1`，消除状态胶囊文字靠下偏差。
- [x] 1.2 在 `public/index.html` 中重构 `#detail-dialog` 头部结构，拆分为顶层元信息操作栏与下层独立的任务目标（Directive）英雄卡片。

## 2. 视觉样式升级与渲染逻辑精修

- [x] 2.1 在 `public/style.css` 中增加头部渐变背景、`.repo-chip` 仓库标签芯片、`.detail-title-card` 任务目标焦点卡片与 `.detail-title-badge` 视觉样式。
- [x] 2.2 在 `public/app.js` 中更新仓库芯片渲染（带 GitHub/GitLab 矢量图标与名称）及状态徽标与标题的动态填充。

## 3. 全量测试与环境部署

- [x] 3.1 运行全量代码检查与自动化测试（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 跨平台打包构建 amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，在浏览器端验证详情页头部全新布局、突出标题与 Badge 完美居中对齐效果。
