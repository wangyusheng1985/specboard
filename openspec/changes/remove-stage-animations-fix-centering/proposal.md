## Why

当前任务详情页存在两处交互与样式体验缺陷：
1. **阶段动画冗余干扰**：详情弹窗内部包含了阶段切换与执行呼吸灯/波纹等动效（如 `view-fade`、`pulse-ring` 以及状态 Badge 内的循环扩散 ping 动画），在阅读长篇方案与高保真原型时容易造成视线分散与界面闪烁感，用户要求完全去除详情页内的阶段动画；
2. **弹窗居中展示定位偏移问题**：现有样式中 `.drawer` 采用了 `inset: auto auto 0 50%` + `transform: translate(-50%, ...)` 结合浏览器原生 `<dialog>` 内置的 `margin: auto`，并且在部分媒体查询中出现了 `transform: translateY(0)`（覆盖了 `translateX(-50%)`），导致详情弹窗在桌面端和移动端存在严重的水平居中偏右或对齐畸变缺陷。

## What Changes

- **彻底去除详情页的阶段相关动画 (`public/style.css` & `public/app.js`)**：
  - 移除详情页内部所有阶段切换淡入淡出动效（移除 `view-fade` / `view-crossfade` 及 `pulse-ring` 声呐波纹）；
  - 详情头部状态 Badge 移除循环扩散 ping 动效（`.pulse-dot::after` 的 ping 动画在详情页内禁用或移除），仅保留稳定、安静的静态圆点与高清晰度文本；
  - 详情抽屉展开动效精简为垂直平滑浮现，杜绝横向位移与内容闪烁。
- **重构弹窗原生居中盒模型 (`public/style.css`)**：
  - 放弃脆弱的 `left: 50% + translateX(-50%)` 水平居中方案，改用现代标准原生的 block 自动居中方案：
    `position: fixed; inset: auto 0 0 0; margin: 0 auto; width: min(1360px, 96vw); max-width: 96vw;`
  - 依靠 `left: 0; right: 0; margin: 0 auto;` 确保在任何屏幕分辨率、视口缩放与浏览器内核下 100% 绝对像素级水平对称居中，杜绝因 transform 与 margin 冲突导致的偏右畸变；
  - 规范移动端断点：`width: 100vw; max-width: 100vw; inset: auto 0 0 0; margin: 0;`。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `ui-interaction-and-feedback`: 规范详情页低噪声原则（去除阶段切换与脉冲动画），并修正底部弹窗（Bottom Sheet）全屏与大屏下的原生可靠水平居中规范。

## Impact

- **样式优化**：`public/style.css`（移除详情页阶段动画与重构原生可靠居中布局）。
- **脚本微调**：`public/app.js`（移除 `view-fade` 类切换触发代码，保持渲染简洁）。
- **测试验证**：`test/detail-refresh-state.test.ts`。
