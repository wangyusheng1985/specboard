## 1. 数据库迁移与数据模型改造

- [x] 1.1 在 `src/runtime-migration.ts` 中增加 `ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at BIGINT;`，并记录 migration 版本。
- [x] 1.2 在 `src/store.ts` 中的本地单元测试桩补充对应类型定义。

## 2. 服务端 API 实现

- [x] 2.1 修改 `GET /api/v1/projects` 路由，默认增加 `WHERE deleted_at IS NULL` 过滤，并支持 `includeDeleted` 查询。
- [x] 2.2 新增 `DELETE /api/v1/projects/:id` 路由，校验项目存在性后将 `deleted_at` 设为当前时间戳，并支持幂等控制。
- [x] 2.3 修改 `GET /api/v1/lane` 路由，在联表查询中补充输出 `p.deleted_at AS project_deleted_at` 字段。
- [x] 2.4 在 `test/project-soft-delete.test.ts` 中增加软删除接口及任务关联保留的自动化测试。

## 3. 前端交互与视觉状态适配

- [x] 3.1 在 `public/app.js` 的 `renderProjectList` 中为每个项目项添加“删除”操作按钮，点击调用行内确认弹窗后请求 `DELETE /api/v1/projects/:id`。
- [x] 3.2 在 `public/app.js` 的 `renderLane` 任务卡片与 `openTask` 任务详情中，若任务关联的项目处于已删除状态，追加 `[已删除]` 标签视觉提示。
- [x] 3.3 在 `public/style.css` 中添加项目删除按钮样式与 `.project-deleted-tag` 徽标样式。

## 4. 全量验证与测试环境部署

- [x] 4.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有测试通过。
- [x] 4.2 重新编译 amd64 镜像并滚动更新测试服务器 `10.9.34.84`，验证项目删除与任务保留。
