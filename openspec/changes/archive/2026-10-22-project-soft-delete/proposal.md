## Why

当前系统仅支持创建和编辑项目，不支持删除已有项目。在多项目协作与测试场景中，当项目被弃用或输入错误时，用户无法清理。同时，直接物理删除项目会破坏既有任务与外键关联，导致任务无法溯源。

为了支持项目的安全生命周期管理，需要引入项目逻辑删除（软删除）能力：允许用户在项目配置中删除项目；被删除的项目不再出现在“创建任务”的项目选择器中，而历史上由该项目创建的任务仍完整保留在泳道中，仅在展示时标记项目为已删除状态（例如“已删除项目：xxx”）。

## What Changes

- **数据库存储与迁移扩展**：
  - 在 `projects` 表中新增 `deleted_at BIGINT` 字段（`NULL` 表示未删除，非空表示删除时间戳）。
  - 在 `src/runtime-migration.ts` 中添加列迁移。
- **服务端 API 扩展**：
  - 新增 `DELETE /api/v1/projects/:id` 接口，执行逻辑删除（更新 `deleted_at = Date.now()`）。
  - 更新 `GET /api/v1/projects`：默认仅查询未删除的项目（`WHERE deleted_at IS NULL`）；同时支持查询参数 `includeDeleted=true` 或在任务关联查询时兼容已删除项目。
  - 在任务关联查询（如 `/api/v1/tasks/:id` 与 `/api/v1/lane`）中，保留 `p.deleted_at` 投影字段，以便前端辨识。
- **前端交互重构**：
  - 在“项目配置”抽屉的项目列表中，为每个项目增加“删除”操作按钮，点击后弹出行内确认“确认删除此项目？历史任务将被保留，该项目将无法创建新任务。”；
  - 任务卡片及详情抽屉中，若关联项目已被删除，项目名称呈现删除态标识（例如带有删除线或灰色 `[已删除]` 标签）。

## Capabilities

### New Capabilities
- `project-lifecycle`: 定义项目的逻辑删除（软删除）及关联历史任务持久化保留规范。

### Modified Capabilities
<!-- 无修改的能力集 -->

## Impact

- **数据层**：`src/runtime-migration.ts`，为 `projects` 增加 `deleted_at` 字段。
- **API 层**：`src/runtime-api.ts`，增加 `DELETE /api/v1/projects/:id` 路由，调整 `GET /api/v1/projects`。
- **前端界面**：`public/app.js`，增加项目删除按钮、二次确认及已删除项目任务展示。
- **自动化测试**：新增 `test/project-soft-delete.test.ts` 验证软删除逻辑及历史任务保留。
