## MODIFIED Requirements

### Requirement: Vector SVG Icon System
系统前端 SHALL 全面使用内联或统一风格的矢量 SVG 图标替代原生 Emoji，涵盖全局控制、会话引导、思考状态、工具调用与上下文指示，支持主题色动态适配，并在必要时提供无障碍文本替代。

#### Scenario: Structural icon rendering
- **WHEN** 界面渲染垃圾桶删除区、外链跳转、关闭按钮、状态指示及复制按钮时
- **THEN** 系统 SHALL 渲染一致线宽与风格的矢量 SVG 图标，且用于纯装饰性展示的图标 SHALL 标记 `aria-hidden="true"`，独立可交互图标 SHALL 提供 `aria-label`。

#### Scenario: Chat mode vector icon replacement
- **WHEN** 渲染会话模式的快捷探索卡片、深度思考状态徽标、工具调用条目及上下文选择器时
- **THEN** 界面 SHALL 使用精准语义的内联矢量 SVG 图标替代全部原生 Emoji（包括架构分析、代码事实排查、联网检索、生成原型、深度思考、工具执行及项目上下文标签），严禁在 UI 界面中直接渲染 Emoji 字符。

#### Scenario: Tool invocation semantic iconography
- **WHEN** 消息流中呈现智能体调用工具（如 `web_search`、`fetch_content`、`read/grep/find/ls`、`write/edit`）时
- **THEN** 工具卡片 SHALL 搭配专用的矢量 SVG 图标（如搜索放大镜、地球网格、代码终端、文档文件），线宽统一为 1.75px ~ 2.0px 并继承主题配色。
