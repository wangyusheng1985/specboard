## Why

当 Specboard 任务在各阶段（尤其是 MR/Apply 阶段）因为 CI 流水线异常、环境依赖缺失或规则校验等原因执行受阻时，现有的诊断卡片往往呈现为单一、生硬的异常字符串（例如：`Actions failed on job unknown, but no code changes were made to fix it`），甚至因底层 Job 状态采集盲区（如未匹配 `cancelled`/`timed_out`）导致关键错误上下文丢失。

同时，在 MR 阶段的流水线轮询实现中，由于缺乏初次发现阶段对 Commit SHA 的比对或对历史旧流水线 ID 的排除，当用户在评论区发送人工介入建议并由 Agent 修复推送后，系统容易因云端流水线触发延迟（1~3秒）而瞬间误捕获上一轮已失败的旧流水线，导致修复流程直接发生伪失败。

这导致三个核心痛点：
1. **用户无法理解受阻根因**：没有经过 LLM 提炼的高层语义解释，缺乏业务与工程语境；
2. **缺乏具体可执行的人工介入指引**：用户不知道如何在工作区或上游修复（例如修改 CI 配置、更新 Runner 版本、补全依赖）；
3. **技术排障信息混杂缺失且自愈易受旧流水线干扰**：缺少对原始堆栈、真实 Job 日志与上下文的清晰分区与折叠展示，且重推后缺乏防竞态穿透保障。

为了提供清晰、结构化且具备强指导性的人工干预体验，需要对执行受阻的诊断卡片及流水线发现修复逻辑进行全流程重构。

## What Changes

- **CI/Actions 异常捕获全覆盖**：增强 Git 平台集成层（GitHub/GitLab），捕获包括 `cancelled`、`timed_out`、`failure` 在内的所有失败/异常 Job，保留真实 Job 名称与失败日志，彻底消除 `job unknown` 现象。
- **初次流水线发现（Discovery）防竞态校验**：修复 `src/mr-service.ts` 在推送分支后的初次流水线发现逻辑，增加针对当前推送 Commit SHA（`head_sha`）的强校验（或明确排除前一轮的 `previousPipelineId`），确保系统必须等待并轮询由当前新 Commit 触发的全新流水线，杜绝误抓旧失败流水线。
- **服务端 LLM 智能诊断合成**：当任务执行受阻（`outcome_state === 'blocked'` 或产生终端受阻诊断）时，由服务端通过 LLM 网关对底层错误原始日志、工作区状态与执行步骤进行智能归因提炼，生成结构化的三段式诊断模型：
  1. **问题根因分析（Root Cause）**：以清晰人类语言阐述为什么失败、产生了什么阻碍；
  2. **人工介入建议（Remediation Guidance）**：提供至少一条以上清晰、具体、可操作的解决方案与介入步骤；
  3. **原始错误证据（Raw Technical Context）**：保留原始 Job Trace、堆栈、异常退出码与关联上下文。
- **前端受阻卡片三段式视觉重构**：
  - **第一部分（根因总结）**：采用醒目重点样式展示 LLM 提炼的问题原因；
  - **第二部分（修复方案建议）**：列表呈现可执行的人工介入建议，支持步骤高亮；
  - **第三部分（原始日志/堆栈）**：采用等宽字体与折叠面板（Accordion）展示原始错误信息，支持一键复制，避免界面冗长同时保留排障细节。
- **回退与平滑降级**：若未配置 LLM 或 LLM 诊断生成失败，系统自动平滑降级为根据原始错误消息直接填充三段式结构，确保诊断始终可用。

## Capabilities

### New Capabilities
- `structured-blocked-diagnostics`: 定义任务执行受阻时的结构化诊断模型（包含 LLM 根因提炼、人工介入建议列表、原始技术日志与堆栈）及其前端三段式呈现规范。

### Modified Capabilities
- `ui-interaction-and-feedback`: 更新任务受阻时详情抽屉诊断卡片的交互规范，支持三段式内容排版与原始堆栈折叠面板。
- `github-integration`: 扩展 GitHub CI 运行状态监听，确保覆盖 `cancelled` 与 `timed_out` 等非正常结束的 Job Trace 提取，并在流水线发现阶段增加 Commit SHA 校验，防止读取历史失败流水线。

## Impact

- **数据层与 API**：`run_diagnostics` 表及其 API 响应中的 `diagnostic` 负载支持结构化扩展字段（`analysis`、`suggestions`、`rawTrace` 等），保持向前兼容；`task_merge_requests` 支持记录最新有效流水线信息。
- **后端服务**：
  - `src/mr-service.ts`：增加初次发现流水线时的 `head_sha` 比对与前序流水线 ID 过滤，防止竞态穿透。
  - `src/github-client.ts`、`src/git-platform.ts`：修复 Job 失败状态识别与追踪提取，并在 pipeline 对象中透传 `head_sha`。
  - 新增/扩展诊断分析服务（`src/diagnostic-service.ts` 或现有 service），在受阻时调用 LLM Gateway 提炼结构化诊断。
- **前端代码与样式**：
  - `public/diagnostic-presentation.js` 与 `public/app.js`：适配三段式诊断数据渲染与复制逻辑。
  - `public/style.css`：新增三段式诊断卡片的卡片分区、建议列表项与原始堆栈代码折叠样式。
