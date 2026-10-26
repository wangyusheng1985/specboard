## Why

在“项目配置”抽屉中点击删除项目时，二次确认弹窗（`.inline-confirm`）被挂载到了当前列表项内部或 `.project-actions` flex 子容器中，受限于较窄的容器宽度，导致弹窗被挤压成极细的一竖列、按钮文字出现竖向折行畸变（如图所示：“取消”和“确认删除”被挤成竖排窄方块）。

需要修复行内确认组件在项目抽屉等狭窄容器中的挂载位置与布局表现，确保确认卡片具备全宽呈现能力、防折行保护及合理的层叠上下文。

## What Changes

- **修复确认卡片挂载层级 (`public/app.js`)**：
  - 在 `askConfirm` 中，优化挂载目标逻辑：当 `host` 是列表项内部的按钮时，不再直接追加在当前按钮紧邻之后（避免继承 flex 紧凑布局），而是将其插入到列表项容器之外（如列表顶层、或者使确认弹窗以全宽插入在父容器前），并提供专有样式类 `.dialog-confirm`。
- **强化确认组件与按钮排版样式 (`public/style.css`)**：
  - 为 `.inline-confirm` 补充 `min-width`、`width: 100%` 与 `box-sizing: border-box`，彻底杜绝被周围 flex 布局挤扁；
  - 确认操作按钮强制声明 `white-space: nowrap; flex: none; min-width: 80px;`，保障文字横向舒展排版；
  - 优化弹窗的视觉质感（柔和淡红/淡紫渐变底色，清晰危险操作提醒）。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `ui-interaction-and-feedback`: 规范二次确认交互组件在不同容器层级下的防挤压、宽度自适应及按钮文字防折行契约。

## Impact

- **前端交互与样式**：`public/app.js`、`public/style.css`。
