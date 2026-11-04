## ADDED Requirements

### Requirement: Elimination of Stage Animations in Detail View
任务详情弹窗中 SHALL 遵循低视觉噪音准则，移除所有阶段脉冲波纹、呼吸灯动画与视图切换 cross-fade 动效，呈现稳定、静默的阅读环境。

#### Scenario: Detail view status and badge presentation
- **WHEN** 用户在任务详情中查看当前阶段、状态徽标或执行内容时
- **THEN** 状态圆点与内容区域 SHALL 呈现静态清晰的高保真样式，不得播放循环的 ping 扩散光晕或平滑淡入动效。

### Requirement: Pixel-Perfect Native Center Alignment of Bottom Sheet Dialogs
底部弹窗（`.drawer` 及 `dialog.drawer`）SHALL 采用原生标准盒模型实现水平居中（通过 `inset: auto 0 0 0` 与 `margin: 0 auto` 居中），严禁依赖 `left: 50%` 与 `translateX(-50%)` 的复合位移方案。

#### Scenario: Opening dialog on desktop screens
- **WHEN** 用户在宽屏或桌面分辨率下打开任务详情或配置弹窗时
- **THEN** 弹窗两侧外边距 SHALL 完全对称相等，弹窗本体严密居中停靠在视口底部，杜绝向右偏移或被视口截断。

#### Scenario: Opening dialog on mobile devices
- **WHEN** 屏幕视口宽度小于 600px 时
- **THEN** 弹窗宽度自适应为视口 100% 满宽呈现，并保持底部无缝贴合。
