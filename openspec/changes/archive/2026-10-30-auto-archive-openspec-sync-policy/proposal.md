## Why

目前系统在进入 `Archive`（归档）阶段时，默认执行内置的 OpenSpec archive-change 流程。该流程遇到任务包含 delta specs 时，会自动调用 `request_clarification` 提问用户：*“是否将 Delta Specs 同步合并至 Main Specs？”*，导致任务在界面上暂停挂起长达数十分钟等待用户点击。

实际上，绝大多数代码仓库并没有在主分支中跟踪维护全局规约目录（`openspec/specs/`）。强制用户在归档时做额外交互极大地破坏了自动化归档体验。

为了消除多余的人工交互，系统需要在 Archive 阶段自动判断项目原始状态：
- 若用户代码仓默认分支本身**没有跟踪维护** `openspec` 规约目录（或者主分支不存在 `openspec/specs`），则归档时**默认无需合入全局主规约目录**，直接执行纯归档（`archive without syncing`），绝不打断用户；
- 仅当远端项目原本就已建立并跟踪了 `openspec/specs` 全局规约时，才合入主规约；
- 整个过程自动决策，消除归档阻塞。

## What Changes

- **Archive 阶段规范同步策略自动化**：在 `src/agent-container.ts`（及相关的 stage verification/agent prompt 逻辑）中，为 Archive 阶段注入自动化的规范同步指示：
  - 启动 Archive Agent 前，预先检查代码仓远端默认分支（`origin/<defaultBranch>`）是否跟踪了 `openspec/specs`；
  - 若未跟踪 `openspec/specs`，指示 Agent 在执行归档时直接跳过同步（无需向用户提问，直接选用 `archive_without_syncing` 策略将变更移动至 `openspec/changes/archive/`）；
  - 若已跟踪 `openspec/specs`，则自动执行同步并合入全局规范。
- **免人工打断保障**：在 Archive 阶段禁止调用 `request_clarification` 弹出单纯的“是否同步规范”选择题，系统根据代码仓基线状态自动完成决策。

## Capabilities

### New Capabilities
- `auto-archive-policy`: 定义任务归档时的规范同步自动判断与免交互决策模型，确保无规约项目实现零交互瞬时归档。

## Impact

- **运行时 Agent 行为**：`src/agent-container.ts` 在 Archive 阶段自动提供策略引导，Agent 执行归档时直接在 30 秒内自动完成，不再挂起等待用户点击。
- **用户交互体验**：用户点击“手动归档”后，任务无缝流动至已归档状态（`archived`），彻底杜绝数十分钟的停滞等待。
