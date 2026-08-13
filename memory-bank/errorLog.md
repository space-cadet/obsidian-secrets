# Error Log
*Last Updated: 2026-08-12 14:09:25 IST*

## 2026-08-13

### UX-1: Modal decryption wrong for inline secrets
- **Task**: T1
- **Symptom**: Clicking encrypted block shows modal popup. User expected inline decryption (replace marker with plaintext in note).
- **Cause**: Architecture designed as "view-only", not "edit-in-place".
- **Status**: Design mismatch. Requires significant refactor for inline decrypt/re-encrypt workflow.

### PERF-1: Format overhead absurd for small secrets
- **Task**: T1
- **Symptom**: 10-character plaintext produces ~200-character encrypted marker.
- **Cause**: Fixed per-block overhead (~180 bytes) for version, salts, IV, metadata. Format designed for large text blocks, not short secrets.
- **Impact**: 90%+ overhead for API keys/passwords. Acceptable (~15%) for long paragraphs.
- **Status**: Would require format redesign to fix without compromising self-describing security properties.

### UI-1: Unlock button failed silently on mobile
- **Task**: T1
- **Symptom**: Tapping "Unlock" in sidebar did nothing.
- **Cause**: Button created with `type="button"` inside `<form>` — doesn't submit on mobile.
- **Fix**: Changed to `type="submit"`.

### UI-2: Live Preview shows nothing for encrypted blocks
- **Task**: T1
- **Symptom**: HTML comment markers invisible in Live Preview mode.
- **Fix**: Added `registerMarkdownPostProcessor` to replace comment nodes with visible `🔒 Encrypted` badges.

### STATE-1: History lost on restart
- **Task**: T1
- **Symptom**: Security history disappeared after Obsidian restart.
- **Cause**: History stored only in memory, never persisted.
- **Fix**: Added persistence to disk at `.obsidian/plugins/obsidian-secrets/history.json`.

### NET-1: Updater download failed intermittently on mobile
- **Task**: T2
- **Symptom**: "Update download failed" error.
- **Cause**: Likely GitHub CDN/rate limiting/mobile network issues.
- **Workaround**: Manual install from releases page works reliably.

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

### PKG-SETUP-2: Corepack could not download the pinned pnpm runtime during UI verification
- **Task**: T1
- **Symptom**: `pnpm run build` could not create Corepack's cache under the restricted home directory; using a temporary Corepack directory then failed DNS resolution for `registry.npmjs.org`.
- **Resolution**: Used the already installed local `tsc` and `esbuild` binaries, then ran the existing Node test suite and archive script directly.
- **Result**: TypeScript compilation, plugin bundling, 13 existing tests, and archive creation passed; the pnpm wrapper remains network-blocked in this environment.
