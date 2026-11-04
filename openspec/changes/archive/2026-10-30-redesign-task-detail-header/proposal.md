## Why

用户在使用任务详情弹窗时提出了两项视觉与布局体验诉求：
1. **状态徽标（Badge）文字垂直居中偏差**：`Explore · 执行中` 胶囊内的文本基线明显靠下，与前面的圆点指示器存在视觉错位，影响界面精致度；
2. **任务详情标题区域层级弱，缺乏主体感**：目前的标题区域中，仓库名称、阶段展示、任务标题和操作按钮并排挤在单层普通头部内，任务标题没有凸显出“当前任务核心目标”的主体视觉焦点，整体背景与排版平淡无层次。

基于 `ui-ux-pro-max` 现代 SaaS（Linear / Raycast / GitHub）设计规范，对详情页标题区域进行全方位的视觉层级重构，优化盒模型对齐，让仓库、阶段、操作与任务目标标题具备明确的视觉引导与专业质感。

## What Changes

- **修复 Badge 胶囊文字垂直居中对齐**：
  - 显式重置 `.badge` 的行高（`line-height: 1`），使用 Flexbox 垂直完全居中盒模型，微调内边距与基线，保证中文、英文与标点在不同字号下均与状态圆点完美对齐。
- **基于 UI Skill 重构任务详情标题区域结构与背景**：
  - **顶部元信息与操作栏（Top Meta & Actions Bar）**：
    - 左侧排布：仓库标签芯片（带 GitHub/GitLab VCS 矢量图标、仓库名）+ 完美垂直居中的阶段状态 Badge；
    - 右侧排布：紧凑精致的 2 个 SVG 语义按钮（停止执行 + 主推进/确认方案）+ 细分隔线 + 关闭按钮；
  - **任务主目标标题英雄区（Task Hero Banner）**：
    - 将任务标题独立构建为具备轻量微卡片背景的焦点区域（`background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 10px;`）；
    - 顶部标注“任务目标 · DIRECTIVE”标签与任务短 ID，主体标题采用加粗高对比度排版（`font-size: 17px; font-weight: 700; line-height: 1.5; color: var(--ink);`）；
    - 一目了然地传达“这是该任务的核心目标”，使整个详情页面的信息焦点瞬间建立。
- **优化整体头部容器与背景**：
  - 详情头部采用现代浅灰柔和质感背景（`background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)`），与下方的过程产物、问答及执行记录形成明晰的视觉分层。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `ui-interaction-and-feedback`: 规范任务详情头部英雄区（Task Hero Banner）布局、仓库与状态元信息栏、以及 Badge 胶囊字形基线垂直居中规范。

## Impact

- **前端结构**：`public/index.html`（调整 `#detail-dialog` 的头部与标题结构）。
- **前端脚本**：`public/app.js`（支持仓库徽标芯片、任务标题微标签与短 ID 的精准渲染）。
- **样式文件**：`public/style.css`（Badge 行高居中修复、Header 渐变底色与 Task Hero 卡片样式）。
