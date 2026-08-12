# Inline Encryption Design Plan
*Last Updated: 2026-08-12 12:18:38 IST*

## Design Goal
Keep selected secrets encrypted in the note file while allowing an explicit, short-lived reveal in Obsidian Reading View and a controlled editor workflow.

## Threat Model
Protect against plaintext exposure through vault sync, backups, accidental file inspection, malformed ciphertext, plugin errors, and ordinary plugin reload/mobile lifecycle events. Do not claim protection from malware, a compromised OS account, or an attacker who can inspect a live Obsidian process while a secret is revealed.

## Proposed Data Flow
1. Identify one complete block in the editor.
2. Validate that the selection is not already encrypted or ambiguous.
3. Encrypt in memory and verify the envelope by decrypting it before replacement.
4. Replace the selection with ciphertext in one editor transaction.
5. Render a neutral lock marker in Reading View.
6. On explicit reveal, decrypt into a short-lived modal state.
7. Clear modal text, references, and key access on close, lock, timeout, unload, and vault change.

## Format Requirements
- Include a format version and algorithm identifiers.
- Include random per-block salt and nonce.
- Include authenticated ciphertext and required KDF parameters.
- Keep hints optional and non-sensitive; never expose password-derived labels.
- Define behavior for unknown versions, oversized blocks, invalid base64, duplicate markers, and truncated input.
- Decide whether associated data binds to a stable block identifier; do not bind to mutable file paths without a rename strategy.

## Key Lifecycle
- Reject empty passwords at the crypto API boundary.
- Prefer non-extractable Web Crypto keys in memory over retaining raw passwords.
- Scope cached keys to the current vault and plugin instance.
- Default to a short expiry, with explicit lock and forget-all commands.
- Clear references on plugin unload, vault change, mobile background, and reveal close.

## Failure Rules
- Encryption failure leaves the editor selection unchanged.
- Decryption failure leaves the note unchanged and reveals nothing.
- Save or sync errors never write the original plaintext as a fallback.
- No rename-before-write or plaintext temporary file in the inline path.
- Any partial or unknown block is treated as ordinary text only after an explicit user-visible warning, never silently rewritten.

## Test Plan
- Round-trip, wrong-password, tampered-tag, truncated-envelope, and random-input tests.
- Unicode, multiline, CRLF, Markdown code-block, and adjacent-block tests.
- Parser fuzz/property tests for marker ambiguity and nesting.
- Editor transaction tests where crypto, replacement, or save throws.
- Session expiry, lock, unload, vault switch, and mobile background tests.
- Desktop and Android smoke tests with sync enabled and offline operation.

## Deferred Decisions
- KDF parameters must be benchmarked on representative Android hardware before being fixed.
- A formal block identifier and associated-data policy require portability testing across rename, sync, and export workflows.
- Clipboard clearing cannot be guaranteed across all operating systems; the UX must state that copied plaintext is outside plugin control.
