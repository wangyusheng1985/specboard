## Context

参考 `proposal.md`。在 MR 阶段的执行过程中，`src/agent-container.ts` 将步骤硬编码为 `step = 'validation'`，当 CI 失败时被异常捕获器直接判定为 `artifact_validation`（产物校验失败）。当触发降级逻辑时，系统盲目套用了纯文档阶段的静态建议（“检查 tasks.md 产物”），严重偏离了 CI 场景。此外，向 Agent 发送的修复提示词中未显式强调审查和修改 `.github/workflows/` 下的 CI 配置文件，导致 Agent 在没有外网搜索的情况下不敢修改 CI 脚本。

## Goals / Non-Goals

**Goals:**
- **校正步骤与错误分类**：将 MR 阶段的执行步骤从 `validation` 调整为 `mr`，默认异常分类调整为 `runtime_environment`，彻底隔离产物校验错误。
- **智能化 CI 降级建议**：在 `diagnostic-synthesizer.ts` 与前端 `diagnostic-presentation.js` 中建立基于 CI/Runner 关键词的定向建议规则，精准输出修改 `.github/workflows/` 构建矩阵或更新 Runner（如 `macos-13` ➔ `macos-14`）的具体建议。
- **强化 Agent 修复提示词**：在 `mr-service.ts` 的修复 Prompt 中显式授权并指引 Agent 审查和修改 CI 配置文件。

**Non-Goals:**
- 不改变既有的自愈轮数预算控制。
- 不影响 Explore/Propose/Apply 阶段对产物文档的正常校验。

## Decisions

### 1. 独立 MR 阶段执行步骤（Step）
- **选型**：在 `src/agent-container.ts` 中，MR 阶段设置 `step = 'mr'`；在全局 catch 块中，当 `step === 'mr'` 且没有指定类别时，默认为 `'runtime_environment'`，确保 `artifact_validation` 仅作用于真正的规范校验步骤。
- **理由**：各阶段职责解耦，消灭跨阶段错误分类污染。

### 2. CI/Runner 定向降级规则树
- **选型**：在 `buildHeuristicStructuredDiagnosis` 与 `normalizeStructuredDiagnosis` 中，检测到 `cancelled`、`macos-13`、`Runner`、`Actions`、`workflow` 或 `stage === 'MR'` 时，自动输出 CI 专属三段式建议：
  - 建议 1：检查并更新 `.github/workflows/` 下的流水线配置，将已淘汰的 Runner 标签（如 `macos-13`）升级为可用版本（如 `macos-14`）；
  - 建议 2：确认构建矩阵与依赖项配置符合云端 CI 环境规范；
  - 建议 3：在下方补充信息中说明已修改配置，触发重新提交。
- **理由**：即使用户网络离线或 LLM 熔断，也能呈现 100% 正确且能解决问题的操作建议。

### 3. Agent 提示词强化 CI 配置文件修改授权
- **选型**：在 `mr-service.ts` 的 `session.prompt` 中，明确加入：
  > `Please diagnose and modify the workspace files (including .github/workflows/*.yml or code) to fix this failure. If the failure indicates a runner or environment deprecation (e.g. macos-13), update the workflow configuration accordingly.`
- **理由**：消除 Agent 在缺乏外部搜索佐证时对修改 CI 配置文件的犹豫，引导其主动修复 Runner 版本。

## Risks / Trade-offs

- **[Risk] Agent 误改无关的 CI 配置** → **Mitigation**: 提示词严格限定针对失败的 Job 及 Runner 标签进行修正，且后续仍需通过云端流水线真实运行验证。
