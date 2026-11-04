## 1. CI 状态与异常信息精准捕获及防竞态流水线发现

- [x] 1.1 扩展 `src/github-client.ts` 与 `src/git-platform.ts` 中的未完成/失败 Job 匹配条件，纳入 `cancelled`、`timed_out` 等状态，并在 `UnifiedPipeline` 中支持透传 `sha`（commit SHA），编写测试验证 Job 状态与 SHA 提取
- [x] 1.2 在 `src/github-client.ts` 中针对无法下载日志的 Job（如未分配 Runner 排队即被取消的 Job），自动合成包含 Job 运行状态、Runner 标签与详情链接的兜底 Trace 摘要，并通过单元测试验证
- [x] 1.3 修复 `src/mr-service.ts` 的初次流水线发现（步骤 4）逻辑，增加针对当前推送 Commit SHA（`head_sha`）的强比对以及排除前序失败 `pipeline_id` 的防竞态过滤，编写测试验证推送后不会误读取旧失败流水线
- [x] 1.4 优化 `src/mr-service.ts` 的失败处理逻辑，将准确提取到的 Job 名称及真实 Trace 注入 Agent 修复会话并传递给受阻诊断，杜绝 `job unknown` 现象，通过集成测试验证

## 2. 结构化诊断模型与 LLM 提炼服务

- [x] 2.1 定义 `StructuredDiagnosis` 接口并扩展 `RunDiagnostic` 数据契约，支持包含 `analysis`（根因）、`suggestions`（>=1 条建议数组）和 `rawTrace`（原始日志堆栈）的三段式结构
- [x] 2.2 实现诊断合成服务（`src/diagnostic-synthesizer.ts`），基于系统现有的 `LLMGateway` 调用模型提炼结构化诊断，内置 8 秒严格超时与本地启发式降级逻辑，并通过单元测试验证正常合成与降级分支
- [x] 2.3 在任务执行受阻、自愈预算耗尽或产生终端诊断时调用合成服务，将结构化数据持久化至 `run_diagnostics` 表并通过 API 暴露给前端，通过服务层测试验证

## 3. 前端三段式诊断卡片组件与交互重构

- [x] 3.1 在 `public/diagnostic-presentation.js` 中新增结构化诊断解析与向后兼容适配函数，编写单元测试覆盖具备 `structured` 字段和传统 `message` 字段的两种数据流
- [x] 3.2 重构 `public/app.js` 中的全局受阻决策横幅卡片渲染逻辑，按第一部分（LLM 根因总结）、第二部分（人工介入建议列表）、第三部分（原生 `<details>` 折叠原始错误与堆栈，附带一键复制）渲染，并通过浏览器端行为验证
- [x] 3.3 在 `public/style.css` 中增加三段式卡片的视觉分区、建议列表数字微标、等宽代码块高亮与可折叠面板样式，确保符合无障碍与暗色主题规范

## 4. 全链路测试与持续验证

- [x] 4.1 运行 `npm run check` 确保 TypeScript 类型检查全部通过
- [x] 4.2 运行 `npm run lint` 确保代码格式与风格无任何违规
- [x] 4.3 运行 `npm test` 确保全量单元测试与集成测试全部通过
