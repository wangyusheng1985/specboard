## 1. 结构与样式重构（紧凑头部与两行截断）

- [x] 1.1 在 `public/index.html` 中重构 `#detail-dialog` 头部 DOM 结构，将任务 ID 芯片（`#detail-task-id`）移至顶栏元数据组，精简标题容器并消除冗余卡片层级。
- [x] 1.2 在 `public/style.css` 中重构 `.detail-drawer-head`、`.detail-title-row`、`.task-id-chip` 样式，限制头部垂直高度在 85px 以内，实现 14.5px 字号与两行省略截断（`-webkit-line-clamp: 2`）。

## 2. 交互逻辑与复制分享实现

- [x] 2.1 在 `public/app.js` 中重写任务 ID 芯片的渲染与点击交互：点击自动合成当前任务直达 URL（`location.origin + '/?task=' + id + '&stage=' + stage`）写入剪贴板，提供内联绿色对勾与 Toast 提示。
- [x] 2.2 确保任务切换与多次打开时，复制按钮状态可安全复位，标题完整绑定至 `title` 悬停提示。

## 3. 全量校验与部署验证

- [x] 3.1 运行全量代码检查与自动化测试（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 跨平台打包构建 amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，在浏览器端验证任务详情头部紧凑排版、下方内容展示面积扩展以及点击短 ID 一键复制直达链接效果。
