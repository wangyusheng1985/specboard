## Context

参见 `proposal.md`。当前 `projects` 表缺少 `deleted_at` 字段，且 `runtime-api.ts` 仅有项目的创建（POST）与更新（PUT），缺失删除（DELETE）路由。此外，前端在创建任务时直接使用全量项目列表，导致弃用项目无法清理。

## Goals / Non-Goals

**Goals:**
- **软删除数据模型**：
  - PostgreSQL `projects` 表添加 `deleted_at BIGINT` 字段。
  - `DELETE /api/v1/projects/:id` 路由：校验存在性，执行逻辑删除（`UPDATE projects SET deleted_at=$2 WHERE id=$1`），并通过幂等控制。
- **项目列表分流**：
  - `GET /api/v1/projects`：默认增加 `WHERE deleted_at IS NULL` 仅返回可用项目；支持 `includeDeleted=true` 查询全部。
- **任务看板关联投影兼容**：
  - `GET /api/v1/lane` 中：`SELECT t.*, p.name AS project_name, p.repository_url AS project_repository_url, p.deleted_at AS project_deleted_at ...`
  - 前端若检测到 `task.project_deleted_at` 存在，则在项目标签处标注 `[已删除]` 灰度徽章。
- **前端交互**：
  - 项目配置抽屉列表的每个 item 提供“编辑”和“删除”操作按钮；
  - 点击“删除”时调用行内确认 `askConfirm`：“确认删除项目 [名称]？历史关联任务将被保留，该项目将无法创建新任务。”

**Non-Goals:**
- 不执行数据库外键级联删除或物理文件清空，保留关联工作区和会话历史以备审计。

## Decisions

### 1. 软删除而非物理删除
- **决策**：使用 `deleted_at BIGINT` 记录删除时间戳。
- **替代方案**：级联物理删除 `tasks` 和 `agent_runs`。放弃原因：违反业务安全设计，会导致用户既往研发成果与审计记录丢失。

### 2. 泳道卡片已删除标识视觉表现
- **决策**：
  在卡片顶部项目信息区：
  ```javascript
  const isDeleted = Boolean(task.project_deleted_at);
  if (isDeleted) {
    projectP.append(el('span', '[已删除]', 'project-deleted-tag'));
  }
  ```
  样式采用柔和灰色底色 + 细边框，字体 10px，醒目且不喧宾夺主。

## Risks / Trade-offs

- **[Risk] 删除项目后正在运行中的任务是否受影响**
  → **Mitigation**：正在运行的任务在 Agent 容器中依然可以通过 `project_id` 正常读取关联的加密 token 和仓库信息完成本次任务，不受影响；仅禁止在此项目下新建任务。
