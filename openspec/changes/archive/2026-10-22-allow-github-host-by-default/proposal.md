## Why

在向测试环境添加 GitHub 仓库项目（例如 `https://github.com/wangyusheng1985/retro-ssh.git`）时，服务端报错 `invalid_repository: Repository host is not allowed`。

根本原因在于：生产/测试环境的 Compose 配置中显式设置了 `GITLAB_ALLOWED_HOSTS: gitlab.com,git.in.chaitin.net`。原本的代码逻辑中，若环境变量存在即直接采用该变量，导致 `github.com` 被排除在白名单之外。系统必须在代码逻辑中将主流代码托管平台（`github.com` 与 `gitlab.com`）作为不可覆盖的保底内置信任列表，并与外部环境变量设定的自定义域名进行安全并集并去重。

## What Changes

- **内置主流代码托管平台保底白名单 (`src/runtime-api.ts`)**：
  - 在 `POST /api/v1/projects` 与 `PUT /api/v1/projects/:id` 的仓库合法性校验中，重构白名单解析算法：
    ```typescript
    const configuredHosts = (process.env.GIT_ALLOWED_HOSTS || process.env.GITLAB_ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowed = Array.from(new Set([...configuredHosts, 'github.com', 'gitlab.com']));
    ```
  - 无论部署环境是否设置了 `GITLAB_ALLOWED_HOSTS` 或 `GIT_ALLOWED_HOSTS`，`github.com` 和 `gitlab.com` 始终处于合法放行名单中。
- **配置示例与模板同步 (`compose.yaml`, `.env.example`)**：
  - 更新环境变量示例，推荐使用 `GIT_ALLOWED_HOSTS` 并明确其与保底平台并集的行为。
- **单元测试固化 (`test/runtime-project-validation.test.ts`)**：
  - 增加即使用户在环境变量中仅指定企业内网域名（例如 `git.internal.net`），系统依然允许添加 `github.com` 仓库的单元测试用例。

## Capabilities

### New Capabilities
<!-- 无新增能力集 -->

### Modified Capabilities
- `github-integration`: 明确要求系统必须默认信任并内置放行 `github.com` 主机，不得因外部自定义白名单环境变量的存在而将 `github.com` 排除在外。

## Impact

- **服务端 API**：`src/runtime-api.ts`
- **配置与测试**：`test/runtime-project-validation.test.ts`、`compose.yaml`
