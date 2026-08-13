# Sidebar Redesign — Path A (Unified Panel)
*Created: 2026-08-13 11:34:00 IST*
*Last Updated: 2026-08-13 11:34:00 IST*

## Problem Statement

The original 4-tab sidebar (Vault, Blocks, History, Settings) made a simple tool feel like a password manager. The real workflow is editor-first: select text → encrypt → click to decrypt. The sidebar was fighting the plugin's nature by forcing users to navigate tabs for actions that should be immediate.

## Redesign Goals

1. **Reduce cognitive load**: One glance at the sidebar should tell the user everything they need to know.
2. **Editor-first workflow**: The editor is where encryption/decryption happens; the sidebar is only for vault status.
3. **Eliminate tab switching**: No more clicking between Vault, Blocks, History, Settings.
4. **Preserve all security invariants**: No changes to crypto, session keys, or format.

## Proposed Design

### Unified Panel Layout

```
┌─────────────────────────┐
│  🔒 Vault Locked        │  ← status + icon
│  [Password    ] [Unlock]│  ← unlock form (when locked)
│                         │
│  Quick Actions          │  ← collapsible, only when unlocked
│  [🔒 Encrypt selection] │
│  [🔓 Decrypt selection] │
│                         │
│  ℹ️ 3 blocks in note    │  ← auto-detected, click to scroll
│     Auto-lock: 15 min   │  ← status line
│                         │
│  [View history] [⚙️ Settings] │  ← links, not tabs
└─────────────────────────┘
```

### Key Changes

| Aspect | Before (T3) | After (T4) |
|--------|-------------|------------|
| Layout | 4 tabs | Single unified panel |
| Vault status | One tab among four | Always visible at top |
| Block discovery | Blocks tab listing | Status bar + inline markers |
| History | Full tab | Modal triggered by link |
| Settings | Full tab | Link to native Obsidian settings |
| Encrypt/Decrypt | Commands + sidebar buttons | Commands + sidebar quick actions |

### Status Bar Widget

A status bar element showing `🔒 3` (encrypted block count in current note). Clicking it opens the sidebar. This replaces the Blocks tab's primary function.

### Inline Editor Markers

Encrypted blocks already render as `🔒 Encrypted` spans in Reading View. Live Preview support is deferred to a future enhancement.

## Security Boundaries (Unchanged)

- Sidebar does not auto-open, auto-unlock, or initialize a vault.
- Password input is cleared on submit; no password retention.
- Real unlock remains owned by SessionKeyService with non-extractable keys.
- UI errors must not change note content or create plaintext persistence.

## Implementation Notes

- Remove `TABS` array and tab state from `SecretsSidebarView`.
- Remove `renderBlocks()`, `renderHistory()`, `renderSettings()` as tab panels.
- Add `renderUnifiedPanel()` with conditional sections.
- Add status bar registration in `main.ts` via `Plugin.addStatusBarItem()`.
- History viewer becomes a modal or a separate command.
- Settings navigation opens native Obsidian settings page.

## Deferred to Future (Path B)

- Inline decrypt-and-edit in the editor with auto-re-encrypt on lock/timeout/switch.
- Live Preview inline lock markers.
- Context menu entries for encrypt/decrypt.
- First-encrypt flow with implicit vault creation.

## References

- Original sidebar design: `memory-bank/implementation-details/sidebar-ui.md`
- Task file: `memory-bank/tasks/T4.md`
