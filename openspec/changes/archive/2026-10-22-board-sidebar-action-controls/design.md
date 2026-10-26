## Context

参见 `proposal.md`。当前 Specboard 页面顶部导航栏下方有一个独立的 `.heading` 容器，横向包含 `全局工作看板 [全部项目]` 和右侧的 `[拖到此处删除] [刷新看板]`。

## Goals / Non-Goals

**Goals:**
- **消除上方占位**：彻底删除 `.heading` DOM 结构及文字节点。
- **右侧居中浮动工具栏**：
  - 创建 `.floating-sidebar-actions`，采用 `position: fixed; right: 20px; top: 50%; transform: translateY(-50%); z-index: 100; display: flex; flex-direction: column; gap: 10px;`。
  - 上方为 `#refresh`：圆形/精致微圆角纯图标按钮（尺寸 42px × 42px），居中包含 16px 矢量刷新 SVG，悬停提示“刷新看板”。
  - 下方为 `#trash-zone`：与上方同尺寸（42px × 42px），居中包含 16px 矢量垃圾桶 SVG，支持拖拽卡片时的开盖微交互、高亮及放置确认。
- **扩展看板泳道可视空间**：
  - 调整 `.lane` 的最大高度，如 `calc(100dvh - 120px)`，使看板纵向充分伸展。

**Non-Goals:**
- 不破坏原有的拖拽删除 API 调用和确认逻辑。
- 不影响抽屉弹窗的正常展开与层级（浮动操作栏 z-index 设为 100，抽屉与 backdrop 在 1000 以上）。

## Decisions

### 1. 浮动操作栏设计与几何属性
- **决策**：
  ```css
  .floating-sidebar-actions {
    position: fixed;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 90;
    pointer-events: auto;
  }
  .floating-sidebar-actions button,
  .floating-sidebar-actions .trash-zone {
    width: 42px;
    height: 42px;
    min-height: 42px;
    max-height: 42px;
    padding: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(8px);
  }
  ```

### 2. 垃圾桶拖拽态反馈优化
- **决策**：
  - 去除原本的“拖到此处删除”冗余文字，全靠物理图标与动效表达；
  - 当页面进入拖拽状态（`body.is-dragging`）时，垃圾桶按钮高亮扩散红粉色微光；
  - 悬停（`drag-over`）时，垃圾桶盖子向上平移并倾斜（`-18deg`），直观呈现开盖等待投递反馈。

## Risks / Trade-offs

- **[Risk] 右侧浮动按钮在极窄屏幕或移动端可能遮挡最右侧泳道**
  → **Mitigation**：通过 `@media (max-width: 600px)` 调整按钮浮动位置（例如缩放到右下角，或微调至边缘透明度），确保不遮挡主要操作。
