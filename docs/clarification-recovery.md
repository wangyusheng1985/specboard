# 澄清交互发布与恢复

## 状态与屏障

`running -> waiting_input -> awaiting_answers -> queued(new generation)`。

发布问题后，旧运行仍持有租约；Agent 必须先完成工具结果记录、停止后续工具、同步 session 文件，再调用 clarification-ready。答案可在 ready 前提交，但只保存，不调度。ready 和提交在任务事务锁下汇合，仅创建一个续接运行。普通阶段完成仍使用既有 completed 运行及 waiting_input 任务，不能据此推断存在待答问题。

## 发布

先运行增量 PostgreSQL 迁移并发布兼容 API，再更新 Agent 和 Web。主机不上传源码，仅发布镜像。保留数据库、sessions 和 workspaces 卷。默认开启澄清；`CLARIFICATIONS_ENABLED=false` 仅禁止产生新问题，不阻止已有问题读取、回答和续接。

发布验收必须覆盖：四类问题、草稿刷新恢复、答案/ready 两种顺序与并发、重复提交、旧 generation 拒绝、同阶段持久化会话及移动端交互。不能用普通文本输出代替工具协议验收。

## 故障处理

- ready 前失联：保留问题与答案，运行标为 interrupted；不得伪造 ready。检查 session 工具结果是否完整、工作区是否仍被旧容器写入，以及危险操作结果；不能确定时保持暂停，人工处理。
- 已 ready、未回答：保留 awaiting_answers，不重启模型。
- 已接受答案、未消费：依据唯一 continuation_run 恢复该运行，不能重新提交另一批答案绕过。
- 消费中崩溃：核对会话中的 clarification 批次标记，已经写入的回答不再次追加。任何外部工具副作用不明确时转人工处理。
- 草稿冲突：保留当前输入并提示，不静默覆盖其他标签保存的数据。

## 回滚

1. 设置 CLARIFICATIONS_ENABLED=false 并重建 API，阻止新批次。
2. 保持兼容 API/Agent，完成现有 pending/submitted 批次，或由用户显式停止任务使批次失效。
3. 确认不存在待消费批次后，才能回退旧运行组件。保留新增数据表、会话和卷，禁止 down -v。
4. 回滚后核对阶段、运行、问答历史及工作区，无待答任务被误标成功。

## 本地验收证据

- `test/clarification-e2e.test.ts`：真实 PostgreSQL/API/Gateway/Agent 容器，Propose 两题提交、重复提交、容器重启、工具生成文件和阶段校验；关闭新提问开关后仍可提交并消费已有批次。
- `test/agent-container.test.ts`：会话写入后消费接口故障，容器退出重启后恢复；确认回答在会话中只出现一次，故障期间未生成产物。
- `test/agent-runtime.test.ts`：未确认工具调用导致恢复停止，不自动重放。
- `test/clarification-api.test.ts`：ready 前失联、两种屏障顺序及并发、旧代次拒绝、停止失效、增量迁移和事务回滚。

运行命令：`TEST_DATABASE_URL=<local database> TEST_AGENT_CONTAINER=true npm run coverage`。上游模型为可控协议夹具，本地演练不代表生产模型质量或真实外部副作用的 exactly-once 保证。未执行测试服务器部署或服务器版本回退；回滚演练覆盖关闭新能力后已有待答数据继续恢复的兼容路径。
