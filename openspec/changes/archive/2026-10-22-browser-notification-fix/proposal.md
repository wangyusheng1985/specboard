## Why

用户反馈开启了系统浏览器通知功能，但日常使用中从未收到过任何系统通知。经全链路代码与数据排查，定位到以下关键问题：

1. **后端数据缺陷**：`/api/v1/lane` 接口查询任务时，未对结果调用 `projectOutcome(row)` 进行语义状态派生，导致前端轮询到的很多任务的 `outcome_state` 字段为 null，无法匹配到通知触发条件；
2. **阶段白名单遗漏**：`public/notifications.js` 中的 `STAGES` 仍硬编码为 4 个阶段（`['Explore','Propose','Apply','Archive']`），遗漏了核心的 `MR` 阶段，导致在 MR 阶段的任务状态变更被直接忽略；
3. **缺乏连通性验证与测试通知**：用户点击“启用通知”并授予权限后，系统未发送任何即时测试通知，用户无法确认浏览器甚至操作系统通知中心（如 macOS 勿扰模式、Chrome 系统通知权限）是否真正放行通知；
4. **通知图标格式兼容性**：通知使用了 `/favicon.svg`，部分桌面操作系统（如特定版本的 macOS / Windows Chrome）对 SVG 格式通知图标支持不良甚至丢弃弹窗。

需要系统性修复此缺陷，并提供即时测试与端到端健康确认能力。

## What Changes

- **后端 `/api/v1/lane` 补充状态派生**：
  - 在返回 lane items 时，为每一行任务数据显式调用 `projectOutcome(row)`，确保返回前端的任务对象拥有最新的 `outcome_state`，与单任务详情接口行为保持完全一致。
- **前端 `notifications.js` 适配全阶段与通知类型补齐**：
  - 将 `STAGES` 扩充为完整的 5 阶段：`['Explore', 'Propose', 'Apply', 'MR', 'Archive']`；
  - 覆盖在 `MR` 阶段下需要用户处理的通知（如 MR 阶段完成待归档、或 MR 异常受阻）；
  - 将通知图标切换为兼容性更好的 PNG 资源（`/apple-touch-icon.png`）。
- **新增“启用通知即发送欢迎测试通知”与自检链路**：
  - 当用户在浏览器中成功授予通知权限并开启时，立即发送一条轻量的确认通知：“Specboard · 通知已成功启用 - 当任务需要回答、方案待确认或交付完成时将在这里提醒你”；
  - 在通知按钮悬停或设置中提供“发送测试通知”入口，帮助用户一键验证当前浏览器和操作系统通知通道是否畅通。
- **后台标签页保活提醒强化**：
  - 优化 `observeTasks` 中的通知分发逻辑，无论当前标签页处于前台还是后台，均确保关键状态（待回答、方案待确认、执行受阻、交付待审阅）能够可靠触发系统通知。

## Capabilities

### New Capabilities
- `browser-notifications`: 为 Specboard 任务生命周期提供准确的浏览器系统级通知派发、全阶段覆盖（含 MR）、权限即时测试与系统兼容性保障。

### Modified Capabilities
<!-- 本次不修改已有规范契约 -->

## Impact

- **后端服务**：
  - `src/runtime-api.ts`：在 `/api/v1/lane` 路由处理器中引入 `projectOutcome` 并为每条任务补齐 `outcome_state` 派生。
- **前端通知模块与界面**：
  - `public/notifications.js`：更新阶段定义，补充 PNG 图标，提供测试通知派发方法；
  - `public/app.js`：在用户成功开启通知后触发一次即时验证通知，在通知按钮右侧或工具提示中提供测试触发支持。
