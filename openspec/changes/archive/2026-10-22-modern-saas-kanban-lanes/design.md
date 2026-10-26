## Context

参见 `proposal.md`。目前看板由 `<div id="board" class="board">` 与 5 个 `<section class="lane" id="lane-<Stage>">` 构成。泳道样式为深沉平灰底色，且未做列滚动隔离，任务卡片内容偏简略，缺少层次分明的投影与截断防护。

## Goals / Non-Goals

**Goals:**
- **通透高级的材质与空间层次**：泳道背景升级为 `#f1f5f9`，边缘为 `1px solid rgba(226, 232, 240, 0.8)`，卡片为纯白高亮，阴影升级为细腻双层投影。
- **列级独立滚动与首屏规整**：各列设置 `max-height: calc(100vh - 175px)`，内部 `.cards` 容器独立平滑滚动（自定义细滚动条），所有泳道头始终处于同一视口高度。
- **丰富的卡片元数据排版**：卡片项目名增加微型 Git 仓库图标（12px），卡片标题支持 3 行截断（`-webkit-line-clamp: 3`），底部时间戳与状态点精致排版。
- **现代化空状态与吸附引导**：当泳道为空时，呈现细腻虚线槽与提示文案。

**Non-Goals:**
- 不改变 5 个泳道的业务阶段流转规则（依然是 Explore -> Propose -> Apply -> MR -> Archive）。
- 不破坏原有的拖拽数据传输与状态机验证。

## Decisions

### 1. 泳道布局与列独立滚动（Independent Column Scroll）
- **决策**：
  - `.board` 采用 CSS Grid `grid-template-columns: repeat(5, minmax(260px, 1fr))`，支持横向平滑滚动保护（在小屏幕下保持列宽不被挤瘪）；
  - `.lane` 作为 Flex 容器（`display: flex; flex-direction: column; max-height: calc(100dvh - 170px);`）；
  - `.lane h2`（泳道头）作为固定头部，不随卡片滚动；
  - `.cards` 设置 `overflow-y: auto; flex: 1; padding: 2px;`，并定制精致的 4px 半透明滚动条。

### 2. 阶段识别色体系（Phase Color Accent System）
- **决策**：
  - 各泳道头部圆点升级为带微弱呼吸光晕的双层指示环：
    - Explore（探索）：`#4f46e5`（靛蓝）
    - Propose（方案）：`#d97706`（琥珀金）
    - Apply（执行）：`#059669`（翡翠绿）
    - MR（评审）：`#7c3aed`（丁香紫）
    - Archive（归档）：`#64748b`（中性板岩灰）
  - 任务数量采用药丸胶囊（Pill Counter），数字居中，背景柔和。

### 3. 卡片结构与行数截断（Card Clamp & Hierarchy）
- **决策**：
  - `.card-title` 采用 `-webkit-line-clamp: 3; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;`；
  - `.card-project` 左侧内联 12px 矢量仓库图标，字色为次级灰蓝，消除突兀纯蓝；
  - 卡片按下时 `transform: scale(0.99)`，悬停时 `transform: translateY(-2px); box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);`。

## Risks / Trade-offs

- **[Risk] 列宽在低分辨率屏幕下被压缩**
  → **Mitigation**：设置 `minmax(260px, 1fr)`，当屏幕过窄时允许看板整体水平滑动（`overflow-x: auto`），确保每列内容始终可读。
