## MODIFIED Requirements

### Requirement: GitHub Repository Configuration and Validation
系统 SHALL 支持配置 GitHub 代码仓库，并通过 GitHub REST API 校验仓库与默认分支的有效性，且默认始终内置放行 `github.com` 与 `gitlab.com` 主机。

#### Scenario: Validating GitHub repository
- **WHEN** 用户添加或编辑一个 GitHub 仓库（HTTPS URL 域名为 `github.com`）时
- **THEN** 系统 SHALL 使用用户提供的 Personal Access Token 调用 GitHub API（`GET /repos/{owner}/{repo}/branches/{branch}`）进行可访问性校验。

#### Scenario: Unsupported repository host
- **WHEN** 用户输入的仓库地址既不是环境配置的额外允许域名，也不是默认内置信任的 `github.com` 或 `gitlab.com` 时
- **THEN** 系统 SHALL 拒绝该配置并返回清晰的报错信息。

#### Scenario: Custom allowed hosts environment variable coexistence
- **WHEN** 环境变量（`GIT_ALLOWED_HOSTS` 或 `GITLAB_ALLOWED_HOSTS`）仅配置了私有代码托管域名时
- **THEN** 系统 SHALL 将该配置与默认内置的 `github.com` 和 `gitlab.com` 合并并集，不得因配置了私有域名而屏蔽 `github.com`。
