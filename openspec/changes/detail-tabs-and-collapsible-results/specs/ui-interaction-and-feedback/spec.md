## ADDED Requirements

### Requirement: Detail Dialog Three-Tier Tab Navigation
任务详情弹窗 SHALL 提供 3 个顶级导航 Tab（基本信息、阶段成果、需求互动与补充反馈），默认选中“基本信息”，支持键盘与鼠标切换视图。

#### Scenario: Switching detail view tabs
- **WHEN** 用户点击“阶段成果”或“需求互动与补充反馈”Tab 选项卡时
- **THEN** 弹窗主体区域 SHALL 瞬间平滑切换显示对应面板的内容，非活动面板自动隐藏，且激活 Tab 保持显著的主题色下划线与高亮状态。

#### Scenario: Default tab selection on open
- **WHEN** 用户从看板点击打开任意任务详情时
- **THEN** 弹窗 SHALL 默认聚焦并激活“基本信息”Tab，清晰呈现任务的阶段、状态、完整需求描述与项目属性。

### Requirement: Collapsible Stage Result Cards with Gradient Fade
“阶段成果”Tab 中的各阶段 Markdown 结果卡片 SHALL 默认处于折叠状态，展示前 5 行预览，并带有平滑的底部虚影遮罩与展开/收起切换按钮。

#### Scenario: Default collapsed rendering with gradient mask
- **WHEN** 用户进入“阶段成果”Tab 时
- **THEN** 各阶段报告卡片 SHALL 默认处于折叠态，最大高度限制在 130px 左右（约 5 行正文），卡片底部覆盖白色半透明渐变虚影，清晰提示下方有未展示完的内容。

#### Scenario: Toggling card expansion
- **WHEN** 用户点击卡片底部的“展开全部”按钮时
- **THEN** 卡片的高度限制与虚影遮罩 SHALL 解除，平滑展开展示完整的 Markdown 长文内容，按钮文本切换为“收起”并更新箭头方向；再次点击时恢复折叠。
