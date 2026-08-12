# Error Log
*Last Updated: 2026-08-12 13:48:25 IST*

## 2026-08-12

### MB-BOOT-1: Fresh database parser bootstrap
- **Task**: T1
- **Symptom**: The first task and session parser runs reported missing SQLite tables.
- **Cause**: The fresh database schema had not been initialized.
- **Attempted resolution**: Ran the generated `memory-bank/database/init-schema.js` tool.
- **Result**: The initializer split `schema.sql` on semicolons and skipped the first commented `CREATE TABLE` statement, then failed when creating its index (`edit_entries` was missing).
- **Impact**: Markdown records remain valid; SQLite mirror validation is deferred until the mb-core initializer/parser defect is repaired or a corrected schema bootstrap is approved.

### PKG-SETUP-1: pnpm dependency setup required CI/network handling
- **Task**: T1, T2
- **Symptom**: Initial pnpm installs could not resolve the registry in the restricted sandbox, and noninteractive module cleanup reported `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- **Cause**: Dependency downloads require network access, while pnpm 11 also requires an explicit workspace build allowlist for esbuild.
- **Resolution**: Generated `pnpm-lock.yaml`, added `pnpm-workspace.yaml` with `allowBuilds.esbuild: true`, and verified the checks with `CI=true pnpm` commands.
- **Result**: pnpm tests, plugin bundle, and archive build pass locally; GitHub Actions uses the same frozen-lockfile and CI path.
