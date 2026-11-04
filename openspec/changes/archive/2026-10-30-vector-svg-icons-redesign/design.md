## Context

详见 `proposal.md` - Why。当前系统主要在顶部导航、详情抽屉等区域实现了统一线宽的矢量 SVG 图标，但在会话模式（Chat Mode）的快捷建议卡片、深度思考卡片、工具调用执行流、项目上下文下拉框及产物弹窗等处，仍混杂使用了原生 Emoji 字符。

这种混用导致不同操作系统（如 macOS vs Windows vs Linux）和浏览器中字体回退呈现各异，且原生 Emoji 彩色外观与平台的工程克制风格不相符。

## Goals / Non-Goals

**Goals:**
- 全面清查并彻底剔除前端所有组件中的原生 Emoji 字符，替换为高度贴切的专业级矢量 SVG 图标。
- 为不同功能语义设计精准的几何 SVG 图标：
  - **架构分析**：采用分层架构/系统层次图标（Layers/Hierarchy SVG）。
  - **代码事实排查**：采用代码探查/代码放大镜图标（Code Inspection SVG）。
  - **联网检索**：采用全球网络/经纬网格地球图标（Globe Wireframe SVG）。
  - **生成原型**：采用原型交互设计/窗口画板图标（Component Layout/Sparkle Prototype SVG）。
  - **深度思考**：采用智力推演/灵感脑波图标（Brain / Spark Pulse SVG）。
  - **工具执行**：区分代码终端（Terminal）、外部网络（Globe）、网页抓取（Compass/File）、文件写入（File Edit）。
  - **通用上下文与项目上下文**：区分全球通用徽标与代码仓库目录徽标。
  - **产物复制**：统一为标准轻量双层剪贴板矢量 SVG 图标。
- 保证所有内联 SVG 图标线宽、视口尺寸、`currentColor` 适配与无障碍属性（`aria-hidden="true"`）严格标准化。

**Non-Goals:**
- 不引入外部大型图标字体库（如 FontAwesome、MaterialIcons 等第三方打包包），保持零额外网络依赖与零运行时体积膨胀。
- 不修改现有的业务逻辑、数据接口或服务端状态机。

## Decisions

### 1. 采用统一辅助函数与内联 SVG 模板生成

**决策**：
在 `public/app.js` 或共享工具中封装高频使用的矢量 SVG 图标生成辅助函数（如 `createSvgIcon(name, className, size)`），或在模板中内联标准化 SVG 标签。所有图标统一采用：
- `viewBox="0 0 16 16"` 或 `viewBox="0 0 24 24"`
- `fill="none"`
- `stroke="currentColor"`
- `stroke-width="1.8"`
- `stroke-linecap="round"`
- `stroke-linejoin="round"`
- `aria-hidden="true"`

**考虑过的替代方案**：
- *引入外部 SVG Sprite 文件*：需要额外的 HTTP 请求或打包配置，且对动态创建 DOM 节点的样式继承不够灵活，因此采用内联精简 SVG 代码更为敏捷直接。

### 2. 替代原生 Emoji 的语义映射表

| 场景 | 原 Emoji | 新矢量 SVG 设计语义 | 视觉参数 |
| :--- | :--- | :--- | :--- |
| **快捷提示：架构分析** | 🏛️ | 分层架构卡片（Layers 堆叠方块） | 16x16, 描边 |
| **快捷提示：代码事实排查** | 🔍 | 代码检索镜（代码括号与放大镜组合） | 16x16, 描边 |
| **快捷提示：联网搜索** | 🌐 | 经纬地球网格（Globe Meridian） | 16x16, 描边 |
| **快捷提示：生成原型** | ⚡ | 原型画板与组件框（Wireframe Component） | 16x16, 描边 |
| **思考卡片：深度思考** | 💭 | 灵感思维脉冲（Brain / Neural Pulse） | 14x14, 描边 |
| **工具卡片：工具执行总括** | 🛠️ | 智能体齿轮工具（Wrench & Cog） | 14x14, 描边 |
| **工具卡片：代码探索** | 💻 | 代码终端命令行（Terminal Prompt） | 12x12, 描边 |
| **工具卡片：网页深度阅读** | 🌐 | 网页文档罗盘/外部阅读（File Text External） | 12x12, 描边 |
| **工具卡片：生成工作区文件** | 📝 | 文件铅笔写入（File Pen） | 12x12, 描边 |
| **项目选择：通用对话** | 🌐 | 全球网络微图标 | 12x12, 描边 |
| **项目选择：代码项目** | 📦 | Git 代码仓库文件夹微图标 | 12x12, 描边 |
| **弹窗操作：复制内容** | 📋 | 规整双层剪贴板（Clipboard Copy） | 14x14, 描边 |

## Risks / Trade-offs

- **[Risk] 部分动态渲染文字（如 `option` 元素内部）不支持嵌套 HTML SVG 节点**
  - **Mitigation**: 原生 `<select>` 的 `<option>` 内部仅支持纯文本。将选项纯文本清理为精简规范文案（如 `通用对话（无项目上下文）`、`项目: XRay`），而在 select 容器外侧的 Context Pill 头部常驻高辨识度的矢量 SVG 图标，既保证原生下拉选框的可访问性与跨平台稳定性，又彻底杜绝 Emoji 杂色。
