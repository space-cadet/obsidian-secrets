# Active Context
*Last Updated: 2026-08-13 04:55:00 IST*

## Current Focus
Complete remaining work: T2 Android verification, security review, and prepare for release.

## Current State
- Repository directory created.
- Complete mb-core Memory Bank initialized.
- Existing Obsidian secret plugins reviewed for design and failure-path lessons.
- Pure versioned format and AES-GCM crypto prototype implemented outside the Obsidian adapter.
- Host-injected stable/dev auto-update service implemented with staged assets and rollback.
- pnpm-based GitHub Actions workflow added for tested rolling `dev` and stable tag releases.
- First Obsidian sidebar UI shell implemented with explicit Vault, Blocks, History, and Settings tabs.
- User confirmed the current sidebar composition; the reference screenshot is stored in the Memory Bank.
- Sidebar implementation, confirmed reference, and Memory Bank updates are merged and pushed to `origin/main` at `f632d487`.
- Sidebar ownership is now tracked by T3 rather than T1.
- Updater channel and optional startup-check settings are persisted through the native Obsidian plugin settings page.
- The sidebar Settings tab now includes direct navigation to the native Obsidian plugin settings page.
- The sidebar Settings tab now launches an explicit updater check using the persisted channel.
- Manual update checks now open a confirmation modal with release details and changelog; install/reload uses the existing transactional updater path.
- Updater now enforces SHA-256 checksum verification of downloaded assets against the release CHECKSUMS.txt before installation; tampered or incomplete downloads abort with cleanup.
- Local build and pure-layer tests pass (49 tests including checksum verification, session-key lifecycle, export/import, and security history).
- Public GitHub repository is current; session-key service, editor commands, export/import, and history published at `origin/main` commit `c55d1ca`.
- SessionKeyService implemented with non-extractable master key caching, auto-timeout, and lifecycle tests.
- Vault tab wired to real session-key state (unlock/lock, green status indicator).
- Editor encrypt/decrypt selection commands implemented with reveal modal.
- Export/import service implemented: ciphertext-only bundles, validation, sidebar export action.
- Security history service implemented: non-sensitive event logging, sidebar history display.
- Blocks tab wired: scans current note, shows encrypted block count and list.
- History tab wired: displays non-sensitive operation log with timestamps.

## Immediate Next Steps
1. ✅ SessionKeyService with non-extractable master key caching — COMPLETE.
2. ✅ Wire Vault tab unlock/lock to session-key layer — COMPLETE.
3. ✅ Add editor transaction actions — COMPLETE.
4. ✅ Implement ciphertext-only export/import (T1.5) — COMPLETE.
5. ✅ Implement non-sensitive security history (T1.6) — COMPLETE.
6. Verify the first real Android installation from a published release (T2).
7. Run security review checklist.

## Guardrails
- Keep the first milestone inline-only.
- Treat all encryption and persistence errors as fail-closed.
- Do not add convenience features that expand plaintext lifetime without a separate decision.
- Session keys must be non-extractable and auto-clear on lock/timeout/unload/vault-change.
