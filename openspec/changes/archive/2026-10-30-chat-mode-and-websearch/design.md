## Context

详见 `proposal.md` - Why。当前系统主要定位于软件工程研发任务的全流程治理（工作模式：Explore ➔ Propose ➔ Apply ➔ Archive），依托 PostgreSQL、独立调度器与动态容器化 Pi Agent 展开自动化工程执行。

现需要在保留既有工作模式完整性的前提下，新增以对话为中心的“会话模式”（Chat Mode），支持用户选择项目或无项目开启自由探索；同时需要为 Pi Agent 运行时拓展外网网络搜索与网页抓取工具，补齐外部知识检索能力。

## Goals / Non-Goals

**Goals:**
- 提供顶部全局导航的双模式切换控制器（工作模式看板 vs 会话模式对话），并在本地记住用户的模式选择。
- 在会话模式下提供项目选择（特定项目代码库 vs 无项目通用对话），并支持多轮对话创建、切换与消息持久化。
- 无论是否绑定项目，会话模式的执行内核均严格复用现有的“探索模式”（Explore 阶段），包括流式输出、工具调用指示、原型文件生成与结构化澄清，不进入方案审批（Propose）与变更实施（Apply）流水线。
- 在 Agent 运行时中封装并提供 `web_search` 与 `fetch_content` 工具，且外部搜索凭证统一由服务端内部网关代理，不泄露至容器或前端。
- 前端对话界面支持多会话管理、消息历史回溯、Markdown 富文本排版、工具调用卡片折叠与自包含产物模态预览。

**Non-Goals:**
- 不修改既有工作模式的阶段演进规则（Explore ➔ Propose ➔ Apply ➔ Archive）与安全归档校验。
- 会话模式不执行 Git 分支创建、提交代码推送与 MR 创建等破坏性或写代码库操作。
- 不引入外部重度依赖或重构数据底座，保持 PostgreSQL 强一致性与 Docker Compose 单机部署能力。

## Decisions

### 1. 会话数据模型与调度机制复用现有任务体系

**决策**：
在 `tasks` 表增加 `kind` 字段（默认 `'work'`，会话模式为 `'chat'`），或建立轻量关联。`kind: 'chat'` 的任务具备以下特征：
- 其生命周期常驻在 `stage = 'Explore'`。
- 支持 `project_id` 为空（代表通用对话）或指向已配置的特定项目。
- 调度器 `dispatcher.ts` 识别 `kind: 'chat'` 时，同样为其申请租约并拉起 Explore 容器；当无项目绑定时，挂载无 Git 绑定的临时隔离目录（`/workspaces/global-chat/<task-id>`），跳过 Git 克隆与 Worktree 逻辑。
- 对外统一在 API 层提供语义化的 `/api/v1/chats` 路由封装（亦可底层映射至 tasks），便于前端以“会话”概念管理。

**考虑过的替代方案**：
- *完全独立的 chat 表与平行的调度引擎*：会导致两套调度器、两套 Agent 容器通信协议和事件流管道，代码冗余极大，且无法自然复用既有的 Explore 技能和澄清机制。

### 2. Pi Agent Web 工具集（`web_search` 与 `fetch_content`）与凭证中继

**决策**：
- **服务端中继机制**：在服务端提供内部接口 `/internal/v1/tools/web-search`，Agent 容器通过其已有的 Scoped Token 向服务端发起搜索请求；服务端集中读取环境变量（如 `SEARCH_API_KEY`、`SEARCH_PROVIDER`，支持 DuckDuckGo/SearXNG/Tavily/Brave 等公有或免密检索源，缺省时支持内置免费搜索引擎爬取或回退），隔离上游 API 凭据。
- **`web_search` 工具**：入参支持 `{ query: string, numResults?: number }`，返回清洗后的条目列表（`title`, `url`, `snippet`）。
- **`fetch_content` 工具**：入参支持 `{ url: string }`，工具直接发起 HTTP GET 请求，通过正文清洗模块（去除 `<script>`, `<style>`, `<nav>` 等标签）提取主要正文并转化为易于 LLM 阅读的 Markdown，单次截断保护在 30KB 以内。
- **注册方式**：在 `src/agent-container.ts` 中，`definitions` 数组中始终加入 `createWebSearchToolDefinition` 与 `createFetchContentToolDefinition`，在 Explore 阶段及 Chat 场景均可调用。

**考虑过的替代方案**：
- *直接将 SEARCH_API_KEY 注入 Agent 容器*：违反项目《AGENTS.md》中“严禁将敏感凭据暴露给容器环境或客户端”的规范。

### 3. 前端双模式无缝切换与单抽屉架构兼容

**决策**：
- 顶部导航栏增加模式切换控制组件，分别使用看板图标（工作模式）与对话图标（会话模式）。
- 切换模式时通过切换主容器可见性（`.mode-work-view` 与 `.mode-chat-view`），保持后台数据轮询与前台状态互不干扰。
- 会话视图采用现代标准两栏布局：
  - 左侧：历史会话列表、“新建会话”操作区以及项目绑定筛选器（所有已连接项目 + “无项目 / 通用对话”选项）。
  - 右侧：活动会话消息流区域，包含会话顶部元数据（绑定的项目名称、状态指示）、消息流（支持用户消息、助手消息、工具调用折叠盒、澄清卡片）、底部大输入框。
- 延续系统既有的 Markdown 渲染器、代码高亮、原型全屏模态预览弹窗（Modal Dialog）以及单抽屉架构规范。

## Risks / Trade-offs

- **[Risk] 外网网络环境不可达或搜索提供商服务超时**
  - **Mitigation**: 内部搜索中继与 `fetch_content` 工具设置 10 秒硬超时；若外部服务失败，工具捕获错误并返回标准提示：“外部网络检索暂时不可用: [原因]”，让 Agent 得以根据自身训练知识继续作答，容器永不崩溃。
- **[Risk] 抓取网页包含过多非结构化数据或海量文本导致上下文窗口被撑爆**
  - **Mitigation**: 对抓取内容进行严格截断（最大 30,000 字符），只保留主体 Markdown，并在系统提示中指导 Agent 重点提炼。
- **[Risk] 无项目绑定的临时会话产生大量废弃无主目录**
  - **Mitigation**: 临时会话工作区统一隔离于 `/workspaces/_chat/<task-id>`，在会话被用户删除或归档时自动级联清理。
