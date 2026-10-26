## Context

参见 `proposal.md`。虽然系统已接入 GitHub，但前端 `public/app.js` 中的部分状态函数、重置逻辑及 Agent 容器完成时的 Summary 仍存在偏向 GitLab 的硬编码文案。

## Goals / Non-Goals

**Goals:**
- **全局文案平台中立与自适应**：
  - 新建/重置项目表单时，标题统一为“添加代码仓库（GitHub / GitLab）”；
  - 编辑项目表单时，标题根据 `repository_url` 动态判断显示“编辑 GitHub 项目”或“编辑 GitLab 项目”；
  - 创建任务拦截未配置项目时，提示“请先配置一个代码仓库（GitHub / GitLab）”；
  - 任务 MR 阶段运行完成的 Summary 文本根据平台自适应输出 PR 或 MR 描述。
- **阶段验证检查项通用化**：
  - `src/stage-verification.ts` 中 MR 阶段检查项采用中立的描述（如 `Code review request (MR/PR) verified and pipeline passed`）。

**Non-Goals:**
- 不修改底层 API 契约或数据库结构。

## Decisions

### 1. 前端表单标题的动态自适应函数
- **决策**：在 `public/app.js` 中建立统一的判定辅助函数或在渲染编辑表单时依据 `p.repositoryUrl`（或 `p.repository_url`）判定：
  ```javascript
  const isGh = p.repositoryUrl && p.repositoryUrl.includes('github.com');
  $('#project-form-title').textContent = isGh ? '编辑 GitHub 项目' : '编辑 GitLab 项目';
  ```
  而在 `resetProjectForm` 中：
  ```javascript
  $('#project-form-title').textContent = '添加代码仓库（GitHub / GitLab）';
  ```

### 2. 运行时 Agent 阶段 Summary 自适应
- **决策**：在 `src/agent-container.ts` 中，利用已经获取的 `mrResult.mr.is_pr`：
  ```typescript
  const prOrMr = mrResult.mr.is_pr ? `GitHub Pull Request #${mrResult.mr.iid}` : `GitLab Merge Request !${mrResult.mr.iid}`;
  const ciOrActions = mrResult.mr.is_pr ? 'Actions' : 'CI pipeline';
  summary: `${prOrMr} created and ${ciOrActions} passed.`
  ```

## Risks / Trade-offs

- **[Risk] 现有基于固定字符串断言的测试可能失败**
  → **Mitigation**：排查 `test/stage-verification.test.ts` 及运行时测试，保持断言或正则表达式的宽容度匹配。
