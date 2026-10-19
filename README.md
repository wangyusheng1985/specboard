## Specboard

Specboard 是基于 OpenSpec 和 Pi SDK 的项目工作看板：任务沿 Explore、Propose、Apply、Archive 四个阶段推进，每个阶段都支持 Agent 对话、人工介入、GitLab 项目配置和隔离的 Git worktree。

## 快速开始

```bash
cp .env.example .env
openssl rand -hex 32  # 填入 API_SECRET
openssl rand -hex 32  # 填入 ENCRYPTION_KEY
docker compose up -d --build
```

访问 `http://localhost:3000`，使用 `.env` 中的 `API_SECRET` 连接。

完整配置、安全模型、API、数据卷、备份和恢复说明见本文档后半部分。

需要 Docker Engine 与 Compose v2。

```sh
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

将两个独立随机值分别填入 `.env` 的 `API_SECRET` 与 `ENCRYPTION_KEY`；配置 `PI_PROVIDER`、`PI_MODEL`、`PI_API_KEY`。若使用私有 GitLab，把精确域名加入 `GITLAB_ALLOWED_HOSTS`（逗号分隔，非标准端口需包含端口）。仓库必须使用 HTTPS，默认验证 TLS 证书。

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=50
```

打开 http://localhost:3000 ，点击“连接”，输入 `API_SECRET`。连接后部署密钥立即从表单清除；客户端仅在内存持有一小时有效的签名密钥，刷新页面后需重新连接。

项目配置填写名称、仓库 HTTPS 地址、GitLab Token 与默认分支。Token 至少需要 `read_api` 和 `read_repository`；本版本不自动推送或创建 MR。服务端验证仓库与分支后加密存储 Token。固定工作区根目录 `/workspaces` 由部署配置决定。

## 工作流

- 创建任务并选择项目后，自动进入 Explore 并开始探索。
- Explore、Propose、Apply、Archive 分别加载锁定依赖版本附带的 OpenSpec skill，记录内容 SHA-256。
- 点开卡片查看阶段对话、工具活动、执行结果、错误与运行起止时间。
- 在对话中补充信息，或通过暂停、继续、重试、停止控制运行。暂停会中断当前模型调用，继续时恢复持久化会话，并非冻结进程。
- 拖到下一列或点击“进入下一阶段”后，确认操作会启动对应阶段。输入“进入 Propose”等明确指令会生成待确认操作；普通讨论不会直接改变阶段。
- 正在运行时需先暂停或停止再转移。不支持跨阶段跳转或回退。
- 各泳道独立游标分页，“加载更多”保留其他列的位置。刷新看板重新加载首页。
- 每阶段独立 Pi 会话；持久化产物及之前阶段结果作为交接上下文。任务 change 名为 `task-<任务 UUID>`。

## 数据、挂载与恢复

Compose 使用三个命名卷：

| 卷 | 容器路径 | 内容 |
| --- | --- | --- |
| data | /data | SQLite 数据库、Pi 模型配置 |
| sessions | /sessions | Pi JSONL 会话 |
| workspaces | /workspaces | 项目 clone、任务分支与 worktree |

同项目任务在 `/workspaces/<project-id>/tasks/<task-id>` 下使用独立 worktree，项目仓库位于同级 `repository`。`cleanup` 命令只清理归属匹配、已停止且无未提交变更的 worktree；失败会保留记录以供重试。归档不自动删除代码。

服务重启将执行中的任务标记为 `interrupted`，不会自动重放可能有副作用的工具调用；用户检查结果后点击重试或继续。尚未领取的队列命令继续处理，已领取但未完成的命令保留中断记录。

备份时先 `docker compose stop`，再一致地备份三个卷和 `.env`。保留加密密钥，否则无法解密旧 Token。不要使用 `docker compose down -v`，该操作会删除数据。回滚时停止服务，恢复对应版本镜像以及配套的三卷备份后启动；工作区中的未提交文件需同时保留。

## 安全与 API

无账号或角色系统；这是持有部署密钥即可使用的共享工作空间。默认只绑定 `127.0.0.1`。远程使用应经 HTTPS 反向代理，并设置 `COOKIE_SECURE=true`。项目 Token 仅传给短生命周期 Git 进程，不写入 remote URL；Agent shell 使用过滤后的环境。Agent 与服务同容器、同 OS 用户运行，worktree **不提供恶意代码隔离**，应仅连接可信项目。

- `GET /health`：公开健康检查。
- `POST /api/connect`：通过 Bearer 部署密钥建立 HttpOnly/SameSite cookie，并返回短期签名密钥。
- 其他 GET：有效 cookie 或 Bearer 部署密钥认证。
- 所有业务 POST：`x-timestamp`（毫秒）、`x-nonce`、`x-request-id`、`x-signature`。
- 签名：HMAC-SHA256，内容为 `method + "\n" + pathWithQuery + "\n" + timestamp + "\n" + nonce + "\n" + requestId + "\n" + SHA256(rawBody)`，输出十六进制。
- 时间窗由 `REQUEST_WINDOW_MS` 控制（默认 60 秒）。相同请求 ID 和内容返回原结果；不同内容冲突、nonce 复用或过期请求均拒绝。防重放记录保留七天，过期签名在删除后仍因时间窗失效。
- `GET /api/projects`，`POST /api/projects`：项目配置（写入体：name/repositoryUrl/apiToken/defaultBranch）。
- `POST /api/tasks`：projectId/description。
- `GET /api/board`：各泳道首页。
- `GET /api/lane?stage=Explore&limit=20&cursor=...`：独立分页，单页最多 100 条。
- `GET /api/tasks/:id` 与 `/runs`、`/conversations`、`/proposals`、`/workspace`：详情与阶段资料。
- `GET /api/tasks/:id/events?after=序号`：按序返回增量事件，客户端记住最后序号后续接。
- `POST /api/tasks/:id/commands`：`{type,payload}`；type 支持 message、pause、resume、retry、stop、transition、confirm_transition、cleanup。转移 payload 为 `{target,version}`；确认转移为 `{proposalId,version}`；消息为 `{text}`。队列操作返回 202，执行失败通过事件与阶段状态展示。

## 本地开发及验证

```sh
npm ci
npm run check
npm test
# 先通过环境变量提供密钥、模型和 GitLab 配置
npm start
```

测试使用真实本地 Git 仓库验证 worktree 隔离，使用可控 Agent 验证 HTTP 全流程、阶段交接、人工确认、暂停恢复、事件续接、重放保护和重启持久化。真实 GitLab/模型调用需部署时提供凭据后验收，测试不会访问用户仓库或消耗模型额度。
