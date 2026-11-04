## Context

参见 `proposal.md`。先前将抽屉改造成底部向上弹出（Bottom Sheet）时，采用了：
```css
.drawer {
  position: fixed;
  inset: auto auto 0 50%;
  transform: translate(-50%, 100%);
}
.drawer[open] {
  transform: translate(-50%, 0);
}
```
结合 `<dialog>` 标签原生的默认 `margin: auto`，在多处媒体查询（如移动端中出现了 `transform: translateY(0)`）时产生了 `translateX(-50%)` 丢失的 Bug，导致在桌面和移动端出现弹窗偏移到视口右侧 50% 甚至完全超出屏幕的严重居中显示问题。同时，详情页内留存了阶段步骤脉冲动效和切换动画，造成视觉干扰。

## Goals / Non-Goals

**Goals:**
- **彻底根治弹窗居中对齐问题**：
  - 弃用任何 `left: 50% + translateX(-50%)` 定位方案；
  - 采用绝对标准可靠的 CSS 块级居中：
    ```css
    dialog.drawer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      top: auto;
      margin: 0 auto;
      width: min(1360px, 96vw);
      max-width: 96vw;
    }
    ```
    由浏览器的排版引擎自动计算左右边距（`margin-left: auto; margin-right: auto;`），实现 100% 绝对对称水平居中。
  - 垂直方向浮入动效仅作用于 Y 轴（`translateY(36px) -> translateY(0)`），完全不碰 X 轴，从物理层面上杜绝水平位移偏差。
- **去除详情页所有阶段相关动画**：
  - 移除阶段切换时的 `view-fade` / `view-crossfade`；
  - 移除 `.stage-step.current .step-number` 的 `pulse-ring` 循环扩散动效；
  - 任务详情头部 Badge 内的圆点保持清晰静态，去除 ping 扩散层，降低界面视觉噪声。

## Decisions

### 1. 原生块级自动居中架构
- **技术选择**：
  在 `dialog.drawer` / `.drawer` 上明确定义：
  ```css
  .drawer, dialog.drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    margin: 0 auto;
    width: min(1360px, 96vw);
    max-width: 96vw;
    height: min(88dvh, 920px);
    max-height: 90dvh;
    transform: translateY(100%);
    transition: transform .28s cubic-bezier(.16, 1, .3, 1);
  }
  .drawer[open] {
    transform: translateY(0);
  }
  @keyframes sheet-up {
    from {
      opacity: 0;
      transform: translateY(32px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  ```
  这样既拥有极其平滑自然的纯垂直向上滑入（`sheet-up`），又彻底消灭了所有的水平位移偏移 Bug。

### 2. 详情页低噪声静态化
- 移除 `.stage-step.current .step-number` 的 `pulse-ring`；
- 移除 `public/app.js` 中关于 `view-fade` 动效类的操作；
- 保持详情页内部信息专注、清晰、稳定。

## Risks / Trade-offs

- **[Risk] 点击遮罩区域（Backdrop）关闭是否受影响？**
  → **Mitigation**：由于 `margin: 0 auto` 精准居中，`dialog.getBoundingClientRect()` 得到的就是正中央弹窗区域，点击屏幕两侧或上方的透明遮罩时 `clientX < r.left || clientX > r.right || clientY < r.top` 依然完美生效。
