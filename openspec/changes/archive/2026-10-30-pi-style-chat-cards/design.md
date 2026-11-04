## Context

详见 `proposal.md` - Why。当前实现中，前端将所有工具调用（`tool_execution_start` 与 `tool_execution_end`）在遍历完整个事件流后集中收集到了一个单一的 `chat-card-tools` 折叠盒子中，导致：
1. 丢失了工具调用的发生时序（例如先思考 ➔ 读文件 A ➔ 继续思考 ➔ 读文件 B ➔ 输出回答）；
2. 多个工具打包在一起，只展示了简短的路径或查询词，未展示模型传入的结构化参数及工具执行返回的具体数据内容；
3. 缺失对模型思维链或分析内容的单独卡片承载。

系统底层依赖的 Pi Agent SDK 与运行时事件（`tool_execution_start` 与 `tool_execution_end`）本身具备完整的时序与数据承载（包含 `toolCallId`、`toolName`、`params`、`result.content` 等）。前端需要建立基于时间线的独立卡片渲染架构。

## Goals / Non-Goals

**Goals:**
- 将会话消息流重构为事件驱动的时序流水（Timeline-based Stream）。
- 每一个工具调用对应一个独立的结构化卡片（Tool Call Card）：
  - **头部摘要**：展示工具专有矢量图标、工具名称、关键目标参数（如搜索词或文件路径）、执行耗时与完成状态。
  - **内部折叠/展开区域**：包含两部分——① LLM 发起的调用参数（`Parameters`，格式化 JSON 或关键字段）；② 工具返回的实际执行结果（`Output / Result`，如代码行、文件树、搜索摘要列表等）。
- 独立的思考分析卡片（Thinking Card）：
  - 提取模型输出的思考推理内容（或思维链），并配有专属展开视图与状态标识。
- 独立的正式回复卡片（Answer Card）：
  - 承载模型面向用户的最终回答，支持完整的 Markdown 排版与代码高亮。
- 保证流畅的时序交织排列，体验贴近 Pi Coding Agent TUI / CLI 交互质感。

**Non-Goals:**
- 不修改服务端的事件流接口协议，完全复用现有 PostgreSQL 中持久化的 `runtime_events` 与 SSE 流。
- 不影响工作模式（敏捷研发看板流水线）中的任务卡片与抽屉详情。

## Decisions

### 1. 基于时序的消息流分段状态机（Timeline Stream Segmentation）

**决策**：
在 `public/app.js` 的 `renderChatMessages` 中，废除“先把所有工具存入数组最后统一画一个总盒子”的旧逻辑，改用单遍历时序分块算法：
- 维护正在活跃的卡片上下文：
  - 当收到 `user_message`：提交前置卡片，渲染独立的用户提问气泡；
  - 当收到 `tool_execution_start`：提交前置回复卡片，在当前时序位置创建**独立的工具调用卡片**，记录 `toolCallId`、`params`、`status = 'running'`；
  - 当收到 `tool_execution_end`：根据 `toolCallId` 命中对应的工具卡片，回填 `result`（提取 `result.content` 文本并截断保护），更新状态为已完成（`completed`）及耗时；
  - 当收到 `text_delta`：如果文本包含思考链标记（或当前处于思考阶段），进入思考块；普通回答则进入当前活跃的回复卡片；
  - 当收到 `run_complete`：若无增量文本，以保底 `summary` 作为回复卡片呈现。

### 2. 单个工具卡片的数据分层呈现设计

**决策**：
每个独立的工具卡片结构为：
```html
<details class="chat-tool-single-card" open>
  <summary class="chat-tool-single-summary">
    <div class="tool-summary-left">
      <span class="tool-icon-wrap">${svgIcon}</span>
      <span class="tool-name">${toolName}</span>
      <span class="tool-key-arg">${keyParamPreview}</span>
    </div>
    <div class="tool-summary-right">
      <span class="tool-duration">${durationMs}ms</span>
      <span class="tool-status-badge">${status}</span>
    </div>
  </summary>
  <div class="chat-tool-single-body">
    <div class="tool-section">
      <div class="tool-section-title">调用参数 (Arguments)</div>
      <pre class="tool-code-block">${formattedParams}</pre>
    </div>
    <div class="tool-section">
      <div class="tool-section-title">执行输出 (Output)</div>
      <pre class="tool-code-block">${formattedResult}</pre>
    </div>
  </div>
</details>
```
- 默认在执行中或刚完成时保持轻量展开或自适应折叠，用户可随时点击查看具体的命令行、文件内容或网络搜索返回摘要。

### 3. 长内容安全截断与无障碍

**决策**：
对工具输出内容（`result.content`）做前端自适应截断（单次最多展示 8,000 字符，并带有 `...[点击查看完整输出]` 或垂直滚动条），防止过长的文件读取撑爆页面布局。

## Risks / Trade-offs

- **[Risk] 工具调用频繁时单个卡片过多导致垂向高度变大**
  - **Mitigation**: 单个工具卡片的 summary 采用紧凑的 32px 高度，执行完成后默认收拢或限制内部 pre 区域 `max-height: 220px` 带有平滑内部滚动条，保证既透明可查又不破坏整体阅读节奏。
