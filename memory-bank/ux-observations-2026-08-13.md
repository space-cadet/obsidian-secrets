# UX and Design Observations from Testing Session (2026-08-13)

## Issues Discovered During Real-World Use

### 1. Modal Decryption is Wrong for Inline Secrets
**Observation**: Clicking an encrypted block shows a modal popup with the plaintext. User expected inline decryption — replace the encrypted marker with plaintext directly in the note, allow editing, then re-encrypt.
**Impact**: Modal flow is clunky for API keys and short secrets where you need to see context.
**Status**: Design mismatch. Current architecture is "view-only", not "edit-in-place".

### 2. Format Overhead is Absurd for Small Secrets
**Observation**: A 10-character plaintext produces a ~200-character encrypted marker.
**Breakdown**: Fixed overhead per block:
  - Version/algorithm/KDF metadata: ~40 chars
  - Vault salt: ~22 chars
  - Block salt: ~22 chars
  - IV: ~16 chars
  - Ciphertext + GCM tag: ~30 chars (for 10-char input)
  - Base64 encoding overhead
  - HTML comment wrapper: ~9 chars
**Total**: ~180 bytes fixed overhead regardless of plaintext size.
**Impact**: For API keys, passwords, short secrets — 90%+ of the stored text is metadata. For long paragraphs, overhead is acceptable (~15%).
**Status**: Format was designed for large text blocks, not short secrets. Would require format redesign to fix.

### 3. Auto-Lock Default of 15 Minutes is Annoying
**Observation**: Vault auto-locks after 15 minutes of inactivity. For a note-taking workflow where you reference secrets occasionally, this means constant re-unlocking.
**Fix applied**: Changed default to 0 (never auto-lock). Users can opt-in to timeouts if desired.

### 4. Unlock Button Failed Silently on Mobile
**Observation**: Tapping "Unlock" in the sidebar did nothing. No error, no feedback.
**Root cause**: Button was created with `type="button"` inside a `<form>`. On mobile, this doesn't submit the form.
**Fix applied**: Changed to `type="submit"`.

### 5. Live Preview Shows Nothing (Encrypted Blocks Invisible)
**Observation**: In Live Preview mode, encrypted blocks (HTML comments) render as empty space. User can't see or click them.
**Fix applied**: Added `registerMarkdownPostProcessor` to replace HTML comment nodes with visible `🔒 Encrypted` badges in rendered view.

### 6. History Lost on Restart
**Observation**: Security history (lock/unlock events) disappeared after Obsidian restart.
**Root cause**: History was stored only in memory, never persisted to disk.
**Fix applied**: Added persistence to `.obsidian/plugins/obsidian-secrets/history.json`.

### 7. Updater Failed Intermittently
**Observation**: "Update download failed" error on mobile.
**Possible cause**: GitHub CDN issues, rate limiting, or mobile network restrictions.
**Workaround**: Manual install from releases page works reliably.

## Design Lesson

The current architecture works for **long-form encrypted notes** (paragraphs, journal entries) where:
- Overhead is small relative to plaintext
- Modal "view-only" decryption is acceptable
- Infrequent access means auto-lock is fine

It fails for **short secret storage** (API keys, passwords, tokens) where:
- Overhead dominates the stored size
- Inline editing is essential
- Frequent access makes auto-lock annoying

## Recommendation

For short secrets, a different approach is needed:
- Single vault-wide salt (not per-block)
- Streamlined format with minimal metadata
- Inline decrypt/re-encrypt workflow
- Optional auto-lock (default: never)

The current plugin should be repositioned as "encrypted notes" rather than "secret storage".
