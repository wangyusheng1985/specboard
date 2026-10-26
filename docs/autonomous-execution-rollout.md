# 自动执行发布与回滚

## 能力协商

API、Dispatcher、Agent 和 Gateway 启动时必须使用同一数据库迁移版本。自动恢复仅对 `execution_policy=autonomous` 且存在 `episode_id` 的新任务启用；缺少能力标记的 worker 只能领取普通 queued run，不能领取 `recovery_decisions`。

## 分批启用

1. 先应用数据库迁移并运行 `npm run check`、`npm test`。
2. 设置 `AUTO_RECOVERY_ENABLED=false`，确认旧 worker 不会领取恢复决策。
3. 仅对新任务设置 `execution_policy=autonomous`，观察恢复轮数、阻塞比例和 Apply delivered 数量。
4. 通过真实 API、PostgreSQL、Gateway 和 Agent 链路后，再逐步扩大范围。

## 回滚

发生异常时先设置 `AUTO_RECOVERY_ENABLED=false`，停止新 successor 调度；保留 execution episode、诊断、session 和 workspace。不要把活跃 episode 交给不理解预算的旧 worker。等待当前运行完成或人工停止后，再回退镜像。数据库结构和历史现场保留，恢复功能重新启用前需要重新通过能力协商。

## 数据清理

测试环境可删除全部任务、运行、会话和工作区数据；生产环境不得使用此清理步骤。清理后重新创建任务会获得新的 episode 和预算。
