## Context

参见 `proposal.md`。当前系统在测试服务器部署时，`compose.yaml` 中配置了 `GITLAB_ALLOWED_HOSTS: gitlab.com,git.in.chaitin.net`。

## Goals / Non-Goals

**Goals:**
- **保底信任主流公有托管平台**：
  - 无论环境变量是否提供，`github.com` 与 `gitlab.com` 始终内置属于白名单。
  - 环境变量配置的任何主机（例如企业自建 GitLab 域名）以并集方式追加。
- **环境配置清晰化**：
  - 更新项目 Compose 模板及环境说明。

**Non-Goals:**
- 不允许任意无限制的未知非安全协议或非白名单域名。

## Decisions

### 1. 域名解析策略由“条件覆盖”改为“并集合并”
- **决策**：
  ```typescript
  const configuredHosts = (process.env.GIT_ALLOWED_HOSTS || process.env.GITLAB_ALLOWED_HOSTS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const allowed = Array.from(new Set([...configuredHosts, 'github.com', 'gitlab.com']));
  ```
- **考虑替代方案**：要求运维在每个环境的 Compose 中手动加上 `github.com`。放弃原因：容易遗漏，且作为已经原生支持 GitHub 的系统，默认不支持 `github.com` 会造成严重的反直觉体验。

## Risks / Trade-offs

- **[Risk] 部分纯内网隔离环境若要求严格禁止外联公有云 GitHub**
  → **Mitigation**：如果未来有极度苛刻的内网物理隔离诉求，可以通过 `GIT_DISALLOW_PUBLIC_HOSTS=true` 来显式关闭，目前作为研发协作系统，默认信任公有平台是完全合理且体验最佳的。
