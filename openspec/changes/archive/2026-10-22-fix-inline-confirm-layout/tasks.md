## 1. 确认卡片挂载定位修复

- [x] 1.1 修改 `public/app.js` 中的 `askConfirm` 函数：当 `host` 位于 `li` 等紧凑容器内时，将挂载宿主自动提升至 `li` 之后，作为全宽块级元素渲染，杜绝被挤压变形。

## 2. 确认卡片与按钮排版样式增强

- [x] 2.1 修改 `public/style.css` 中的 `.inline-confirm` 样式：增加 `width: 100%`、`box-sizing: border-box` 及 `grid-column: 1 / -1`。
- [x] 2.2 修改 `public/style.css` 中的 `.inline-confirm .actions button`：设置 `white-space: nowrap`、`flex: 0 0 auto` 及最小宽度 `min-width: 78px`，确保按钮文字横向舒展。

## 3. 全量测试与测试环境部署

- [x] 3.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 重新编译 amd64 镜像并滚动更新测试服务器 `10.9.34.84`，验证删除项目确认弹窗视觉效果。
