# Specboard

Specboard 是基于 OpenSpec 与 Pi SDK 构建的自主研发协作看板。系统围绕 Explore、Propose、Apply、Archive 四个标准化研发阶段，通过解耦的容器化 Agent、结构化澄清交互、有界自愈恢复、真实工件校验与安全 HTTPS 上下文，提供低噪声、高确定性的端到端自主研发流程。

## 核心特性

- **解耦的分布式运行时**：API 服务、任务调度器（Dispatcher）、临时 Agent 容器与 LLM Gateway 各司其职，通过 Scoped Token 与短期租约隔离。
- **阶段驱动的工作流**：
  - **Explore**：需求发散与可行性调研。
  - **Propose**：方案生成与产物校验。服务端自动计算方案快照摘要（Digest/Revision），一键“确认方案并开始执行”原子流转到 Apply。
  - **Apply**：代码实现与验证。执行中支持“停止并归档”；实现完成后强制停留等待审阅（`delivered`），杜绝未经审阅自动归档。
  - **Archive**：成果与规范沉淀，由用户人工核验后触发手动归档。
- **有界自愈与瞬时故障吸收**：
  - 单阶段提供 5 轮 / 30 分钟持久化自愈预算。
  - Agent 容器内置 5xx 与网络故障指数退避重试，平滑吸收中间通信抖动。
  - 自动恢复期间静默抑制错误卡片与内部 JSON，仅在预算耗尽或需人工介入时清晰呈现。
- **统一右侧抽屉体验**：
  - 拒绝嵌套弹窗与弹窗内二次弹窗，所有临时面板、诊断与交互统一使用右侧抽屉（移动端使用底部抽屉）。
  - 内置 `DetailRefreshState` 机制，后台轮询（1.2 秒）期间平滑保留未提交输入和滚动条位置。
- **安全上下文与浏览器通知**：
  - 基于 Nginx 反向代理配置自签名/正式 HTTPS（默认端口 3443），提供标准的 Web Notification 安全上下文。
  - 多泳道 Top 20 限制，仅针对需人工决策（提问、待审批、受阻、待审阅）的关键时刻发送桌面通知。
- **多语言开发工具链**：Agent 镜像内置 Node.js 24、Python 3（pip, venv, ruff）与 Go 1.26 工具链，支持多语言项目的自动化实现与测试运行。

## 系统架构

```text
┌────────────────────────────────────────────────────────┐
│                      Nginx (HTTPS:3443)                │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    specboard-api:3000                  │
│       (Fastify, OpenAPI /docs, SSE, Scoped Tokens)     │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
┌─────────────▼───────────────┐ ┌─────────▼──────────────┐
│        PostgreSQL 18        │ │       LLM Gateway      │
│  (Tasks, Runs, Leases, DB)  │ │   (Relays, Circuit)    │
└─────────────────────────────┘ └────────────────────────┘
              ▲
              │ Leases / Queue
┌─────────────┴───────────────┐
│     specboard-dispatcher    │
│  (Docker Container Manager) │
└─────────────┬───────────────┘
              │ Spawns per-stage
┌─────────────▼───────────────┐
│       specboard-agent       │
│ (Pi SDK, OpenSpec, Worktree)│
└─────────────────────────────┘
```

## 快速开始

### 1. 准备环境与配置文件

需要 Docker Engine 与 Docker Compose v2：

```bash
git clone https://github.com/wangyusheng1985/specboard.git
cd specboard

cp .env.example .env
```

生成并配置必要密钥：

```bash
# 生成 32 字节随机 Hex 填入 .env
openssl rand -hex 32  # 填入 API_SECRET
openssl rand -hex 32  # 填入 ENCRYPTION_KEY
openssl rand -hex 32  # 填入 DISPATCHER_TOKEN
openssl rand -hex 32  # 填入 GATEWAY_ADMIN_TOKEN
openssl rand -hex 32  # 填入 GATEWAY_TOKEN
openssl rand -hex 16  # 填入 POSTGRES_PASSWORD
```

在 `.env` 中配置模型提供商（或直接在部署后通过界面的“LLM 配置”管理多 Relay 中继）：

```dotenv
PI_PROVIDER=anthropic
PI_MODEL=claude-3-7-sonnet
PI_API_KEY=your-api-key
GITLAB_ALLOWED_HOSTS=gitlab.com
```

### 2. 启动服务

```bash
docker compose config --quiet
docker compose up -d --build
```

检查各服务健康状态：

```bash
docker compose ps
curl -fsS http://localhost:3000/health
```

### 3. 访问与连接

- **HTTPS 入口（推荐，支持通知）**：`https://localhost:3443`
- **HTTP 入口**：`http://localhost:3000`
- **OpenAPI 交互式文档**：`https://localhost:3443/docs`
- **OpenAPI JSON 规范**：`https://localhost:3443/openapi.json`

首次打开页面点击右上角“连接”，输入 `.env` 中配置的 `API_SECRET`。连接成功后凭证即刻从前端表单清除，客户端仅持有短期有效的签名会话密钥。

## 数据持久化与备份

Compose 声明了四个命名持久卷：

| 命名卷 | 容器挂载路径 | 说明 |
| :--- | :--- | :--- |
| `postgres-data` | `/var/lib/postgresql` | PostgreSQL 18 数据库文件 |
| `workspaces` | `/workspaces` | GitLab 仓库 Clone、任务分支与 Git worktree |
| `sessions` | `/sessions` | Pi SDK 对话会话与上下文 JSONL 记录 |
| `https_certs` | `/etc/nginx/certs` | Nginx 自签名或导入的 TLS 证书与私钥 |

### 备份建议

在升级或迁移前，请先停止服务并同时备份数据卷及 `.env`：

```bash
docker compose stop
# 导出数据库
docker compose exec -T db pg_dump -U specboard specboard > backup-$(date +%F).sql
# 备份持久化数据目录
tar -czvf workspaces-backup.tar.gz /var/lib/docker/volumes/specboard_workspaces
tar -czvf sessions-backup.tar.gz /var/lib/docker/volumes/specboard_sessions
```

> **注意**：绝对不要执行 `docker compose down -v`，该操作会清空全部持久化卷！

## 本地开发与测试

```bash
# 安装依赖
npm ci

# 代码检查与格式化
npm run check
npm run lint

# 全量自动化测试（支持单元、协议、调度、恢复等 50+ 测试项）
npm test

# 本地启动 API
npm run dev
```

构建并验证 amd64 生产镜像：

```bash
docker build --platform linux/amd64 -t specboard-api:latest -f Dockerfile .
docker build --platform linux/amd64 -t specboard-agent:latest -f Dockerfile.agent .
docker build --platform linux/amd64 -t specboard-gateway:latest -f Dockerfile.gateway .
```

## 安全模型

- **无共享弱口令**：所有受保护接口通过短期 Bearer Token、HMAC-SHA256 请求签名（防重放窗口默认 60 秒）及租约校验。
- **环境隔离**：Agent 运行于只读根目录容器（UID 1000），禁止挂载宿主机 Docker Socket；仅 Dispatcher 持有 Docker Socket 权限。
- **凭据最小化暴露**：GitLab Token 经 AES-GCM 加密存储，仅在拉取代码时注入临时 Git 进程，不存入 Remote URL；上游 LLM 密钥仅保存在 Gateway 内部。
