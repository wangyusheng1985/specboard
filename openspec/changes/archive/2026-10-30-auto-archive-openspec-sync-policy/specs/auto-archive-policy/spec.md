## Purpose
为 Specboard 研发协同平台提供自动化的任务归档与规约同步决策能力，根据项目代码仓是否跟踪维护全局 OpenSpec 规约（`openspec/specs`）自动选择规约合并或直接归档策略，彻底消除归档阶段多余的单选弹窗与数十分钟的人工确认停滞。

## ADDED Requirements

### Requirement: Autonomous Archive Spec Sync Decision
当任务进入 `Archive`（归档）阶段时，系统 SHALL 根据目标仓库基线是否维护 `openspec/specs` 自动决定是否同步规范，严禁中断执行向用户弹出提问。

#### Scenario: Archiving a repository without tracked specs
- **WHEN** 任务进入 `Archive` 阶段且项目远端默认分支未跟踪 `openspec/specs` 目录时
- **THEN** 系统 Agent SHALL 自动选用 `archive without syncing` 策略，直接将变更移入 `openspec/changes/archive/` 完成归档，不得调用 `request_clarification` 询问用户。

#### Scenario: Archiving a repository with tracked specs
- **WHEN** 任务进入 `Archive` 阶段且项目远端默认分支已跟踪 `openspec/specs` 目录时
- **THEN** 系统 Agent SHALL 自动执行 Delta Specs 向上合并至全局规约目录并完成归档，保持主规范持续更新，无需人工介入确认。
