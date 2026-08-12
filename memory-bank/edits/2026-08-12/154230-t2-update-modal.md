---
source_branch: main
source_commit: aadd79870c235862c0cd6ab4868fdb5b5651e7a2
---

#### 15:42:30 IST - T2: Restore the manual update confirmation modal
- Modified `src/updater/UpdateAvailableModal.ts` - Added version, prerelease, changelog, install, skip, failure, and reload UI.
- Modified `src/main.ts` - Opened the modal for explicit update checks while keeping startup checks notice-only.
- Modified `src/obsidian.d.ts` - Declared the modal, command reload, and disabled button APIs used by the UI.
- Modified `src/settings/SecretsSettingTab.ts` - Clarified that startup checks do not install or reload updates.
- Updated `docs/auto-update-design.md` and `README.md` - Documented the confirmation gate and manual install/reload behavior.
- Updated `memory-bank/tasks/T2.md` and `memory-bank/implementation-details/sidebar-ui.md` - Recorded the completed confirmation/reload slice and remaining Android/integrity gates.
- Updated `memory-bank/activeContext.md`, `memory-bank/session_cache.md`, `memory-bank/sessions/2026-08-12-afternoon.md`, and `memory-bank/changelog.md` - Recorded the current implementation state.

## Verification
- `pnpm run build` passed.
- `pnpm test` passed with 15 tests.
- `pnpm run build:plugin`, `pnpm run archive`, and `git diff --check` passed.
- Commit and push are the remaining publication steps for this edit.
