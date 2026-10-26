## Context

参见 `proposal.md`。现有详情弹窗头部中，Badge 胶囊字形因为继承了全局的行高（`line-height: 1.45~1.6`），文本基线偏低；且项目名称、阶段徽标、任务标题与操作按钮挤在一层，缺乏强烈的视觉主体与品牌设计感。

## Goals / Non-Goals

**Goals:**
- **字形基线数学对齐**：
  - 彻底修正 `.badge` 盒模型：显式指定 `line-height: 1` 与 `align-items: center`，微调内边距，使状态文字与圆点绝对垂直居中。
- **现代化双层头部架构（Two-Tier Header Hierarchy）**：
  - **第 1 层：控制与元信息栏（Top Control Row）**：
    - 左侧：仓库芯片组件（`repo-chip`，集成 GitHub/GitLab 平台矢量图标、仓库名称与软删除状态）+ 阶段状态 Badge（无动画静态圆点 + 居中文本）；
    - 右侧：双 SVG 语义操作按钮（停止执行 + 推进/确认方案） + 分隔线 + 关闭按钮。
  - **第 2 层：任务目标英雄卡片（Task Directive Hero Banner）**：
    - 采用独立的微凸起卡片容器包裹任务标题（`background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 10px; padding: 14px 18px;`）；
    - 标题上方标明“任务目标 · DIRECTIVE”浅灰等宽小标签；
    - 标题文本采用醒目的半粗体排版（`font-size: 16.5px; font-weight: 700; line-height: 1.5; color: var(--ink);`），让用户打开弹窗的第一时间一眼抓住任务的核心任务指令。
- **头部容器质感升级**：
  - `.detail-drawer-head` 增加浅柔和磨砂渐变背景（`linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`）与细致下边框。

**Non-Goals:**
- 不改变底层数据流与状态机推进逻辑；
- 不破坏任务操作按钮（Stop, Advance, Approve）的功能与 ID 绑定契约。

## Decisions

### 1. 徽标文字垂直居中核心修正
```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 5px 10px;
  border-radius: 9999px;
  vertical-align: middle;
  box-sizing: border-box;
}
```
通过明确 `line-height: 1` 和对称的 `5px 10px` 内边距，字形的 cap-height 区域与 `7px` 圆点在 Flex 交叉轴完美重叠，彻底根除文字靠下的视觉缺陷。

### 2. 头部结构拆解 (HTML)
```html
<div class="drawer-head detail-drawer-head">
  <div class="detail-header-top-row">
    <div class="detail-meta-group">
      <div id="detail-repo-chip" class="repo-chip"></div>
      <span id="detail-meta" class="badge"></span>
    </div>
    <div class="detail-head-actions">
      <!-- 2个操作按钮与关闭按钮 -->
    </div>
  </div>
  <div class="detail-title-card">
    <div class="detail-title-badge">任务目标 · DIRECTIVE</div>
    <h2 id="detail-title"></h2>
  </div>
</div>
```

## Risks / Trade-offs

- **[Risk] 标题文本过长是否会撑大头部？**
  → **Mitigation**：标题卡片设置 `max-height: 160px; overflow-y: auto;` 并允许自然换行（`overflow-wrap: anywhere`），无论标题是一行还是长篇需求，均能从容呈现。
