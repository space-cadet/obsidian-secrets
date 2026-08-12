# Active Context
*Last Updated: 2026-08-12 15:52:29 IST*

## Current Focus
T1: Validate the pure inline-encryption layer, T2: establish the cross-platform auto-update boundary, and T3: own the sidebar UI.

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
- Local build and pure-layer tests pass (17 tests including checksum verification).
- Public GitHub repository is current; the updater modal and Memory Bank closeout are published at `origin/main` commit `cf9ec46`.

## Immediate Next Steps
1. Verify the first GitHub Actions `dev` release and direct assets after push.
2. Verify the first real Android installation from a published release.
3. Add session-key lifecycle tests and connect the locked Vault tab to the non-extractable in-memory key layer.
4. Add editor transaction tests for replacement/save failure behavior.
5. Add the Obsidian editor and Reading View adapters.
6. Implement ciphertext-only export/import, non-sensitive history, and real encryption/history Settings controls.

## Guardrails
- Keep the first milestone inline-only.
- Treat all encryption and persistence errors as fail-closed.
- Do not add convenience features that expand plaintext lifetime without a separate decision.
