# Runtime deployment notes

Production entry uses PostgreSQL through DATABASE_URL. API, Agent and Gateway images are built separately. Only Dispatcher mounts the Docker socket. Agent receives a run-scoped Token; upstream LLM credentials remain in Gateway.

## Agent language toolchains

The Agent image includes Node.js 24, Python 3 (pip and venv), ruff, and Go 1.26 (go test, go vet, gofmt). The root filesystem stays read-only and the Agent runs as UID 1000. Create Python virtual environments inside the task worktree; do not install packages into system directories. Use `python3 -m compileall`, `python3 -m unittest discover`, and `ruff check --no-cache` for standard Python checks. Go caches use writable `/tmp/go-cache`, `/tmp/go-mod` and `/tmp/go-path`; these caches are ephemeral. Dependencies still require accessible package registries. Existing running containers retain their original image; the updated toolchain applies to newly created runs.

Before release run:

```sh
npm ci
npm run lint
npm run check
npm run build
TEST_DATABASE_URL=postgres://... npm test
TEST_DATABASE_URL=postgres://... npm run coverage
```

Coverage includes every src/**/*.ts file. Do not exclude untested service entry points or lower thresholds. Both lines and functions must reach 90%.

No deployment to 10.9.34.84 is allowed until the complete runtime acceptance suite passes, including dynamic container execution, worktree/session recovery, partial-stream interruption and protocol conversion.

Back up PostgreSQL, workspaces and sessions together before upgrading. Never delete persistent volumes during a release. Rollback requires the previous image tags and matching database backup. An interrupted run must be inspected before retrying; it must never be blindly replayed.
