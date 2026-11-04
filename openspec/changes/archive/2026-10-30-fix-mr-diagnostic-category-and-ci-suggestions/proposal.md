## Why

在当前 Specboard 的 MR 阶段执行链路中，存在两个导致受阻卡片给出错误建议的核心问题：
1. **MR 阶段异常被错误归类为产物校验失败**：在 `src/agent-container.ts` 中，MR 阶段的执行步骤被硬编码为 `step = 'validation'`。当 GitHub Actions 或 GitLab CI 执行失败时，异常捕获器将错误归类为了 `category: 'artifact_validation'`，直接导致系统误认为这是 OpenSpec 规划文档不合规。
2. **启发式降级建议与 Agent 提示词盲目套用**：当进入降级分支时，系统向用户呈现的是纯文档阶段的静态建议（“检查 tasks.md / proposal.md / design.md 产物”），且在唤醒 Agent 自愈修复时，未明确提示 Agent 可以审查与修改 `.github/workflows/` 下的 CI 配置文件，导致 Agent 在没有搜索网络时不敢修改 CI 脚本，陷入无代码变更的假死。

为了确保 MR 阶段异常能够被准确分类，并向用户和 Agent 提供精准指向 CI 配置文件与 Runner 版本的修复建议，需要对 MR 阶段的步骤归类、自愈 Prompt 及降级规则进行专项优化。

## What Changes

- **MR 阶段异常归类校正**：在 `src/agent-container.ts` 中将 MR 阶段的步骤明确设置为独立的 `step = 'mr'`，并将其异常分类映射为 `ci_pipeline`（或兼容系统的 CI 错误类别），严禁混淆为 `artifact_validation`。
- **针对 CI 与 Runner 故障的精准建议生成**：优化 `src/diagnostic-synthesizer.ts` 与前端降级逻辑，当错误日志或消息中检测到 `cancelled`、`macos-13`、`Runner`、`Actions` 或 `pipeline` 关键字时，输出精准指向 CI 文件的解决建议（例如：检查并更新 `.github/workflows/ci.yml` 中的构建矩阵，将已被下线的 `macos-13` 替换为 `macos-14`，或排查 CI 触发条件）。
- **强化 MR 阶段 Agent 自愈修复提示词**：在 `src/mr-service.ts` 与 `src/agent-container.ts` 中向 Agent 发送的修复提示词中，明确提示 Agent 故障原因可能是 CI 配置文件（如 `.github/workflows/ci.yml`）中的 Runner 标签或构建脚本过时，明确授权其审查与更新工作区中的 CI 配置文件。

## Capabilities

### New Capabilities
- `ci-diagnostic-guidance`: 定义持续集成与流水线异常时的精准分类与建议生成规范，确保针对 Runner 缺失、构建矩阵过时等故障给出准确指引。

### Modified Capabilities
- `github-integration`: 规范 MR 阶段 GitHub Actions 异常发生时的上下文提炼与针对 `.github/workflows/` 配置文件的自愈指导。

## Impact

- **诊断与错误分类**：`run_diagnostics.diagnostic` 中的 `category` 针对 MR 阶段准确反映为 CI 异常，前端不再显示 OpenSpec 规范文档错误提示。
- **自愈效率**：用户在受阻卡片中能直接获得修改 `.github/workflows/ci.yml` 的正确指引，Agent 在自愈修复时具备主动修改 CI 文件的明确指引。
