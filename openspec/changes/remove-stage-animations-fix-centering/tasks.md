## 1. 样式居中修复与弹窗定位重构

- [x] 1.1 重构 `public/style.css` 中 `.drawer` 与 `dialog.drawer` 的定位盒模型，改用 `position: fixed; left: 0; right: 0; bottom: 0; margin: 0 auto;` 标准块级自动居中，彻底移除任何 `left: 50%` 与 `translateX(-50%)` 定位。
- [x] 1.2 统一浮入动画为纯 Y 轴位移（`sheet-up: translateY(32px) -> translateY(0)`），并适配紧凑弹窗（`.compact-drawer`）与移动端全宽贴合样式。

## 2. 详情页阶段动画彻底移除

- [x] 2.1 从 `public/style.css` 中移除阶段相关的脉冲动画（如 `pulse-ring`）与视图淡入淡出（`view-fade` / `view-crossfade`）。
- [x] 2.2 优化详情页头部 Badge 状态指示，去除跳跃的扩散 ping 动效，保持静默清晰的静态呈现。
- [x] 2.3 检查 `public/app.js`，清理所有已废弃的阶段动效类触发代码。

## 3. 质量验证与远程测试环境部署

- [x] 3.1 运行全量质量检查（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 3.2 自动打包 amd64 镜像并滚动更新至测试服务器 `10.9.34.84`，在浏览器端验证弹窗的完美水平对称居中以及详情页的静默稳定呈现。
