## Why

Specboard 目前仅支持完整的软件工程研发流水线（工作模式：Explore ➔ Propose ➔ Apply ➔ Archive），缺乏低门槛、即时性强的日常技术对话与代码答疑场景；同时，内置 Pi Agent 缺乏实时外网检索与网页访问能力，无法获取最新的技术文档、开源库动态及外部公开知识。引入双模式（工作模式与会话模式）并为 Agent 赋予外网搜索与网页抓取插件，能够满足开发者快速查阅代码库、咨询架构方案及结合外网知识解决疑难技术问题的复合需求。

## What Changes

- **双模式架构支持（Work Mode & Chat Mode）**：
  - 顶部导航栏增加模式切换控制器，支持在“工作模式”（标准敏捷研发看板与多阶段任务执行）与“会话模式”（轻量即时会话与代码问答）之间无缝切换。
  - 会话模式提供清晰的项目绑定选择器（可选“无项目/通用对话”或指定代码仓库项目），未绑定项目时作为通用智能专家，绑定项目时以该项目代码库为事实基准进行探索与问答。
  - 会话模式基于既有的“探索模式”（Explore）内核与 Pi Agent 对话机制，保持纯粹的问答与代码探索，不强制触发方案设计、代码变更与合并流水线。
- **Pi Agent 网络搜索与网页访问插件系统**：
  - 在 Agent 运行时中新增 `web_search` 工具，支持多关键字外部搜索引擎查询并返回结构化摘要与来源引用。
  - 在 Agent 运行时中新增 `fetch_content` 工具，支持输入 URL 抓取解析网页主要内容，供 Agent 深入阅读外部技术文档或文章。
- **服务端会话管理 API 与持久化支持**：
  - 新增会话（Chat Conversation）与会话消息（Chat Message）的存储模型、状态机与 CRUD API。
  - 调度器针对会话类型任务支持按需拉起探索 Agent 容器或轻量复用工作区会话容器。
- **前端会话模式交互界面**：
  - 会话主界面提供会话列表管理、新建会话、项目绑定下拉选框、对话消息流（支持 Markdown、代码高亮、工具调用折叠卡片）。
  - 支持即时流式打字输出与用户连续多轮交互。

## Capabilities

### New Capabilities
- `chat-mode`: 支持平台会话模式，包括会话生命周期管理、项目绑定选择（无项目或选定项目代码库）、轻量会话探索流与多轮交互。
- `agent-web-tools`: 为 Pi Agent 引入 `web_search` 与 `fetch_content` 外部网络查询与网页内容提取工具。

### Modified Capabilities
- `header-navigation`: 顶部全局导航栏增加“工作模式 / 会话模式”顶层切换控制器及相应状态响应。

## Impact

- **数据层与迁移**：PostgreSQL 新增 `chat_conversations` 与 `chat_messages` 表（或在 `tasks` 表扩展任务类型 `task_type: 'work' | 'chat'`）。
- **服务端 API 与路由**：`src/runtime-api.ts` 与 `src/runtime-service.ts` 扩展会话接口（创建会话、追加消息、流式接收事件）；调度器 `src/dispatcher.ts` 适配会话型任务的拉起与事件转发。
- **Agent 工具与容器**：`src/agent-container.ts` 在 Explore 阶段及 Chat 场景注册 `web_search` 与 `fetch_content` 工具；需注入外网搜索服务凭据或网关配置。
- **前端交互**：`public/index.html`, `public/app.js`, `public/style.css` 新增模式切换、会话侧边栏与主消息视口，保持与既有单抽屉及无感刷新规范一致。
