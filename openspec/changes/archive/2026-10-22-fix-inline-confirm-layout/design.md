## Context

参见 `proposal.md`。项目列表中的每个项目是 `<li class="project-item">`，内部包含 `.project-info` 与 `.project-actions`（display: flex）。当用户点击删除项目按钮时，`askConfirm(..., del)` 将 `.inline-confirm` 作为 `del.after(panel)` 插入到了 `.project-actions` 这个狭小的 flex 盒中，导致宽度只有几十像素，按钮被挤压成纵向长方块。

## Goals / Non-Goals

**Goals:**
- **确定挂载宿主判定**：
  - 如果 `host` 处于某个 `<li>` 或弹性行中，将确认卡片插入到该 `<li>` 的下方作为同级全宽元素，或者插入到当前区块的外层容器。
- **全宽与按钮防折行样式保障**：
  - `.inline-confirm` 设置 `width: 100%; box-sizing: border-box; grid-column: 1 / -1;`；
  - `.inline-confirm .actions button` 设置 `white-space: nowrap; flex: none; min-width: 80px; height: 38px;`，保障文字端正水平对齐。

## Decisions

### 1. 挂载点寻找策略
- **决策**：
  在 `askConfirm(title, message, action, host)` 中：
  ```javascript
  let mountTarget = host || document.querySelector('.heading') || document.body;
  // 如果宿主是一个列表项内部的操作元素，则提升挂载到最近的 li 元素之后，作为完整横条展示
  const parentLi = host?.closest('li');
  if (parentLi) {
    mountTarget = parentLi;
  }
  mountTarget.after(panel);
  ```
  这样确认卡片会自然插入在当前项目行的正下方，横向占满列表的整行宽度，视觉极度平整。

### 2. 确认卡片专有样式修正
- **决策**：
  在 `public/style.css` 中增强 `.inline-confirm`：
  ```css
  .inline-confirm {
    width: 100%;
    box-sizing: border-box;
    display: block;
    clear: both;
    margin: 10px 0 14px;
  }
  .inline-confirm .actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 12px;
  }
  .inline-confirm .actions button {
    white-space: nowrap;
    flex: 0 0 auto;
    min-width: 78px;
    padding: 0 16px;
    height: 38px;
    font-size: 13.5px;
  }
  ```

## Risks / Trade-offs

- 无逻辑破坏风险，纯视觉与 DOM 挂载层级优化。
