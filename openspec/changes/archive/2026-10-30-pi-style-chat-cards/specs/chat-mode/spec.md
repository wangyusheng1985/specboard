## Purpose

为 Specboard 研发协同平台提供类似 Pi Coding Agent 的结构化、透明且时序解耦的多类型卡片会话交互能力，包括独立思考卡片、非合并独立工具调用与执行结果卡片及结构化回复卡片。

## ADDED Requirements

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
