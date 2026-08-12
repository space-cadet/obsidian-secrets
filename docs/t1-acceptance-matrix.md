# T1 Acceptance Matrix

This matrix is the gate for the pure format and crypto layer before Obsidian editor integration.

## Format and crypto

| Area | Acceptance test | Required result |
| --- | --- | --- |
| Round trip | Encrypt and decrypt ASCII, Unicode, emoji, empty, and multiline text | Original text is returned exactly |
| Confidentiality boundary | Inspect the serialized marker | Plaintext and password are absent |
| Authentication | Flip one bit in `ct` or `iv` | Decryption fails and returns no plaintext |
| Wrong password | Decrypt with another non-empty password | Decryption fails without changing input |
| Truncation | Remove envelope bytes or the GCM tag | Parser or decryption fails closed |
| Canonical form | Reorder JSON keys or add an unknown field | Parser rejects the marker |
| Bounds | Use empty, fractional, too-small, or excessive `iter` | Parser rejects the marker |
| Base64url | Use padding, invalid characters, or non-canonical encoding | Parser rejects the marker |
| Selection ambiguity | Pass zero markers or two complete markers to single-block parsing | Parser rejects the selection |
| Portability | Encrypt with a vault salt and decrypt after changing surrounding note text | Decryption remains possible |

## Editor and persistence behavior

| Area | Acceptance test | Required result |
| --- | --- | --- |
| Encrypt failure | Crypto throws before replacement | Editor selection remains unchanged |
| Replacement failure | Editor transaction throws | No plaintext fallback is written |
| Save failure | Vault save throws after encryption | Existing ciphertext remains; no plaintext temporary file is created |
| Decrypt failure | Wrong password or corrupted block | Note and editor remain unchanged; reveal UI stays empty |
| Explicit reveal | User opens a valid block | Plaintext exists only in the reveal modal state |
| Close and cancel | User closes or cancels reveal | Modal text, references, and key access are cleared |
| Lock and timeout | User locks or reveal timeout expires | All session access is invalidated and plaintext is cleared |
| Vault change | Active vault changes | Session key and reveal state are cleared |
| Plugin unload | Plugin unloads | Session key, reveal state, and timers are cleared |
| Android background | App is backgrounded during reveal | Reveal is cleared and session is locked |

## Explicit non-goals for T1

- No whole-note encryption or rename/write conversion flow.
- No password recovery, server key escrow, or platform secret-store dependency.
- No direct decrypted editing in the note.
- No claim of protection against malware, a compromised OS account, or a process inspecting live memory while a secret is revealed.
