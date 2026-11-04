## 1. MR 阶段步骤与分类校正

- [x] 1.1 在 `src/agent-container.ts` 中将 MR 阶段的执行步骤从 `step = 'validation'` 修改为 `step = 'mr'`，并在异常捕获逻辑中将 `mr` 步骤的默认异常分类映射为 `runtime_environment`，编写或更新单元测试验证分类准确

## 2. CI 故障精准建议生成

- [x] 2.1 在 `src/diagnostic-synthesizer.ts` 的启发式降级逻辑中，增加针对 `cancelled`、`macos-13`、`Runner`、`Actions` 等 CI 关键字的匹配，输出修改 `.github/workflows/` 配置文件与 Runner 版本的具体建议，并编写单元测试验证
- [x] 2.2 在 `public/diagnostic-presentation.js` 的 `normalizeStructuredDiagnosis` 中同步更新前端降级建议，当检测到 CI 关键字时输出 CI 专属建议，严禁输出 OpenSpec 产物检查建议，并更新单元测试验证

## 3. Agent 自愈提示词强化

- [x] 3.1 在 `src/mr-service.ts` 中更新唤醒 Agent 修复的 `session.prompt` 提示词，明确指引并授权 Agent 审查和修改 `.github/workflows/` 下的 CI 配置文件以修复 Runner 或环境故障，通过单元测试验证提示词内容

## 4. 全链路验证

- [x] 4.1 运行 `npm run check` 确保 TypeScript 类型检查全部通过
- [x] 4.2 运行 `npm run lint` 确保代码风格无违规
- [x] 4.3 运行 `npm test` 确保全量测试全部通过
