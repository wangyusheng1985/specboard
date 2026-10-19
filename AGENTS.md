# AGENTS.md

## 项目概览

Specboard 是一个 TypeScript/Node.js 服务，提供 OpenSpec 四阶段看板、Pi SDK Agent 对话、GitLab 项目配置和 Git worktree 隔离。

## 开发约定

- 使用 Node.js 24 或更高版本。
- 使用 TypeScript ESM，源码导入保留 `.ts` 扩展名。
- 使用 SQLite 持久化业务状态；不要把 Token、API 密钥或签名密钥写入仓库、日志、Agent 消息或响应。
- 所有任务状态变更必须经过服务端状态机、版本检查和幂等控制。
- 阶段顺序固定为 `Explore -> Propose -> Apply -> Archive`。
- 每个任务阶段使用独立 Pi SDK 会话；事件必须可追踪、可恢复。
- GitLab 仓库使用 HTTPS 和允许列表校验；同一项目的任务必须使用独立 worktree。
- UI 控件需要键盘可访问、可见焦点、清晰标签和拖拽替代操作。
- 修改代码后运行：

```bash
npm run check
npm test
```

## Docker Compose

部署配置位于 `compose.yaml`，数据、Pi 会话和工作区必须使用持久化卷。不要提交真实 `.env` 或凭据。构建验证：

```bash
docker compose config --quiet
docker compose build
```

## 变更范围

实现功能时优先保持模块边界：

- `src/store.ts`：领域模型和持久化。
- `src/security.ts`：加密、签名和防重放。
- `src/workspaces.ts`：GitLab 验证与 worktree 生命周期。
- `src/agent.ts`：Pi SDK 会话与阶段协调。
- `src/app.ts`：HTTP API 和运行时装配。
- `public/`：看板和任务详情界面。
- `test/`：行为和集成测试。

不要为了通过测试而削弱安全校验或把真实外部集成替换成静默模拟。
