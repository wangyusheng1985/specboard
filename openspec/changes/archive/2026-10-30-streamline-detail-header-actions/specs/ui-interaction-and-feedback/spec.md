## ADDED Requirements

### Requirement: Task Detail Header Action Controls
任务详情弹窗 SHALL 移除占用大量纵向空间的独立“阶段流程”步骤条卡片与“任务操作”卡片，改为在详情头部（`.drawer-head`）右侧集成两个具备自适应 SVG 图标与状态感知能力的语义操作按钮。

#### Scenario: Displaying stop and primary advance buttons in detail header
- **WHEN** 用户打开任务详情弹窗时
- **THEN** 弹窗内容区顶部不再显示独立“阶段流程”大卡片与“任务操作”卡片；而在头部右上侧（关闭按钮左侧）展示“停止”与“主推进/确认”两个矢量 SVG 按钮。

#### Scenario: Dynamic primary button state reflection
- **WHEN** 任务处于不同生命周期（如 Explore 完成等待推进、Propose 方案待审批、Apply 运行中、执行受阻时）
- **THEN** 主操作按钮的 SVG 图标、文案和交互逻辑 SHALL 动态对齐：在方案待审批时呈现“确认方案并开始执行”（勾选图标）、在执行受阻时呈现“重试当前阶段”（重试图标）、在可推进时呈现“进入下一阶段”（推进箭头）。

#### Scenario: Stop button availability
- **WHEN** 任务处于后台执行中（`running`）或等待输入（`waiting_input`）状态时
- **THEN** 停止按钮处于可用激活态（点击可触发终止当前执行）；当任务处于未激活状态时，停止按钮保持禁用或静默状态，杜绝无效点击。

### Requirement: Compact Task Meta Header Integration
任务所属项目、阶段与执行状态 SHALL 在详情头部整合为紧凑的一体化信息条，不再分散展示。

#### Scenario: Header status rendering
- **WHEN** 任务详情更新数据时
- **THEN** 头部项目名称右侧 SHALL 展示包含当前阶段与状态的紧凑 Badge（例如 `Explore · 执行中` 或 `Propose · 方案待确认`），让用户无需向下滚动即可获知任务当前核心进展。
