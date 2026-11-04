## 1. 数据模型与服务端 API 扩展

- [x] 1.1 扩展 PostgreSQL 迁移脚本支持会话任务（在 `src/runtime-migration.ts` 中支持任务 `kind: 'work' | 'chat'` 并允许 `project_id` 为空），运行本地迁移并通过测试验证。
- [x] 1.2 在 `src/runtime-service.ts` 与 `src/runtime-api.ts` 中实现会话 CRUD 与消息追加 API，编写单元测试验证通用对话与项目绑定会话的正确创建与列表查询。
- [x] 1.3 在服务端实现安全的外网搜索中继端点（`/internal/v1/tools/web-search` 与 `/internal/v1/tools/fetch-content`），支持凭证隔离与正文提取截断，编写单元测试验证接口响应。

## 2. Agent 运行时工具与调度器适配

- [x] 2.1 在 `src/agent-container.ts` 中实现 `web_search` 与 `fetch_content` 工具定义并注册至 Agent 工具链，编写测试验证工具入参校验与上游异常时的防崩溃捕获。
- [x] 2.2 扩展调度器 `src/dispatcher.ts` 支持 `kind: 'chat'` 会话任务，对于未绑定项目的会话自动初始化临时隔离工作区，通过测试验证任务可正常拉起 Explore 容器。
- [x] 2.3 优化 Explore 提示词模板以适配会话问答与网络搜索工具使用，验证提示词生成符合事实基准原则且无语法错误。

## 3. 顶部导航与双模式切换交互

- [x] 3.1 在 `public/index.html` 顶部导航栏增加模式切换控制器（工作模式看板 vs 会话模式），并集成专用矢量 SVG 图标与 `aria-hidden` 属性，验证导航栏对齐与防折行。
- [x] 3.2 在 `public/app.js` 与 `public/style.css` 中实现双模式状态管理，本地持久化用户模式偏好，验证切换模式时主视口平滑切换且未提交草稿不丢失。

## 4. 会话模式前端视图与多轮交互

- [x] 4.1 在前端构建会话模式双栏界面（左侧历史会话列表、“新建会话”与项目选择下拉框；右侧对话主视口），验证不同屏幕尺寸下的自适应排版。
- [x] 4.2 实现会话多轮交互、流式消息接收与实时打字渲染，支持高内聚展示代码检索、`web_search` 和 `fetch_content` 的工具调用卡片与结果折叠展开，验证交互顺畅。
- [x] 4.3 在会话模式中支持原型生成产物的模态弹窗预览与内联澄清卡片回复，验证生成 HTML 文件可即时全屏预览且澄清提交无缝衔接。

## 5. 全流程验证与回归测试

- [x] 5.1 运行 `npm run check` 与 `npm run lint`，确保代码符合 TypeScript ESM 规范与 ESLint 风格。
- [x] 5.2 运行全量自动化测试套件 `npm test`，确保既有工作模式、MR 流程、澄清通知与新增会话功能全量测试通过。
