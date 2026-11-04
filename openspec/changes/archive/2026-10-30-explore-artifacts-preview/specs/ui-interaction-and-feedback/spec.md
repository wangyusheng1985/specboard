## ADDED Requirements

### Requirement: Explore Stage Process Artifact Generation and Collection
系统在 Explore 探索阶段 SHALL 支持 Agent 根据用户指令生成过程文件（如 Demo HTML、Markdown 调研总结、JSON 配置等），并在运行结束时自动收集为产物数组（`artifacts`）上传持久化。

#### Scenario: Agent creates demo html or summary markdown during exploration
- **WHEN** 用户在 Explore 阶段提出“生成一份 Demo HTML”或“写一份对比调研 markdown”要求，且 Agent 在工作区中写入对应文件时
- **THEN** 运行结束时系统 SHALL 自动检测并提取这些过程文件，构建包含文件相对路径与文本内容的 `artifacts` 列表。

### Requirement: Artifacts List and Interactive Preview in Task Detail
任务详情弹窗 SHALL 提供专门的“过程生成文件 / 阶段产物”卡片，清晰罗列各阶段产物，并提供无缝的富文本与沙箱内联交互预览。

#### Scenario: Listing generated artifacts
- **WHEN** 任务当前查看阶段存在已生成的产物文件时
- **THEN** 系统 SHALL 展示包含文件名称、大小与类型标识的文件卡片列表，并高亮可交互的操作项。

#### Scenario: Previewing HTML demo in secure sandbox
- **WHEN** 用户点击 `.html` 格式的过程文件卡片时
- **THEN** 系统 SHALL 在隔离的安全 iframe 沙箱容器中内联加载渲染该 HTML 页面，允许用户直接进行按钮点击、表单交互等原型体验，并支持全屏展开与在新窗口打开。

#### Scenario: Previewing Markdown summary document
- **WHEN** 用户点击 `.md` 格式的过程文件卡片时
- **THEN** 系统 SHALL 直接利用内置 Markdown 渲染引擎将其渲染为结构化排版（支持标题、列表、表格与图表），并提供内容复制功能。
