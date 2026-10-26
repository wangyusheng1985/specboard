# AGENTS.md

## 项目概览

Specboard 是基于 OpenSpec 和 Pi SDK 的多阶段研发任务协同与执行平台。系统已全面解耦为 API 服务、独立调度器（Dispatcher）、动态容器化 Agent、PostgreSQL 存储、专用 LLM Gateway 与 Nginx HTTPS 反向代理，支持以结果为导向的自主执行、结构化澄清、有界故障自愈、阶段成果校验与浏览器通知。

## 核心架构与服务职责

- **API 服务 (`src/runtime-api.ts`, `src/runtime-service.ts`)**：基于 Fastify 与 PostgreSQL 提供标准化 OpenAPI 接口、任务状态机、事件流（SSE）、Scoped Token 签发与权限校验、方案审批与成果快照。
- **调度器 (`src/dispatcher.ts`)**：基于租约（Lease）独占认领任务队列，负责动态拉起、监控与清理独立的 Agent Docker 容器。
- **动态 Agent (`src/agent-container.ts`, `Dockerfile.agent`)**：按阶段按需拉起的无状态临时容器，运行 Pi SDK；内置 Python 3 (pip, venv, ruff) 与 Go 1.26 语言工具链；通过 Scoped Token 与 API 通信，内置内部通信有界指数退避重试，平滑吸收瞬时网络抖动与 5xx 故障。
- **LLM Gateway (`src/gateway-server.ts`, `src/llm-gateway.ts`)**：集中管理模型转发、加密中继配置、多 Relay 熔断降级与请求退避，隔离上游 API 凭据。
- **存储与数据 (`src/postgres-store.ts`, `src/runtime-migration.ts`)**：PostgreSQL 18 作为生产数据源，实现强一致行级锁、排他租约、事件游标与幂等写入；SQLite（`src/store.ts`）保留作为本地离线单元测试桩。
- **HTTPS 反向代理 (`nginx.conf`)**：Nginx 1.27 提供带 IP SAN 的 TLS 终端（`https://10.9.34.84:3443`），保障安全上下文及浏览器通知（Notification API）功能。

## 开发约定

- 使用 Node.js 24 或更高版本，TypeScript ESM 规范（源码导入保留 `.ts` 扩展名）。
- 所有状态变更必须经过服务端状态机、版本号检查与幂等控制（`idempotency-key`）。
- 阶段推进顺序固定为：`Explore -> Propose -> Apply -> Archive`。
  - **Propose 审批**：用户点击“确认方案并开始执行”完成方案审批并原子进入 Apply。方案 Digest/Revision 由服务端根据任务版本和产物快照自动计算，无需用户手动填写 Hash。
  - **Apply 交付与归档**：Apply 阶段必须经过真实工作区验证证据交付（`outcome_state === 'delivered'`），必须停留在 Apply 供用户审阅，严禁自动跳过审阅进入 Archive；归档必须由用户显式触发“手动归档”。
  - **Apply 执行中控制**：Apply 阶段活动运行时，操作主按钮明确标识为“停止并归档”，执行安全停止并保留既有归档安全校验。
- 敏感信息防护：严禁将 API Token、GitLab 私钥、加密密钥或真实凭证打印到控制台日志、持久化会话、WebSocket/SSE 广播或向用户暴露的错误响应中。

## 故障恢复与自愈规范

- **有界自愈预算**：每阶段执行单元（Episode）默认提供 5 轮 / 30 分钟持久化自愈预算。
- **静默自动恢复**：
  - 针对分类为 `safe_boundary` 的瞬时故障（如 Agent API 500、网络抖动、模型上游暂时超时），系统在后台自动调度恢复执行，任务状态正常呈现为“自动处理中”或“执行中”。
  - 在自愈预算内，前端**严格抑制展示**失败诊断卡片、内部 JSON 堆栈及 legacy 重复错误提示，不给用户呈现无法直接操作的底层技术报错。
  - 仅在自愈预算耗尽（`outcome_state === 'blocked'`）或明确需要人工介入（`recoverySafety === 'manual_inspection'`）时，才向用户展示诊断卡片并给出操作指引。
- **人工干预原则**：界面取消多余的“继续”、“重试”独立按钮。系统故障自动恢复；人工恢复通过在“补充信息”发送结构化会话消息触发。

## 前端交互与视觉规范

- **单抽屉交互原则**：统一使用右侧抽屉（移动端使用底部抽屉），同一时刻仅允许一个抽屉展开，**严禁嵌套弹窗或多层抽屉**。二次确认采用行内确认组件。
- **状态感知刷新**：使用 `DetailRefreshState` 维持平滑轮询（1.2 秒），在后台数据刷新期间严格保留未提交的表单输入、草稿与滚动条位置，杜绝界面闪烁与输入丢失。
- **克制低噪声**：仅展示与当前操作直接相关的信息；无诊断时完全隐藏诊断卡片；仅展示最新一条有效诊断。
- **安全上下文通知**：浏览器通知仅在 HTTPS 正常授权后启用，限制为单泳道 Top 20 活跃任务范围，仅针对待回答、待确认方案、执行受阻、交付待审阅等关键决策事件提醒。

## 持续验证与部署流程

修改代码后必须在本地运行完整验证：

```bash
npm run check   # TypeScript 类型检查
npm run lint    # ESLint 代码风格检查
npm test        # 全量自动化测试
```

**测试环境自动部署机制**：
每次功能修复或变更完成且本地验证通过后，默认自动构建 Linux amd64 镜像并部署到测试服务器 `10.9.34.84`：
1. 构建 amd64 镜像：`specboard-api` 与 `specboard-agent`。
2. 传输并滚动更新 `10.9.34.84` 上的 Compose 服务（保留 `specboard_postgres-data`、`specboard_sessions`、`specboard_workspaces` 等持久化卷）。
3. 检查容器健康状态（`http://127.0.0.1:3000/health` 及 HTTPS 端口）。
4. 仅在部署遇到不可自愈的阻塞时才暂停报告。
