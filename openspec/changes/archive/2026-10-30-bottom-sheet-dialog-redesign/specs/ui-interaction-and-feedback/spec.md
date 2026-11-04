## ADDED Requirements

### Requirement: Bottom Sheet Dialog Presentation and Canvas Width
系统弹窗 SHALL 采用自视口底部向上平滑展开的 Bottom Sheet 模式呈现，为 Markdown 渲染成果及复杂表单提供充足的横向阅读宽度与纵向展示空间。

#### Scenario: Opening task detail dialog
- **WHEN** 用户点击看板卡片打开任务详情（`#detail-dialog`）时
- **THEN** 弹窗 SHALL 从屏幕底部平滑向上滑入，水平方向居中且最大宽度支持扩展到 `min(1360px, 95vw)`，高度占据视口主区域（`min(88dvh, 900px)`），提供大屏 Markdown 呈现效果。

#### Scenario: Opening compact dialogs
- **WHEN** 用户打开工作空间连接、新建任务等表单型弹窗（`.compact-drawer`）时
- **THEN** 弹窗 SHALL 同样从底部向上弹出，宽度适配表单交互并限制为 `min(680px, 92vw)`，保持全站一致的底部抽屉视觉统一性。

### Requirement: Independent Scroll and Background Isolation
底部向上弹窗 SHALL 具备独立的滚动容器体系，且弹窗开启状态下系统全局背景滚动 SHALL 被彻底锁死，杜绝全局与局部滚动条双重滚动冲突。

#### Scenario: Scrolling lengthy markdown content inside dialog
- **WHEN** 任务成果区或执行记录包含大量长篇 Markdown、代码块或表格并发生溢出时
- **THEN** 滚动行为 SHALL 仅在弹窗内部内容容器（`.drawer-body`）中独立触发，页面底层全局看板背景（`body`）保持固定无跳动。

#### Scenario: Clicking backdrop area outside sheet
- **WHEN** 用户在 Bottom Sheet 之外的遮罩暗色区域点击时
- **THEN** 弹窗 SHALL 捕获点击并平滑向下退出关闭，同时恢复页面正常的背景滚动能力。
