# chat-mode Specification

## Purpose
为 Specboard 研发协同平台提供轻量化且高响应度的会话交互模式（Chat Mode），支持用户在无项目绑定或选定特定代码库的上下文中，复用探索阶段（Explore）内核能力开展代码问答、架构技术咨询与深度开放式探索。

## Requirements

### Requirement: Chat Mode Session Management
系统 SHALL 提供对话会话（Conversation）的创建、列表检索、重命名、切换与清理等全生命周期管理，并记录会话的多轮消息历史。

#### Scenario: Create conversation without project binding
- **WHEN** 用户在会话模式下选择“无项目 / 通用对话”并发起新提问时
- **THEN** 系统 SHALL 创建通用探索会话，初始化无代码库挂载的独立会话上下文，并正常接收和响应用户消息。

#### Scenario: Create conversation with project binding
- **WHEN** 用户在会话模式下选中一个已连接的项目并创建新会话时
- **THEN** 系统 SHALL 建立与该项目绑定的会话，自动挂载该项目的工作区上下文，使 Agent 具备访问项目代码树的能力。

#### Scenario: Switching active conversation
- **WHEN** 用户在会话侧边栏中点击历史会话记录时
- **THEN** 系统 SHALL 切换当前活动会话，即时加载并渲染该会话的历史消息流，同时同步顶部或上下文指示栏中的项目绑定状态。

### Requirement: Project Grounded Code Exploration in Chat
当会话绑定项目代码库时，Agent SHALL 以该项目工作区代码为第一事实依据进行检索、定位与分析，保证回答的技术准确性。

#### Scenario: Answering query using project codebase
- **WHEN** 用户在绑定项目的会话中询问代码实现细节、架构依赖或缺陷排查时
- **THEN** Agent SHALL 优先调用代码读取、搜索与文件遍历工具检视项目工作区真实代码，并基于代码事实返回带文件路径引用的精准回答。

#### Scenario: Query in general conversation without project
- **WHEN** 用户在未绑定项目的会话中进行通用技术咨询、算法设计或语法讨论时
- **THEN** Agent SHALL 基于大模型知识储备及外网网络工具直接作答，不依赖本地代码仓库。

### Requirement: Explore Kernel Interaction without Pipeline Enforcement
会话模式 SHALL 复用 Explore 阶段内核能力进行多轮交互、思考推理与原型生成，严禁强制要求推进到方案审批（Propose）或代码实施（Apply）流水线。

#### Scenario: Real-time streaming response and tool visualization
- **WHEN** Agent 在会话模式下思考、检索代码或调用工具时
- **THEN** 前端界面 SHALL 实时流式渲染文本增量输出，并以可折叠或高内聚卡片直观呈现工具执行过程与结果反馈。

#### Scenario: Generating on-demand prototypes or preview files
- **WHEN** 用户在会话中明确要求绘制原型、生成 HTML 演示文件或架构图时
- **THEN** Agent SHALL 在该会话工作区直接生成自包含演示文件，并通过前端阶段成果或模态预览弹窗支持即时查看。

#### Scenario: Interactive clarification within conversation flow
- **WHEN** 用户指令存在重大歧义或 Agent 需要关键决策输入时
- **THEN** 系统 SHALL 在对话消息流中无缝内联展示澄清选项或表单卡片，用户提交答案后 Agent 继续执行对话。

### Requirement: Granular Pi-Agent Style Timeline Cards
在会话模式下，系统 SHALL 将智能体的交互过程解耦为按执行时序排列的独立卡片（包含深度思考卡片、独立的单项工具调用与结果卡片、以及正式回复卡片），严禁将多个不同或连续的工具调用压缩合并到单一折叠容器中。

#### Scenario: Individual tool execution card presentation
- **WHEN** 智能体在会话执行过程中调用具体工具（如 `read`、`web_search`、`ls`、`fetch_content`、`write`）时
- **THEN** 系统 SHALL 为每一次工具调用渲染独立的结构化卡片，并在该卡片内部同时展示模型发起的入参参数与工具实际返回的执行输出结果。

#### Scenario: Thinking and analysis card with model content
- **WHEN** 智能体在输出正式回复前进行深度思考、思维链推演或阶段分析时
- **THEN** 系统 SHALL 呈现独立的“深度思考”卡片，展示模型的思考分析过程或推理摘要，并支持展开/折叠查阅。

#### Scenario: Temporal execution order preservation
- **WHEN** 会话经历多轮思考、多次工具调用与多次增量输出时
- **THEN** 界面消息流 SHALL 严格按照事件发生的实际先后时序，依次交错呈现思考卡片、单项工具调用卡片与文本回复卡片，形成连贯的探查执行流水。

