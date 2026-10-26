## 1. 底部弹窗布局与动画样式改造

- [x] 1.1 修改 `public/style.css` 中的 `.drawer`、`dialog.drawer`、`.compact-drawer` 与 `.detail.drawer`，将右侧固定定位改为屏幕底部居中弹出（Bottom Sheet），设置宽屏展示（`min(1360px, 95vw)`）及最大高度 `min(88dvh, 900px)`，并配置顶部优雅圆角与阴影。
- [x] 1.2 引入顶部把手条（Handle Bar）及平滑向上浮入的关键帧动画（`sheet-up`）。
- [x] 1.3 强化滚动条隔离规范：确保固定头部（`.drawer-head`）与内容滚动区（`.drawer-body`）严格分层，保证长篇 Markdown 独立平滑滚动，并保证打开状态下全局看板 `body` 滚动彻底锁死（无冲突跳动）。

## 2. 交互逻辑与兼容性验证

- [x] 2.1 检查 `public/app.js` 中的 `setupDrawer` 与遮罩点击检测，确保居中底置弹窗在点击空白遮罩区域时能正常关闭，且 Esc 键盘退出与行内二次确认依然平滑。
- [x] 2.2 验证各类型弹窗（任务详情 `#detail-dialog`、连接面板 `#connect-dialog`、创建任务 `#task-dialog`、项目配置 `#project-dialog`、LLM 中转 `#llm-dialog`）在不同分辨率下的排版与滚动表现。

## 3. 质量测试与远程环境部署

- [x] 3.1 运行本地检查与自动化测试（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 自动打包 amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，在浏览器端验证底部向上弹窗展开、Markdown 宽屏渲染与无冲突滚动体验。
