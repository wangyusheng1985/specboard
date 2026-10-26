## Purpose

定义代码仓库项目的生命周期管理规范，特别是项目安全逻辑删除（软删除）机制，确保项目被停用或废弃时，关联的历史研发任务数据依然完整保留且可追溯。

## ADDED Requirements

### Requirement: Soft Deletion of Projects
系统 SHALL 支持对已有项目进行逻辑删除，而不是物理删除数据库记录，防止级联破坏已有历史任务关联。

#### Scenario: Deleting an existing project
- **WHEN** 用户在项目配置中对指定项目触发删除并确认时
- **THEN** 系统 SHALL 调用 `DELETE /api/v1/projects/:id` 将该项目的 `deleted_at` 字段置为当前时间戳，返回删除成功状态。

#### Scenario: Active project listing excludes deleted projects
- **WHEN** 用户获取活动项目列表（用于创建新任务的下拉框）时
- **THEN** 系统 SHALL 仅返回未被删除的项目（`deleted_at IS NULL`），已删除的项目不得出现在新建任务的选项中。

### Requirement: Historical Task Preservation for Deleted Projects
项目被逻辑删除后，所有曾经隶属于该项目的任务 SHALL 完整保留在工作看板各泳道中，且界面清晰标识该项目已被删除。

#### Scenario: Rendering tasks belonging to a deleted project
- **WHEN** 工作看板各泳道渲染属于某个已逻辑删除项目的任务卡片时
- **THEN** 卡片上的项目名称 SHALL 呈现为带有已删除标记的提示（例如包含 `[已删除]` 标识），且卡片所有既有阶段记录与详情依然可以正常查阅。

#### Scenario: Viewing task details of a deleted project
- **WHEN** 用户点击打开属于已删除项目的任务详情抽屉时
- **THEN** 抽屉顶部所属项目名称 SHALL 明确提示为“已删除项目”，且阶段流转记录与成果快照保持只读可查。
