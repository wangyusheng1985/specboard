## 1. 结构与排版基础设施改造（HTML & CSS Type Scale）

- [x] 1.1 重构 `public/index.html` 中的 `#detail-dialog` DOM 结构：配置 `drawer-right` 类名、置顶全局决策横幅容器 `#detail-global-notices`、阶段演进步进器容器 `#detail-stepper`，升级 Segmented Control Tab 栏与动态 Badge 节点，验证 HTML5 解析有效且节点完整。
- [x] 1.2 在 `public/style.css` 中收敛建立统一 5 级标准字阶与行高规范（16px / 14px / 13px / 12px / 11px），消除各卡片与元数据中随意的碎片字阶，验证文字对比度与排版节奏协调。

## 2. 抽屉物理形态与全局决策横幅实现

- [x] 2.1 在 `public/style.css` 中实现桌面端右侧停靠抽屉（`drawer-right`）样式与平滑硬件加速滑入动画，并保留移动端底部抽屉自适应与 `prefers-reduced-motion` 降级，验证不同视口宽度下抽屉呈现正常。
- [x] 2.2 在 `public/style.css` 中实现全局置顶决策横幅（`.detail-global-notices`、`.decision-banner`）的高对比视觉样式与表单行内布局，确保澄清与失败诊断具备跨 Tab 强提示能力。

## 3. 阶段演进步进器与分段 Tab 交互逻辑

- [x] 3.1 在 `public/app.js` 中新增 `renderDetailStepper(task)` 函数，动态渲染 4 阶段流程状态机（Explore ➔ Propose ➔ Apply ➔ Archive）与当前活跃状态脉冲点，验证任务在不同阶段下的步进器状态指示准确。
- [x] 3.2 在 `public/app.js` 中重构 Tab 切换与动态条目数徽标（Badge）逻辑：动态统计产物数量与互动指令数量，将澄清卡片与失败诊断与子 Tab 解耦展示，验证切换 Tab 时页面平滑且未提交输入状态完整保留。

## 4. 全量验证与体验测试

- [x] 4.1 运行全量代码验证（`npm run check`、`npm run lint`、`npm test`），确保 TypeScript 类型、ESLint 规范与自动化测试全部通过。
- [x] 4.2 验证在 Explore、Propose、Apply 真实任务流下抽屉响应式布局、澄清提交、方案确认、归档及快速轮询下的无闪烁体验。
