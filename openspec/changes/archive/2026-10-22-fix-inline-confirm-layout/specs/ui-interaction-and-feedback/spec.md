## MODIFIED Requirements

### Requirement: Form Validation and Error Recovery Feedback
表单提交校验失败、字段不符合要求或需要二次破坏性操作确认时，系统 SHALL 提供明确且自适应容器宽度的视觉警示与确认卡片。

#### Scenario: Form validation failure
- **WHEN** 表单提交失败且服务端或本地校验返回错误时
- **THEN** 对应输入控件 SHALL 呈现红色轮廓并触发 250ms 内的轻微横向微震动，错误说明文本 SHALL 平滑向下展开显示。

#### Scenario: Inline confirmation box in narrow containers
- **WHEN** 用户在抽屉或列表项内部触发二次确认操作（如删除项目）时
- **THEN** 二次确认卡片（`.inline-confirm`）SHALL 具备 100% 容器宽度与独立的块级排版，卡片内的操作按钮强制保持单行不折行（`white-space: nowrap`），杜绝因父级弹性容器挤压导致的竖排变形。
