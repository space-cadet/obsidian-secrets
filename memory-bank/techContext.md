# Technical Context
*Last Updated: 2026-08-13 11:34:00 IST*

## Initial Technical Direction
- TypeScript targeting the Obsidian plugin API.
- Web Crypto API for AES-GCM and password-based derivation.
- No custom cryptographic primitive implementation.
- No network calls in the plugin runtime.
- No plaintext persistence in `loadData`, settings, local storage, or vault files.
- The first UI slice uses the Obsidian `ItemView` API and native DOM construction; it is registered but never auto-opened.
- UI placeholders must be explicit about unavailable functionality and must clear password input without retaining it.

## Redesign Decisions (2026-08-13)

### Path A: Sidebar Simplification
After review, the 4-tab sidebar (Vault, Blocks, History, Settings) was deemed too heavy for a simple encrypt/decrypt workflow. The redesign collapses it to a single unified Vault Status panel:
- Vault lock status always visible.
- Quick actions (Encrypt/Decrypt selection) shown only when unlocked.
- Block count auto-detected from current note and shown in status bar.
- History and Settings become links/modals, not tabs.
- The Blocks tab is removed entirely; block discovery moves to inline editor markers and status bar.

See `memory-bank/implementation-details/sidebar-redesign-path-a.md` for full rationale.

### Path B Deferred
Inline decrypt-and-edit with auto-re-encrypt on lock/timeout/switch is deferred to a future iteration. It requires significant editor widget work and lifecycle testing.

## Format Observations From Testing (2026-08-13)

### Overhead Analysis
The current v1 format has ~180 bytes of fixed overhead per block regardless of plaintext size:
- Envelope metadata (version, algorithm, KDF): ~40 chars
- Vault salt: ~22 chars
- Block salt: ~22 chars
- IV: ~16 chars
- Ciphertext + GCM tag: ~30 chars (for 10-char input, scales linearly)
- Base64 encoding overhead
- HTML comment wrapper: ~9 chars

**Impact**: 
- 10-char secret → ~200 char marker (95% overhead) — unacceptable for API keys
- 1000-char paragraph → ~1200 char marker (~15% overhead) — acceptable

**Conclusion**: Format is optimized for long-form encrypted notes, not short secrets. A different approach (single vault-wide salt, minimal per-block metadata) would be needed for secret storage use case.

## Format Questions — Resolved / In Progress

### v1 Format
- ✅ Exact versioned envelope fields and canonical serialization — defined in `src/format.ts`.
- ✅ KDF choice and parameters — PBKDF2-SHA-256, 600K iterations (pending Android benchmark).
- ✅ Associated data policy — binds to canonical header (all fields except `ct`), no file path binding.
- ✅ Marker grammar — HTML comment `<!-- obsidian-secrets:v1:<base64url> -->`, unambiguous.
- ✅ Migration policy — versioned format, no migration required yet.

### v2 Compact Format (Planned — see T5)
- Goal: Reduce per-block overhead from ~180 bytes to ~35 bytes for short secrets.
- Approach: Compact binary envelope (not JSON), vault-wide salt from settings, IV as HKDF salt.
- Marker: `<!-- 🔒:<base64url(v2-envelope)> -->`
- Backward compatibility: v1 and v2 detected by distinct prefixes; v1 remains readable forever.
- Open questions: Whether to bind associated data to note path (deferred to T5).

See `memory-bank/implementation-details/compact-format-v2.md` for full specification.

## Required Test Layers
- Crypto known-answer and round-trip tests.
- Format parser property/fuzz tests for malformed input and Unicode.
- Editor transaction tests for success, corruption, concurrent changes, and thrown save operations.
- Session-key tests for timeout, lock, unload, vault changes, and mobile lifecycle events.
- Android and desktop smoke tests with real Obsidian builds.
