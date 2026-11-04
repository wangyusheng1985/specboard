## Why

当前任务详情页（#detail-dialog）在视觉与交互上存在明显断层与规范冲突：
1. 抽屉物理形态在桌面宽屏下仍为撑满 96vw 的扁平底部抽屉，拉伸严重、横向留白失衡，与 AGENTS.md 规定的“桌面右侧抽屉、移动端底部抽屉”相违背；
2. 缺乏清晰的阶段演进可视化，信息架构主次颠倒，致命的失败诊断与澄清决策被深埋在子 Tab 内，导致用户跨 Tab 时无法及时获知阻塞；
3. 字体字阶碎片化（11px 到 15px 密集杂乱），Tab 按钮矮小缺乏点击靶区和激活对比度，缺少条目计数与状态指示。

本次变更对任务详情页进行系统性重构，建立严谨的字阶规范、右侧工作抽屉布局、置顶决策横幅和高可感知的 Segmented Tab 体系，极大提升研发任务执行与审阅效率。

## What Changes

- **桌面右侧工作抽屉布局**：将桌面端（>=768px）抽屉由底部弹出改为标准化右侧停靠抽屉（宽 min(920px, 82vw)，高 100dvh），移动端（<768px）保持底部弹出，自适应良好。
- **阶段演进步进器（Stage Stepper）回归**：在详情页头部增加 `Explore ➔ Propose ➔ Apply ➔ Archive` 阶段状态机指示，直观展示当前执行阶段、完成度与状态呼吸指示。
- **全局决策横幅（Decision Banners）置顶解耦**：将“待确认澄清（Clarification）”与“失败诊断（Diagnostic）”从子 Tab 移至 Header 下方的常驻全局横幅区，出现决策需求或致命阻塞时跨 Tab 置顶高亮提醒，无阻塞时静默隐藏。
- **Segmented Control Tab 体系升级**：重构 Tab 为 36px 胶囊底座分段控制器（阶段成果、任务全景与历史、互动与指令），提供条目数量 Badge（如产物数、消息数）与高对比度选中状态。
- **五级字阶（Modular Type Scale）收敛**：废除 11.5px / 12.5px / 13.5px / 14.5px 等碎片字号，严格收敛为 16px 标题、14px 模块标题、13px 正文/Markdown、12px 次要元数据、11px 等宽标签。
- **头部操作区主次清晰化**：分离主行动 CTA（确认方案 / 推进 / 重试）与次要操作（停止执行），加大与关闭按钮间距，杜绝误触。

## Capabilities

### Modified Capabilities
- `ui-interaction-and-feedback`: 扩展并调整任务详情抽屉（Detail Drawer）的布局形态、阶段步骤指示（Stage Stepper）、置顶全局决策横幅（Decision Banners）、分段导航 Tab 样式及标准字阶体系。

## Impact

- **前端界面与样式**：修改 `public/index.html`（抽屉结构与 Tab 结构）、`public/style.css`（右侧抽屉动画、字阶、Stepper、Tab 栏、Banner 样式）和 `public/app.js`（Tab 切换、Stepper 渲染、决策横幅事件绑定与徽标更新）。
- **向后兼容性**：不改变任何现有 API 协议、后端服务与状态机逻辑；纯前端呈现层升级。
