## Context

参见 `proposal.md`。现有界面的 `.drawer` 类定位为右侧滑入抽屉（`inset: 0 0 0 auto`，宽 560px~820px）。在展示复杂 Markdown（包含深度分析、长篇表格、多行执行日志代码块）时，空间严重不足，阅读体验割裂。同时由于弹窗与看板左右并列，容易出现页面和抽屉双重滚动的视觉冲突。

## Goals / Non-Goals

**Goals:**
- **底部向上弹出的宽屏 Bottom Sheet**：所有弹窗统一升级为自页面底部向上浮现，居中展示。
- **大幅扩充阅读宽度与高度**：
  - 任务详情弹窗：宽至 `min(1360px, 95vw)`，高至 `min(88dvh, 900px)`，使长文本、表格与代码块能够以全尺寸舒适阅读。
  - 小型配置弹窗（`.compact-drawer`）：宽至 `min(680px, 92vw)`，高至 `min(85dvh, 720px)`。
- **彻底杜绝滚动冲突**：
  - 弹窗外通过 `body:has(dialog[open]) { overflow: hidden; }` 锁死全局背景滚动；
  - 弹窗内结构严格划分为固定的头部栏（`.drawer-head`）与内容滚动区（`.drawer-body`），由 `.drawer-body` 自主消化局部平滑滚动，并美化内部细滚动条；
  - 弹窗顶部引入轻量美观的“居中把手条（Sheet Grab Handle）”，增强底部向上展开的直观认知。
- **遮罩点击智能检测**：保证居中 Bottom Sheet 在点击遮罩暗影处能够正确捕获并退出。

**Non-Goals:**
- 不破坏现有 DOM 结构与接口绑定逻辑，仅重构 CSS 定位排版与少量必要交互函数；
- 不改变已有表单、流程步骤条与控制按钮的业务功能。

## Decisions

### 1. 定位模式与居中变换 (Transform & Inset)
- **技术选择**：
  ```css
  dialog.drawer {
    position: fixed;
    inset: auto auto 0 50%;
    transform: translate(-50%, 100%);
    width: min(1360px, 95vw);
    height: min(88dvh, 900px);
    max-height: 90dvh;
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -12px 48px rgba(15, 23, 42, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  dialog.drawer[open] {
    transform: translate(-50%, 0);
  }
  ```
  这样不论大屏还是小屏，均平稳贴合屏幕底部居中弹出，顶角 20px 大圆角极具现代 SaaS 质感。

### 2. 动效曲线 (Motion Curve)
- 采用微弹减速贝塞尔曲线：`cubic-bezier(0.16, 1, 0.3, 1)`，耗时 `0.28s`：
  ```css
  @keyframes sheet-up {
    from {
      opacity: 0;
      transform: translate(-50%, 40px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
  ```

### 3. 头部固定与把手装饰条 (Sheet Handle)
- 在 `.drawer-head` 顶端伪元素（`::before`）注入把手条：
  ```css
  .drawer-head::before {
    content: '';
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 44px;
    height: 4px;
    border-radius: 99px;
    background: #cbd5e1;
  }
  ```
  明确传达其为可收起的底栏层叠面板。

### 4. 遮罩点击检测适配
- 在 `setupDrawer` 中，检测点击是否在 Bottom Sheet 的边界矩形（`getBoundingClientRect`）之外。居中底部弹出后矩形依然成立，逻辑完全无缝兼容。

## Risks / Trade-offs

- **[Risk] 超大宽度下普通表单输入框是否会过度拉伸？**
  → **Mitigation**：对表单类弹窗使用 `.compact-drawer` 限定 `width: min(680px, 92vw)`；在 `#detail-dialog` 内各卡片维持分块卡片结构（`.detail-card`），长篇 Markdown 自然利用宽屏展示，输入控件与步骤条保持优雅间隙。
