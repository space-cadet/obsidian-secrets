# Mobile Unlock UX — Quick-Unlock Modal Design
*Created: 2026-08-13 15:00:00 IST*
*Last Updated: 2026-08-13 15:00:00 IST*

## Problem

On mobile, the current encrypt/decrypt workflow requires:
1. Select text
2. Open sidebar (swipe from edge)
3. Unlock vault (type password)
4. Switch back to editor
5. **Selection is lost** — re-select text
6. Re-run encrypt command

This is ~10 steps and selection loss makes it unusable in practice. The root cause is that Obsidian mobile clears editor selection when switching views (editor ↔ sidebar).

## Root Cause

- `SessionKeyService.isUnlocked()` returns `false`
- Current code shows `Notice("Vault is locked...")` and returns
- User must leave editor → unlock → return → re-select → retry
- Mobile view switching reliably drops text selection

## Solution: Quick-Unlock Modal (Option 1)

When encrypt/decrypt is triggered while locked, show a **small password modal over the editor** instead of a notice. On successful unlock, automatically continue the pending action.

```
[Editor: "my secret text" selected]
        ↓
[Encrypt command tapped]
        ↓
┌──────────────────────────┐
│  🔒 Vault Locked         │
│  Enter password          │
│  [          ] [Unlock]   │
└──────────────────────────┘
        ↓
[Password correct]
        ↓
[Auto-encrypts selection]
[Notice: "Selection encrypted"]
[Modal closes, editor focus preserved]
```

### Key Properties
- Modal opens **over** the editor, not in a sidebar
- Selection is never lost (no view switch)
- One-shot: unlock + encrypt in a single flow
- Works on both desktop and mobile
- No sidebar interaction needed for the common case

### Implementation Sketch

```typescript
// In ObsidianSecretsPlugin

private pendingAction?: {
  type: "encrypt" | "decrypt";
  editor: Editor;
};

private async ensureUnlocked(editor: Editor, action: "encrypt" | "decrypt"): Promise<boolean> {
  if (this.sessionKeyService.isUnlocked()) return true;

  this.pendingAction = { type: action, editor };
  new QuickUnlockModal(this.app, {
    onUnlock: async (password: string) => {
      const salt = decodeBase64Url(this.settings.vaultSalt!, "vs");
      const success = await this.sessionKeyService.unlock(password, salt, MIN_ITERATIONS);
      if (!success) {
        new Notice("Incorrect password.");
        return false; // Keep modal open
      }
      this.historyService.record("vault_unlocked");

      // Resume pending action
      const pending = this.pendingAction;
      this.pendingAction = undefined;
      if (pending?.type === "encrypt") {
        await this.actuallyEncryptSelection(pending.editor);
      } else if (pending?.type === "decrypt") {
        await this.actuallyDecryptSelection(pending.editor);
      }
      return true; // Close modal
    },
  }).open();
  return false;
}
```

The `encryptSelection()` command becomes:

```typescript
private async encryptSelection(editor: Editor): Promise<void> {
  if (!await this.ensureUnlocked(editor, "encrypt")) return;
  await this.actuallyEncryptSelection(editor);
}
```

### Modal Design

- Small, centered modal (not full-screen)
- Password input + Unlock button
- "Cancel" to close without action
- Auto-focus on password input
- Single-line: no scroll, no tabs, no complexity
- Dark theme compatible (uses Obsidian CSS vars)

### CSS

```css
.obsidian-secrets-unlock-modal {
  display: grid;
  gap: 10px;
  padding: 20px;
}
.obsidian-secrets-unlock-modal h3 {
  margin: 0;
  font-size: 16px;
}
.obsidian-secrets-unlock-modal input {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
}
```

## Deferred: Mobile Context Menu (Option 3)

Obsidian's `editor-menu` event fires when the user right-clicks (desktop) or long-presses (mobile) selected text. Adding "🔒 Encrypt" and "🔓 Decrypt" to this menu would make the workflow even more natural:

1. Long-press → select text
2. Context menu appears with "Encrypt" option
3. Tap "Encrypt" → quick-unlock modal (if locked) → encrypted

This is a separate task (T4.3) because:
- Requires registering `editor-menu` event handler
- Must gracefully degrade if menu API is unavailable
- Needs testing on both iOS and Android

## Decision Log

- **2026-08-13**: Implement Option 1 (Quick-Unlock Modal) first — it fixes the core problem with minimal code.
- **2026-08-13**: Option 3 (Context Menu) is next — highest ROI after Option 1 is working.
- Option 2 (Mobile Toolbar) deferred indefinitely — Obsidian's toolbar API is unstable and varies by platform.

## References

- Task: `memory-bank/tasks/T4.md` — sidebar simplification task, now includes mobile UX subtasks
- Task: `memory-bank/tasks/T4-context-menu.md` — context menu integration task (if separate)
- Related: `memory-bank/implementation-details/session-key-service.md` — key lifecycle
