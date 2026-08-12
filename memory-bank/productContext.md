# Product Context
*Last Updated: 2026-08-12 12:18:38 IST*

## User Problem
API keys, tokens, and other credentials are often kept in plaintext notes because that is convenient across desktop and Android. A useful solution must preserve that convenience without silently placing plaintext into synced vault files.

## Intended User Experience
- Select a secret and encrypt it in place.
- Reading View shows a neutral locked marker, not the secret.
- The user explicitly reveals a block, copies it if needed, and locks it again.
- The user can forget all session keys immediately.
- Wrong passwords, malformed blocks, sync conflicts, and save failures produce visible errors without replacing ciphertext with plaintext.

## Non-Goals
- No password manager, cloud synchronization service, or remote key server.
- No automatic secret rotation or credential lifecycle management.
- No whole-note encryption in the first milestone.
- No claim of security against a compromised running Obsidian process or malware with access to process memory.

## Trust Boundary
The vault and its sync/backup destinations are treated as untrusted for plaintext confidentiality. The running Obsidian process, the operating-system account, and the user-entered password are trusted within the stated threat model.
