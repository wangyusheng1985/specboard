## Context

Specboard 采用轻量化的原生前端架构（HTML5 `<dialog>` + ES Modules + 原生 CSS），不引入大型构建器，保持极简极速的交付体验。当前任务详情页的痛点是抽屉过度拉伸、字阶混乱、阶段感知缺失、决策信息藏匿及 Tab 弱化。具体背景参见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 实现桌面端靠右停靠的标准工作抽屉（Right-side Drawer）与移动端底部抽屉的平滑响应式切换。
- 在抽屉头部提供直观的 4 阶段状态机演进步进器（Stage Stepper）。
- 将待确认澄清（Clarification）和失败诊断（Diagnostic）解耦为全局置顶决策横幅（Decision Banners），跨 Tab 强提醒。
- 升级 Tab 导航为 36px 胶囊底座分段控制器（Segmented Control），并支持动态条目数 Badge。
- 收敛全局字阶为标准 5 级（16px / 14px / 13px / 12px / 11px），优化视觉呼吸感。
- 保留 `DetailRefreshState` 机制，确保高频轮询（1.2s~2.5s）期间输入、滚动与草稿无闪烁。

**Non-Goals:**
- 不重写看板主视图（Kanban Lanes）或项目配置、LLM 配置等无关弹窗。
- 不引入外部前端重型框架（如 React / Vue / Tailwind 构建链），保持纯原生现代化 CSS 与 ES 原生模块。
- 不改动后端状态机推进接口与数据返回格式。

## Decisions

### 1. 抽屉物理形态：响应式右侧停靠抽屉（Right Drawer）
- **方案选择**：在 `public/style.css` 中，为桌面端（`min-width: 769px`）定义 `dialog.drawer.drawer-right`，使用 `position: fixed; top: 0; right: 0; bottom: 0; left: auto; width: min(920px, 82vw); height: 100dvh; transform: translateX(100%);`，打开时平滑滑入 `transform: translateX(0)`。移动端（`max-width: 768px`）媒体查询维持底部弹出。
- **替代方案对比**：曾考虑保持底部弹出但限制宽度居中（类似浮动卡片），但这在宽屏下依然损失纵向可用空间，且遮挡中心背景，不如右侧抽屉符合工程协同平台的操作惯例。

### 2. 决策横幅置顶解耦（Decoupled Top-level Decision Banners）
- **方案选择**：将 `#diagnostic-card` 与 `#clarification-card` 移出内容 Tab，放置在 Header 和 Tab 导航之间的常驻容器 `#detail-global-notices` 中。
- **设计考量**：澄清与阻塞属于最高优先级的用户干预事件（`outcome_state === 'blocked'` 或 `status === 'waiting_input'`）。若用户在浏览产物或历史时任务被阻塞，置顶横幅可跨所有 Tab 强提醒，防止“用户不知道卡在哪”。

### 3. 头部信息流与主次 CTA 重组
- **方案选择**：
  - 第一行：Repo 芯片 + 任务 ID（带复制功能）+ 状态 Badge | 停止执行（次要危险动作）+ 阶段推进/确认方案/重试（主行动 CTA）+ 关闭按钮（充足间距）。
  - 第二行：任务完整需求描述（自适应最大两行，16px 粗体）。
  - 第三行：Stage Stepper（`Explore ➔ Propose ➔ Apply ➔ Archive`），显示阶段状态点与脉冲动效。
  - 第四行：Segmented Control Tab 栏。

### 4. Segmented Control 导航与动态徽标
- **方案选择**：
  - 容器采用浅灰底座（`#f1f5f9`），Tab 按钮高度设为 36px（符合无障碍点击靶区），激活态呈现纯白卡片底座、柔和投影与品牌蓝字。
  - Tab 3 命名由冗长的“需求互动与补充反馈”精简为“会话与指令”。
  - 增加动态数量徽标：阶段成果显示可用产物数（如 `3`），会话与指令显示用户指令条数（如 `5`）。

### 5. 统一排版字阶系统（Modular Scale）
- **层级收敛**：
  - Level 1 (Title): `16px / 1.45`, Weight 650
  - Level 2 (Section): `14px / 1.4`, Weight 600
  - Level 3 (Body/Markdown): `13px / 1.6`, Weight 400
  - Level 4 (Meta/Caption): `12px / 1.4`, Weight 500
  - Level 5 (Code/Tags): `11px`, ui-monospace, Weight 600

## Risks / Trade-offs

- **[Risk] 右侧抽屉滑入与移动端底部抽屉的动画冲突**
  → **Mitigation**: 使用针对不同媒体查询的命名动画（桌面端 `drawer-slide-left`，移动端 `drawer-slide-up`），并在 `prefers-reduced-motion` 规则下将过渡时间压缩为 0.01ms。
- **[Risk] 轮询更新重渲染导致输入失焦或横幅闪烁**
  → **Mitigation**: 严格复用 `detail-refresh-state.js` 机制，在 `updateDetail` 中仅在数据指纹（Signature）变化时更新 DOM 节点；表单输入控件带上 `data-detail-input` 标识，轮询前后严格保留草稿与脏标记。
- **[Risk] 阶段演进步进器与当前 stage 映射不准**
  → **Mitigation**: 映射基于固定的 4 阶段枚举 `['Explore', 'Propose', 'Apply', 'Archive']`，索引比较简单纯粹，与后端状态机强一致。
