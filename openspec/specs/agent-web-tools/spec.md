# agent-web-tools Specification

## Purpose
为 Specboard 的 Pi Agent 容器运行时赋予实时外网网络搜索与网页主要内容提取能力，使 Agent 在执行代码库探索或即时会话问答时能够查阅最新官方文档、开源规范及外部公开技术资料。

## Requirements

### Requirement: Web Search Tool Integration
Agent 运行时环境 SHALL 注册标准化 `web_search` 插件工具，支持接收单查询词或多角度查询列表并返回带来源 URL 和高内聚摘要的结构化结果。

#### Scenario: Agent executes external search query
- **WHEN** Agent 在回答技术问题或探索过程中调用 `web_search` 工具并传入查询关键词时
- **THEN** 系统 SHALL 通过配置的网络搜索通道执行查询，并在指定时限内向 Agent 返回搜索结果列表（包含网页标题、来源 URL 及正文摘要）。

#### Scenario: Search query execution failure or rate limiting
- **WHEN** 外部搜索引擎接口网络超时、发生限流或上游不可达时
- **THEN** 工具 SHALL 返回包含明确错误原因的结构化工具异常反馈，Agent SHALL 依据返回说明向用户说明情况并尝试降级回答，严禁导致 Agent 容器发生未捕获异常崩溃。

### Requirement: Web Page Content Fetching Tool
Agent 运行时环境 SHALL 注册标准化 `fetch_content` 插件工具，支持传入公网 HTTP/HTTPS 链接并获取经清洗提取的 Markdown 或可读正文文本。

#### Scenario: Agent fetches public technical documentation URL
- **WHEN** Agent 调用 `fetch_content` 工具传入目标技术文档链接时
- **THEN** 系统 SHALL 发起网页请求并完成 DOM 解析与正文清洗，向 Agent 返回结构化且易于阅读的 Markdown 格式页面主要内容。

#### Scenario: Fetching invalid URL or unreachable page
- **WHEN** 传入的 URL 无法解析、返回 4xx/5xx 状态码或内容超时未响应时
- **THEN** 工具 SHALL 捕获异常并返回友好的错误说明给 Agent，以便 Agent 调整策略或通知用户链接不可访问。

### Requirement: Transparent Tool Feedback in Conversation Stream
当 Agent 调用 `web_search` 或 `fetch_content` 时，前端界面与事件流 SHALL 实时呈现工具调用意图与结果摘要，同时杜绝敏感凭证泄露。

#### Scenario: Web tool invocation display
- **WHEN** Agent 开始执行外部搜索或抓取网页时
- **THEN** 前端消息流中 SHALL 实时展示工具执行指示器，显示搜索查询词或访问的网址域名；当工具执行完成时展示收拢的检索结果或摘要卡片。

#### Scenario: Credential isolation in web search operations
- **WHEN** 记录工具调用事件日志、前端展示或持久化会话记录时
- **THEN** 系统 SHALL 严格隔离外部搜索引擎的真实 API Key 或访问 Token，严禁将其输出至前端 UI、控制台日志或持久化消息中。
