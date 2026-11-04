## 1. 静态模板与快捷卡片矢量图标重构

- [x] 1.1 在 `public/index.html` 中重构快捷提示卡片（Quick Prompts Grid），将 Emoji（🏛️、🔍、🌐、⚡）替换为专门的矢量 SVG 图标（分层架构、代码探查、全球网络网格、原型交互布局），通过浏览器审查元素验证图标渲染正确。
- [x] 1.2 在 `public/index.html` 的产物模态弹窗（`#artifact-preview-dialog`）中将“复制内容”按钮的原生 Emoji（📋）替换为系统矢量 SVG 复制图标，验证视觉一致性。

## 2. 动态消息流与会话上下文图标升级

- [x] 2.1 在 `public/app.js` 中构建矢量 SVG 图标生成辅助逻辑，重构深度思考卡片（Thinking Card）的标头图标，将 Emoji（💭）替换为优雅的思维推理微脉冲矢量 SVG 图标，验证不同状态下的渲染表现。
- [x] 2.2 在 `public/app.js` 中重构工具调用卡片（Tool Invocations Card），将综合工具标头与具体分类徽标中的 Emoji（🛠️、🔍、🌐、💻、📝、⚙️）全量替换为高辨识度内联矢量 SVG 图标（齿轮工具、放大镜、文档阅读、命令行终端、文件写入），验证卡片展开收拢正常。
- [x] 2.3 在 `public/app.js` 中清理项目上下文选择器（Context Pill）、会话列表项中的 Emoji（🌐、📦），纯文本统一规范文案，外层挂载对应的矢量网络与代码库图标，验证列表与药丸呈现干净统一。

## 3. 样式精细化与工程回归验证

- [x] 3.1 在 `public/style.css` 中优化新增内联矢量 SVG 图标的尺寸（14px~16px）、垂直居中对齐、主题色继承（`currentColor`）以及悬停交互平滑过渡，确保在各断点下无变形或折行。
- [x] 3.2 运行本地 `npm run check`、`npm run lint` 和 `npm test`，确保代码零报错且全量自动化测试套件通过。
