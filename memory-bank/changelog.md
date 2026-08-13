# Changelog
*Last Updated: 2026-08-12 15:52:29 IST*

## 2026-08-13

### Fixes Applied During Testing
- **Unlock button**: Changed `type="button"` to `type="submit"` to fix mobile form submission.
- **Live Preview visibility**: Added `registerMarkdownPostProcessor` to render visible `🔒 Encrypted` badges for HTML comment markers in Live Preview/Reading mode.
- **History persistence**: Added save/load to `.obsidian/plugins/obsidian-secrets/history.json` so history survives restarts.
- **Auto-lock default**: Changed from 15 minutes to 0 (never) — users opt-in to timeouts.
- **Editor detection**: Switched from `getLeavesOfType("markdown")[0]` to `getActiveViewOfType(MarkdownView)` so encrypt/decrypt works in Live Preview mode.
- **Sidebar decrypt buttons**: Blocks tab now shows per-block Decrypt buttons so users don't need to select invisible HTML comments.
- **Password change flow**: Added "Change vault password" button in Danger Zone with double-confirmation.

## 2026-08-12
- Initialized the Obsidian Secrets project and complete mb-core Memory Bank.
- Added the first safe inline-encryption design and validation plan.
- Published the initial project and Memory Bank to GitHub.
- Added the pure format/crypto prototype and focused malformed-input, corruption, and Unicode tests.
- Added the stable/dev updater core with direct assets, manifest validation, staging, and rollback.
- Added the pnpm build/archive pipeline and GitHub Actions workflow for rolling `dev` and stable releases.
- Added the first explicitly opened Obsidian sidebar UI with Vault, Blocks, History, and Settings tabs.
- Added the sidebar UI mock screenshot and recorded the security boundaries for future session-key, editor, export/import, history, and settings work.
- Recorded the user-confirmed Vault-tab screenshot as the current visual acceptance reference.
- Merged and pushed the sidebar UI implementation and Memory Bank updates to `main`.
- Moved sidebar UI ownership to T3 and integrated updater channel/startup-check preferences with persisted Obsidian plugin settings.
- Added direct navigation from the sidebar Settings tab to the native Obsidian plugin settings page.
- Added a direct “Check for updates” action to the sidebar Settings tab.
- Restored the manual “Update Available” confirmation modal with changelog, transactional install, and reload action.
- Refreshed the Memory Bank to record the modal implementation, verification, and publication state.
