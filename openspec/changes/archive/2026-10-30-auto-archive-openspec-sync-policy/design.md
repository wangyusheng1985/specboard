## Context

参考 `proposal.md`。OpenSpec 的 `archive-change` 默认工作流在检测到任务变更包含 Delta Specs 时，会停顿并通过 `request_clarification` 询问用户是“Sync now”还是“Archive without syncing”。由于绝大多数用户仓库并未在主分支上跟踪维护 `openspec/specs` 全局规范目录，这一交互完全是多余的，导致归档操作停滞等待数十分钟。

## Goals / Non-Goals

**Goals:**
- 在 `src/agent-container.ts` 中检测目标仓库主分支是否跟踪 `openspec/specs`（`git cat-file -e origin/<defaultBranch>:openspec/specs`）。
- 将该状态注入 Archive 阶段的 System Prompt 指示：
  - 如果未跟踪 `openspec/specs`，明确指示 Agent：“*Remote project does not maintain openspec/specs. Do NOT ask user whether to sync specs; directly proceed with 'Archive without syncing' (move change to openspec/changes/archive/) autonomously without calling request_clarification.*”；
  - 如果已跟踪 `openspec/specs`，指示 Agent 自动执行规约同步后归档，无需人工交互。
- 确保整个归档流程在 10~30 秒内全自动闭环。

**Non-Goals:**
- 不破坏 OpenSpec 变更归档到 `openspec/changes/archive/` 的目录结构与校验规范。

## Decisions

### 1. 仓库基线探测与明确授权指令注入
- **选型**：在 `agent-container.ts` 执行 Archive 阶段时，通过 Git 命令检查：
  ```typescript
  let remoteTracksSpecs = false;
  if (project) {
    try {
      await git(['cat-file', '-e', `origin/${project.default_branch}:openspec/specs`], cwd);
      remoteTracksSpecs = true;
    } catch {
      remoteTracksSpecs = false;
    }
  }
  ```
  在 `appendSystemPromptOverride` 中加入专为 Archive 阶段定制的指令：
  若 `!remoteTracksSpecs`，声明：
  > `For Archive stage: The remote repository DOES NOT track openspec/specs. You MUST NOT call request_clarification to ask whether to sync specs. You are required to directly select 'Archive without syncing' (move the change directly into openspec/changes/archive/<date>-task-<id>/) and complete the archive stage immediately.`
- **理由**：直接在上游系统提示词中给予强约束，拦截 OpenSpec 内置模板的提问冲动，保持纯净的自动化流转。

## Risks / Trade-offs

- **[Risk] 用户原本期望合入主规范但主分支尚未初始化 specs 目录** → **Mitigation**: 绝大多数项目本来就不希望在业务主分支提交 openspec 文档（mr-service 甚至默认 sanitize 排除 openspec），只有显式维护了 `openspec/specs` 的项目才会同步，符合绝大多数项目的期望与最佳实践。
