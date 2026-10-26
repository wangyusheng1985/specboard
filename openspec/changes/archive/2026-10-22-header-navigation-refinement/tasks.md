## 1. 结构与矢量图标体系升级

- [x] 1.1 在 `public/index.html` 的 `<nav>` 中重构按钮结构，为连接控制项（#connect）增加状态微光指示点，为通知（#browser-notifications）、项目配置（#projects）、LLM 配置（#llm-settings）以及创建任务（#new-task）注入尺寸为 14px 的统一风格矢量 SVG 图标，并通过浏览器检查结构正确渲染。
- [x] 1.2 在 `public/index.html` 中在辅助工具项与核心创建任务主按钮之间增加视觉分隔元素，验证视觉主次层级清晰。

## 2. 导航栏样式微调与交互动效对齐

- [x] 2.1 在 `public/style.css` 中微调导航按钮组样式，确保所有按钮与链接的高度（42px）、内边距、字体大小（13.5px~14px）、行高完全一致，并强制所有文本项 `white-space: nowrap` 杜绝折行。
- [x] 2.2 在 `public/style.css` 中为连接状态点编写在线翠绿呼吸高光（`.connect-dot.connected`）与离线中性灰样式，验证状态切换时平滑过渡。
- [x] 2.3 在 `public/style.css` 中增强主按钮（#new-task）与次级按钮的悬停微动效，验证外链图标斜移与按钮微抬效果自然自洽。

## 3. 状态联动逻辑与脚本维护

- [x] 3.1 在 `public/app.js` 中封装 `updateConnectButton(connected)` 状态渲染逻辑，确保在登入、退出及失效刷新时，状态指示点与文本协同更新而不被暴力清空覆盖。
- [x] 3.2 在 `public/app.js` 中调整 `updateNotificationControl()` 逻辑，在修改按钮文字与提示时完整保留内部的矢量铃铛图标。

## 4. 全量验证与回归测试

- [x] 4.1 运行本地完整验证套件（`npm run check`、`npm run lint`、`npm test`），确保所有 TypeScript 检查、代码风格及自动化测试全部通过。
