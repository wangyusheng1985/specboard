## Purpose
为 Specboard 研发协同平台提供持续集成（CI）与流水线运行异常时的精准错误归类与修复指引能力，消除因阶段步骤误设导致的产物校验误报，确保针对 Runner 缺失、构建超时或构建矩阵过时等故障给出明确针对 CI 配置文件的解决建议。

## ADDED Requirements

### Requirement: Accurate CI Pipeline Error Classification
当任务在 MR 或 CI 执行阶段发生异常、被取消或超时时，系统 SHALL 将其错误分类明确标记为与持续集成相关的类别（如 `runtime_environment` 或 `unknown`），严禁标记为规划阶段的产物校验失败（`artifact_validation`）。

#### Scenario: MR stage failure classification
- **WHEN** 任务处于 `MR` 阶段且流水线未通过或未产生代码变更时
- **THEN** 诊断系统的 `step` SHALL 标记为 `mr`，且其 `category` SHALL 保持为反映执行环境或流水线的类别，不得退化为 `artifact_validation`。

### Requirement: Targeted CI and Runner Remediation Guidance
当流水线失败涉及 Runner 标签不可用、下线淘汰或执行超时被取消时，系统（包括本地启发式降级与大模型提炼）SHALL 生成明确指向流水线配置文件与 Runner 版本的修复建议。

#### Scenario: Guidance for cancelled runner or workflow failure
- **WHEN** 诊断错误日志或上下文包含 `cancelled`、`macos-13`、`Runner` 或 `Actions failed` 关键字时
- **THEN** 诊断系统输出的 `suggestions` 数组中 SHALL 包含至少一条直接建议审查与修改 `.github/workflows/`（或对应 CI 配置）构建矩阵与 Runner 版本的操作建议，严禁提示检查 OpenSpec 规划文档。
