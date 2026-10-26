## Context

参见 `proposal.md`。在上一次针对标题高度过高的精简调整中，由于缺少对 `#refresh` 按钮内嵌 SVG 的宽高显式限制，导致按钮在特定渲染引擎下被撑高为巨大白色矩形方块，内部文字“刷新看板”被换行成竖排，产生了极为突兀的排版事故。同时，左侧标题字号和右侧按钮视觉失衡。

## Goals / Non-Goals

**Goals:**
- **彻底消除按钮形变**：给 `#refresh` 和 `.trash-zone` 施加严格对齐的度量标准（统一高度 40px，统一内边距，强制 `white-space: nowrap`）。
- **统一内联 SVG 约束**：所有操作按钮内部的 SVG 统一限定为 `width: 14px; height: 14px; flex-shrink: 0;`。
- **视觉平衡与比例和谐**：标题区字号调整至 22px，采用加粗深墨色（`#17202b`），搭配柔和灰蓝标签 `全部项目`，左右两侧基于 `align-items: center` 严密水平中轴线对齐。
- **刷新点击旋转反馈**：点击刷新时，为图标施加 `.is-spinning` 类（360度旋转，400ms 阻尼过渡）。

**Non-Goals:**
- 不改变数据刷新 API 与轮询机制。
- 不引入外部图标库。

## Decisions

### 1. 精确的几何度量体系（Dimension Rigor）
- **决策**：
  - `.heading` 高度固定在 44px 左右，`margin-bottom: 20px`；
  - `#trash-zone` 与 `#refresh` 显式设置 `height: 40px; min-height: 40px; box-sizing: border-box;`；
  - 按钮文字与图标统一居中对齐，间隙 `gap: 6px`，`white-space: nowrap`；
  - 强制限制 `.heading-actions svg` 尺寸 `width: 14px; height: 14px;`（垃圾桶图标特殊微调至 15px）。

### 2. 左侧标题组层次微调
- **决策**：
  - `<h1>全局工作看板</h1>`：字号 22px，字重 700，字距 -0.02em；
  - `<span class="heading-badge">全部项目</span>`：背景使用柔和的 `--surface-2`，边框 `1px solid var(--line)`，圆角 6px，字号 12px，垂直方向居中对齐。

## Risks / Trade-offs

- **[Risk] 不同浏览器内核默认 SVG 尺寸继承差异**
  → **Mitigation**：不仅在 CSS 中声明 `.nav-icon { width: 14px !important; height: 14px !important; }`，同时在 HTML 的 `<svg>` 标签中显式声明 `width="14" height="14"` 属性作为双保险。
