## MODIFIED Requirements

### Requirement: Adaptive UI Presentation for GitHub Projects
前端界面 SHALL 根据项目类型（GitLab / GitHub）自适应调整术语和界面元素展示，且在所有表单状态（新建、重置、编辑、前置校验拦截及运行摘要）中严格杜绝硬编码为单一平台（如仅显示“GitLab 项目”）。

#### Scenario: Displaying GitHub PR status
- **WHEN** 用户查看一个属于 GitHub 项目的任务详情时
- **THEN** 界面在 MR 阶段卡片中 SHALL 展示“GitHub Pull Request 与 Actions 状态”，显示正确的 PR 链接与 Actions 运行状态。

#### Scenario: Resetting or creating repository form
- **WHEN** 用户打开项目抽屉或点击“+ 新增项目”/“清空”重置表单时
- **THEN** 表单标题 SHALL 统一显示中立化的“添加代码仓库（GitHub / GitLab）”，避免退化为硬编码的“添加 GitLab 项目”。

#### Scenario: Editing repository form
- **WHEN** 用户点击编辑某个已配置的项目时
- **THEN** 表单标题 SHALL 根据仓库平台动态展示“编辑 GitHub 项目”/“编辑 GitLab 项目”，或中立展示“编辑项目配置”。

#### Scenario: Intercepting task creation without projects
- **WHEN** 用户在未配置任何项目的情况下点击“创建任务”时
- **THEN** 系统 SHALL 弹出友好提示“请先配置一个代码仓库（GitHub / GitLab）”，不得提示单一平台。
