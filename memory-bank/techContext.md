# Technical Context
*Last Updated: 2026-08-12 14:09:25 IST*

## Initial Technical Direction
- TypeScript targeting the Obsidian plugin API.
- Web Crypto API for AES-GCM and password-based derivation.
- No custom cryptographic primitive implementation.
- No network calls in the plugin runtime.
- No plaintext persistence in `loadData`, settings, local storage, or vault files.
- The first UI slice uses the Obsidian `ItemView` API and native DOM construction; it is registered but never auto-opened.
- UI placeholders must be explicit about unavailable functionality and must clear password input without retaining it.

## Format Questions To Resolve Before Coding
- Exact versioned envelope fields and canonical serialization.
- KDF choice and parameters that are practical on Android without weakening the threat model.
- Whether optional associated data should bind a block to a stable identifier while preserving safe renames and sync portability.
- Marker grammar that cannot be confused with ordinary Markdown or nested markers.
- Migration policy if the format changes.

## Required Test Layers
- Crypto known-answer and round-trip tests.
- Format parser property/fuzz tests for malformed input and Unicode.
- Editor transaction tests for success, corruption, concurrent changes, and thrown save operations.
- Session-key tests for timeout, lock, unload, vault changes, and mobile lifecycle events.
- Android and desktop smoke tests with real Obsidian builds.
