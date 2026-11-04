## Context

参考 `proposal.md`。当前系统在任务执行受阻时，诊断卡片仅展示单行的 `message` 字段，且在 MR 阶段当 GitHub Actions 工作流因 Runner 缺失等被官方取消（`cancelled`）或超时（`timed_out`）时，Git 平台集成层未能命中这些非 `failure` 状态的 Job，导致关键排障上下文完全丢失，给出的错误为无意义的 `Actions failed on job unknown, but no code changes were made to fix it`。

同时，在代码推送后的流水线轮询实现中，初次发现阶段（Discovery）未校验流水线的 `head_sha`，也没有排除前一轮的失败 `pipeline.id`。由于云端 GitHub Actions 触发存在 1~3 秒时延，系统会在推送后立即命中上一轮已结束的旧 Run，导致刚修复推送的代码瞬间被判定为“已失败”，破坏自愈闭环。

用户缺乏由 LLM 提炼的业务语义根因分析与具体人工介入操作建议。为了从根本上改善执行受阻时的交互体验与排障效率，需要在架构上打通“精准异常捕获 ➔ 防竞态流水线发现 ➔ 服务端 LLM 结构化诊断提炼 ➔ 前端三段式分段呈现”的完整链路。

## Goals / Non-Goals

**Goals:**
- **全状态 CI 错误捕获**：修复 GitHub/GitLab 平台采集逻辑，覆盖 `failure`、`cancelled`、`timed_out` 等所有异常结束状态，保留真实 Job 名称与日志上下文。
- **初次流水线发现防竞态校验**：在 `mr-service.ts` 的初次发现逻辑中比对当前推送信标（`head_sha` 必须匹配当前推送 commit，或 `pipeline.id !== previousPipelineId`），确保轮询的是当前新代码触发的流水线。
- **结构化诊断数据模型**：在 `run_diagnostics` 负载中统一引入 `structured` 字段（包含 `analysis`、`suggestions` 数组、`rawTrace`）。
- **服务端智能提炼与稳健降级**：在任务执行受阻或自愈预算耗尽时，异步/同步调用内部 LLM 网关提炼三段式诊断，若 LLM 不可用则平滑降级为本地规则组装。
- **前端三段式高可读性卡片**：
  1. 第一部分：LLM 提炼总结的问题原因（语义高亮）；
  2. 第二部分：LLM 给出的人工介入与修复建议（>= 1 条结构化有序列表）；
  3. 第三部分：真实错误原始信息、Job 信息与堆栈等（折叠面板 + 一键复制）。

**Non-Goals:**
- 不改变既有的自愈预算状态机（仍保持 5 轮 / 30 分钟默认策略）与安全边界自动恢复流程。
- 不引入重型前端第三方 UI 框架（继续保持原生 ESM 与轻量 CSS 架构）。
- 不绕过用户的显式批准去自动修改项目远端仓储的 Actions / CI 配置。

## Decisions

### 1. 初次与再次流水线发现（Discovery）防竞态校验
- **选型**：
  - 在 `src/git-platform.ts` 的 `UnifiedPipeline` 接口中暴露 `sha?: string`；并在 `getLatestPipeline(branch, expectedSha?: string)` 中支持按目标 commit SHA 过滤。
  - 在 `src/mr-service.ts` 中，获取推送前的 HEAD commit SHA（`currentSha = await git(['rev-parse', 'HEAD'])`）以及上一次记录的 `previousPipelineId`（来自 `task_merge_requests.pipeline_id` 或参数）。
  - 在初次流水线发现（步骤 4）及修复重推阶段（步骤 6），轮询条件统一强化为：
    ```typescript
    while ((!pipeline || (expectedSha && pipeline.sha && pipeline.sha !== expectedSha) || (previousPipelineId && pipeline.id === previousPipelineId)) && (Date.now() - discoveryStart < discoveryTimeout)) {
      await new Promise(r => setTimeout(r, discoveryInterval));
      pipeline = await platform.getLatestPipeline(branch);
    }
    ```
- **理由**：彻底消除云端 Actions 触发的 1~3 秒时延漏洞，保证获取到的流水线一定是本次新 commit 对应的运行实例。

### 2. CI/Actions 异常状态提取全覆盖
- **选型**：在 `GitHubClient.getFailedJobLogs` 中，将只检索 `conclusion === 'failure'` 改为：
  ```typescript
  const failedJob = res.data.jobs.find(j => 
    ['failure', 'cancelled', 'timed_out', 'action_required', 'neutral'].includes(j.conclusion || '')
  );
  ```
  如果该 Job 没有日志（如排队未开始即被取消），则合成包含 Job 运行状态、耗时、Runner 标签与 GitHub 地址的诊断信息。
- **理由**：彻底解决 `macos-13` 等因 Runner 不可用超时取消导致的 `job unknown` 痛点。

### 3. 结构化诊断契约设计（向前兼容）
- **选型**：在现有的 `RunDiagnostic` 接口中增加可选的 `structured?: StructuredDiagnosis` 字段：
  ```typescript
  export interface StructuredDiagnosis {
    analysis: string;       // LLM 提炼的根因总结
    suggestions: string[];  // 人工介入与解决建议列表
    rawTrace: string;       // 原始错误上下文与堆栈
  }
  ```
- **理由**：现有的 `message`、`category`、`impact` 等字段继续保留作为通用摘要，现有的 API 调用方与历史存储记录无需迁移，完全向后兼容；前端优先渲染 `structured`，若不存在则优雅适配提取默认三段结构。

### 4. LLM 结构化诊断提炼服务（Diagnostic Synthesizer）
- **选型**：新增诊断合成模块（`src/diagnostic-synthesizer.ts`），复用系统已配置的 `LLMGateway`。
  - Prompt 设定专门的系统提示词，要求输出标准 JSON，包含 `analysis`、`suggestions`（字符串数组，至少一条）以及关键排查点；
  - 设置较短的调用超时（8-10 秒）与严格的 try/catch 兜底逻辑；
  - 若 LLM 响应不可用，执行纯前端/服务端的 Heuristic Fallback（根据错误关键词生成默认建议，并将原始堆栈填入 `rawTrace`）。
- **理由**：解耦执行引擎与大模型诊断逻辑，确保诊断合成绝不会反向卡死主任务流程。

### 5. 前端卡片视觉排版与交互体验
- **选型**：
  - 红色警示卡片保留警示调性，但主体区域采用模块化卡片（Card Sectioning）；
  - 第一部分（根因）：清晰加粗导读，重点呈现为什么失败；
  - 第二部分（建议）：采用精致图标徽标数字引导列表，代码段使用浅色内联代码底色；
  - 第三部分（原始日志）：原生 `<details>` / `<summary>` 配合优雅动画，默认折叠避免视觉轰炸，展开后附带顶部浮动“复制”按钮。
- **理由**：兼顾普通用户（关心怎么解决）与高级研发/运维（关心原始堆栈与错误明细）的双重视角。

## Risks / Trade-offs

- **[Risk] GitHub Actions 延迟过大超过 discoveryTimeout（45s）** → **Mitigation**: 保持 45 秒弹性超时，并在超时明确提示“Actions 未在 45 秒内触发”，而非静默退化为旧流水线。
- **[Risk] LLM 网关网络抖动或超时导致诊断阻塞** → **Mitigation**: 诊断合成设置 8 秒严格超时，失败时立即退化为本地模板生成，绝不延迟或阻塞主任务状态更新。
- **[Risk] 原始错误 Trace 内容过长导致数据库膨胀或前端渲染卡顿** → **Mitigation**: 原始 Trace 入库与前端展示前统一截断保留最具价值的头部与尾部各 4KB，并提示已被截断。
- **[Risk] 历史任务诊断没有 structured 字段** → **Mitigation**: 前端 `diagnostic-presentation.js` 提供自动降级解析器，自动将旧的 `message` 划入第一部分，生成默认第二部分（查看详情），将 `details` 划入第三部分。
