## Purpose
为 Specboard 研发协同平台提供结构化的任务受阻诊断生成与展示能力，通过 LLM 对执行失败、CI 阻碍或阶段校验未通过的深层原因进行提炼，输出清晰的三段式诊断数据模型（根因分析、人工介入建议列表、原始技术上下文），解决传统生硬报错信息失真、指引缺失及排障成本高昂的问题。

## ADDED Requirements

### Requirement: Structured Blocked Diagnostic Model
当任务在任意阶段（Explore / Propose / Apply / MR）执行受阻或耗尽自愈预算（`outcome_state === 'blocked'` 或产生终端受阻诊断）时，系统 SHALL 产出并持久化结构化的三段式诊断模型。

#### Scenario: Generating structured diagnostic on failure
- **WHEN** 任务运行失败、校验不通过或发生自愈中断时
- **THEN** 系统 SHALL 聚合错误上下文并调用 LLM 生成结构化诊断，包含以下必填分段：
  1. `analysis`（问题根因分析）：一段精炼的人类可读文本，说明为什么受阻；
  2. `suggestions`（人工介入指引）：至少包含一条以上具体、可行、可操作的解决步骤或操作建议数组；
  3. `rawTrace`（原始上下文）：保留发生异常时的原始日志、堆栈跟踪、关键退出码或 Job 信息。

#### Scenario: Graceful fallback when LLM is unavailable
- **WHEN** LLM 诊断合成因超时、鉴权失败或网络故障无法完成时
- **THEN** 系统 SHALL 自动平滑降级，将底层原始错误信息自动填充为默认根因说明，并生成基础的通用排查建议（如检查网络、检查凭证或查看原始日志），确保诊断模型结构完整且不阻塞界面展示。

### Requirement: Three-Section Diagnostic Presentation
前端详情抽屉在任务受阻时 SHALL 按照三段式结构直观清晰地呈现诊断卡片，严禁直接堆叠难以辨识的底层 JSON 或单一错误摘要。

#### Scenario: Section 1 - Root Cause Summary
- **WHEN** 用户查看受阻任务的诊断卡片时
- **THEN** 卡片首部 SHALL 醒目展示 LLM 提炼总结的问题原因（`analysis`），采用语义清晰的排版呈现，使用户快速掌握当前阻塞的核心矛盾。

#### Scenario: Section 2 - Actionable Remediation Suggestions
- **WHEN** 用户查看受阻任务的诊断卡片时
- **THEN** 卡片中部 SHALL 以编号列表呈现至少一条人工介入方法（`suggestions`），建议内容中涉及的文件路径、配置项或命令 SHALL 支持等宽代码块高亮展示。

#### Scenario: Section 3 - Raw Technical Context Accordion
- **WHEN** 用户查看受阻任务的诊断卡片时
- **THEN** 卡片底部 SHALL 提供默认折叠的原始错误信息与堆栈区块（Accordion），展开后使用等宽代码字体完整显示原始堆栈或 CI Job 失败日志，并提供“一键复制原始信息”操作。
