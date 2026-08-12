# System Patterns
*Last Updated: 2026-08-12 14:09:25 IST*

## Core Architecture
1. A pure format/parser layer identifies complete encrypted blocks and rejects ambiguous or malformed markers.
2. A pure crypto layer performs password-based key derivation, authenticated encryption, decryption, and format validation.
3. A session-key layer owns non-extractable in-memory keys, expiry, explicit lock, vault scoping, and unload cleanup.
4. A thin Obsidian adapter owns explicitly opened sidebar UI, editor transactions, and Reading View rendering.
5. Sidebar tabs are presentation boundaries; they do not own passwords, plaintext, ciphertext, or session keys.

## Security Invariants
- The on-disk representation of a valid encrypted block contains no plaintext secret.
- Encryption failure never falls back to writing the input plaintext.
- Decryption failure never changes the editor or vault file.
- Empty passwords are rejected by the crypto boundary and by the UI.
- Plaintext is cleared from reveal UI state on hide, close, cancel, and lock.
- Passwords, plaintext, ciphertext, and key material are never logged.

## Lifecycle Pattern
The default state is locked. A reveal creates the smallest possible temporary plaintext state. Lock, timeout, plugin unload, vault change, and mobile background events clear that state and invalidate session access.

## Change Pattern
Encryption and explicit decrypt-in-place use one editor transaction. The plugin verifies the generated envelope before replacing the selected range. It does not rename files or perform multi-step plaintext file conversion in the core path.
