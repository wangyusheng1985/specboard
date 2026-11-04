## 1. 自动归档规约同步策略实现

- [x] 1.1 在 `src/agent-container.ts` 中针对 `Archive` 阶段探测远端默认分支是否跟踪 `openspec/specs` 目录，并在 System Prompt 中注入自动免交互归档约束（未跟踪则自动 `archive without syncing`，严禁弹出提问；已跟踪则自动同步合并后归档）
- [x] 1.2 编写单元测试验证 `agent-container.ts` 或对应归档策略函数在不同仓储基线下生成的指示内容准确无误

## 2. 全量验证与测试

- [x] 2.1 运行 `npm run check` 确保类型检查通过
- [x] 2.2 运行 `npm run lint` 确保代码风格通过
- [x] 2.3 运行 `npm test` 确保全量测试全部通过
