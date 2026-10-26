## Context

参见 `proposal.md` 了解动机。当前 Specboard 前端由原生纯 HTML、现代 CSS 与无依赖的原生 ESM JavaScript（`index.html`、`style.css`、`app.js`）构成，具有加载极速、无构建打包开销、内存占用低等优点。本技术方案的核心约束是在**不引入任何重型外部前端框架或重量级动画库**的前提下，充分发挥现代 CSS 标准（CSS 变量、关键帧动画、平滑贝塞尔过渡、`:has()` 伪类、`prefers-reduced-motion`）与原生 DOM 的能力，实现专业级的视觉感知与微交互动效。

## Goals / Non-Goals

**Goals:**
- **零运行时打包膨胀**：纯原生 CSS3 与 ESM 实现，不引入外部第三方依赖（保持轻量与安全）。
- **无破坏向后兼容**：保持现有 `app.js`、`DetailRefreshState`、`diagnostic-presentation`、`task-status` 的契约不变，将现有的 `notice(text)` 平滑升级为统一的浮动 Toast 驱动。
- **状态感知不闪烁**：结合 1.2 秒平滑轮询机制，卡片的运行呼吸灯与边框流光必须在状态未变更时保持稳定运行，不因数据刷新而发生重绘中断。
- **精准的物理手感**：拖拽倾斜、垃圾桶开盖、步骤条声呐波纹、表单错误震颤、草稿保存闪烁均具备清晰的缓动曲线（Easing）。
- **无障碍首选**：全面适配 `prefers-reduced-motion` 规范，对前庭觉敏感人群零干扰。

**Non-Goals:**
- 不重构前端为 React / Vue 等重型客户端框架，保持单页轻量原生架构。
- 不修改后端 API 路由、数据库 Schema 或 WebSocket/SSE 协议。
- 不添加全屏炫目侵入式动画，遵循“克制、低噪声、专注结果”的系统交互原则。

## Decisions

### 1. 采用内联矢量 SVG 图标与 CSS Transform
- **决策**：将页面中分散的原生 Emoji（如垃圾桶 `🗑️`、外链 `↗`、关闭按钮）替换为内联 SVG 矢量图标（Phosphor / Heroicons 风格）。针对垃圾桶放置区，将桶身（body）与桶盖（lid）分为两个路径（path），通过 CSS Transform 实现拖拽悬停时桶盖向上位移并微旋转（`translateY(-3px) rotate(-18deg)`）。
- **备选方案**：引入 Icon 字体库或图片雪碧图。放弃原因：字体库会增加额外的网络请求与 FOIT 闪烁，无法对子路径进行精细化独立物理动效控制。

### 2. 状态映射与非破坏性动画持久（Liveness & State Mapping）
- **决策**：在 `task-status.js` 中扩充或配合 `taskStatusClass(task)`，将任务状态映射为 CSS 修饰类（如 `status-running`, `status-waiting`, `status-delivered`, `status-blocked`）。在卡片渲染时注入呼吸灯 `.pulse-dot`。轮询更新（`syncBoardTask`）时只更新类名和内容，保留正在运行的 CSS Keyframe 动画连续性。
- **备选方案**：每次轮询全量清空泳道重绘。放弃原因：会打断正在播放的 CSS 呼吸动效并导致界面闪烁。

### 3. 集中式浮动 Toast 调度器（Toast Manager）
- **决策**：在 `public/index.html` 顶部增加 `<div id="toast-container" class="toast-container" role="region" aria-live="polite"></div>`。在 `app.js` 中封装 `showToast(message, type = 'info', duration = 3500)`，并桥接原有的 `notice(text)`。
  - 支持类型：`'success'`、`'error'`、`'info'`；
  - 队列管理：同屏最多保留 3 条，超量自动平滑剔除最早一条；
  - 交互规则：具备 3.5s 自动退场定时器；当鼠标悬停（`mouseenter`）或获得焦点时挂起定时器，移出（`mouseleave`）后重新倒计时；右侧提供关闭按钮。
- **备选方案**：保留静态 `#notice` 文本替换。放弃原因：无法自动退场，常驻红字导致视觉疲劳，遮挡信息。

### 4. 表单错误震颤与平滑折叠（Shake & Smooth Collapse）
- **决策**：当表单验证失败时，对当前触发错误的 `input` 或 `textarea` 施加 `.is-invalid` 类，触发 250ms 的水平小幅度震颤（`translateX(-3px) ~ translateX(3px)`），错误提示文字使用 `max-height + opacity` 平滑下落展开。用户开始重新输入（`input` 事件）时平滑收起并移除错误类。
- **备选方案**：弹窗 alert。放弃原因：严重阻断操作，破坏单抽屉交互原则。

### 5. 步骤条声呐光波与内容平滑过渡（Stepper Sonar & Cross-fade）
- **决策**：
  - 处于当前执行阶段（`.stage-step.current`）的序号圆圈，通过 CSS `::after` 伪元素执行 `pulse-ring` 关键帧，向外扩散半透明光晕；
  - 点击步骤条切换查看历史（`step.onclick`）时，给右侧展示区域添加 `.view-fade` 类，在 150ms 内执行轻量淡入（Opacity `0.6` -> `1.0`），平滑消除突兀感。

## Risks / Trade-offs

- **[Risk] 1.2s 高频轮询导致动画重置或跳动**
  → **Mitigation**：利用已有的 `DetailRefreshState` 保持输入状态，同时对于看板卡片，仅在 `task.status` 或 `task.stage` 真实发生变化时才更新 DOM class，确保运行中的 CSS 呼吸灯动画持续平稳循环。
- **[Risk] Toast 弹窗遮挡看板操作或抽屉标题**
  → **Mitigation**：Toast 容器设置 `pointer-events: none`（仅 Toast 实体自身可点击），固定在顶部中置 `top: 20px`，宽度自适应且限制最大宽度 480px，并设置合理的 `z-index: 1100`，既能被看见又不会遮挡抽屉核心输入区域。
- **[Risk] 部分浏览器在减弱动效偏好下的视觉遗留**
  → **Mitigation**：在 `style.css` 底部统一强制配置 `@media (prefers-reduced-motion: reduce)`，将所有 `animation` 与 `transition` 强制归零，保留明确的静态颜色与边界对比度。
