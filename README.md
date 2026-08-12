# Obsidian Secrets

Safe, simple, secure inline encryption for Obsidian notes.

This repository is currently in the design and validation phase. The first milestone is an inline-only plugin for desktop and Android that keeps encrypted blocks as ciphertext in the vault and reveals plaintext only after an explicit user action.

## Security direction

- Web Crypto authenticated encryption with a versioned format.
- No network service and no plaintext fallback on encryption or save errors.
- Short-lived, vault-scoped in-memory key access.
- Explicit lock and forget-key controls.
- Pure parser and crypto tests before Obsidian UI integration.

The project is not yet ready for production secrets. The design must be implemented, tested on desktop and Android, and independently reviewed before use with important credentials.

Project planning records are in [`memory-bank/`](memory-bank/README.md).
