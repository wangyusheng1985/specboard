## Why

在引入 GitHub 支持后，系统虽然在 HTML 初始模板中支持了 GitHub 与 GitLab 双平台，但在客户端脚本 `public/app.js`、`src/agent-container.ts`、`src/stage-verification.ts` 及部分后端报错信息中，依然存在硬编码的“GitLab 项目”、“添加 GitLab 项目”或“编辑 GitLab 项目”等特定平台的遗留术语。

当用户在界面中点击“+ 新增项目”或“重置”时，表单标题会被 JS 覆盖重置为“添加 GitLab 项目”；在未配置项目时点击“创建任务”，也会弹出“请先配置一个 GitLab 项目”的报错提示。这种术语不一致会给使用 GitHub 仓库的用户带来困惑和误导。需要全面排查前端交互、Agent 容器及阶段校验中的遗留文案，统一采用平台中立的表达（如“代码仓库”、“GitHub / GitLab 项目”）。

## What Changes

本变更对整个前端及相关运行时中的代码托管平台文案进行中立化重构与自适应统一：

- **前端交互重构 (`public/app.js`)**：
  - 将 `resetProjectForm` 中的表单标题从硬编码的 `'添加 GitLab 项目'` 统一改为 `'添加代码仓库（GitHub / GitLab）'`。
  - 将编辑项目时的表单标题从 `'编辑 GitLab 项目'` 统一改为 `'编辑项目配置'` 或动态识别 `'编辑 ${platform} 项目'`。
  - 将“创建任务”在无项目时的前置校验报错从 `'请先配置一个 GitLab 项目'` 统一改为 `'请先配置一个代码仓库（GitHub / GitLab）'`。
- **Agent 容器与阶段验证中立化 (`src/agent-container.ts`, `src/stage-verification.ts`)**：
  - `src/agent-container.ts`：将 MR 阶段完成时的摘要描述从硬编码的 `GitLab Merge Request !${mrResult.mr.iid} created and CI pipeline passed.` 改为根据 `mrResult.mr.is_pr` 动态输出 `GitHub Pull Request #${mrResult.mr.iid} created and Actions passed.` 或 `GitLab Merge Request !${mrResult.mr.iid} created and CI pipeline passed.`。
  - `src/stage-verification.ts`：在 MR 阶段的校验检查项文本中，使用通用平台术语，如 `'Code review request (MR/PR) verified and pipeline passed'`。
- **全局遗留报错检查 (`src/workspaces.ts`, `src/app.ts`)**：
  - 检查并兼容错误信息（如提示 `Repository host must be configured in GIT_ALLOWED_HOSTS`）。

## Capabilities

### New Capabilities
<!-- 无新增功能集 -->

### Modified Capabilities
- `github-integration`: 扩展 GitHub 集成规范中的 UI 提示自适应与文案中立性要求，确保表单重置、编辑、前置校验及阶段完成摘要不会退化为仅提示 GitLab。

## Impact

- **前端文件**：
  - `public/app.js`：修复表单重置和编辑标题、更新未配置项目时的报错提示。
- **服务端与运行时**：
  - `src/agent-container.ts`：动态适配运行摘要输出。
  - `src/stage-verification.ts`：规范阶段验证提示词。
- **测试**：
  - 更新相关单测以匹配更中立的错误或验证文本。
