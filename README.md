# Obsidian Secrets

Safe, simple, secure inline encryption for Obsidian notes.

This repository is currently in the design and validation phase. The first milestone is an inline-only plugin for desktop and Android that keeps encrypted blocks as ciphertext in the vault and reveals plaintext only after an explicit user action.

## Security direction

- Web Crypto authenticated encryption with a versioned format.
- No network service and no plaintext fallback on encryption or save errors.
- Short-lived, vault-scoped in-memory key access.
- Explicit lock and forget-key controls.
- Pure parser and crypto tests precede the security-sensitive Obsidian integrations.

The project is not yet ready for production secrets. The design must be implemented, tested on desktop and Android, and independently reviewed before use with important credentials.

Project planning records are in [`memory-bank/`](memory-bank/README.md).

## Pure-layer prototype

The current prototype includes a presentation-only Obsidian sidebar shell while keeping encryption behavior independent of the UI:

- `src/format.ts` validates and serializes the canonical `v1` marker.
- `src/crypto.ts` derives a vault master key, derives a per-block key, and performs AES-256-GCM encryption/decryption through Web Crypto.
- `src/updater/PluginUpdater.ts` provides stable/dev release checks, direct-asset staging, manifest validation, transactional installation, and rollback without touching secret data.
- `src/ui/SecretsSidebarView.ts` provides explicitly opened Vault, Blocks, History, and Settings tabs. Unlock, editor integration, export/import, and history storage are not connected yet; updater settings persistence is implemented separately.
- `src/settings/SecretsSettingTab.ts` provides persisted stable/dev channel selection, optional notice-only startup checks, and an explicit update-check action that opens a confirmation modal before installation/reload.
- `test/pure-layer.test.mjs` covers round trips, Unicode, malformed input, tampering, wrong passwords, and unsafe KDF settings.
- `test/updater.test.mjs` covers stable/dev detection, commit-aware rolling releases, asset validation, download isolation, and rollback after partial writes.

Run the local checks with:

```sh
pnpm install
pnpm test
pnpm run benchmark:kdf
```

For the Android timing gate, open [`tools/kdf-benchmark.html`](tools/kdf-benchmark.html) on the representative phone. If the file URL is blocked by the browser, serve the repository locally and open `/tools/kdf-benchmark.html` over localhost or HTTPS. Record the phone model, Android version, browser version, and the measured results before fixing the final iteration count.

## Releases

[`build-release.yml`](.github/workflows/build-release.yml) uses pnpm and runs tests, bundles the plugin, creates the archive, and verifies the commit hash. Pushes to `main` publish or update the rolling prerelease tagged `dev`; version tags such as `v0.1.0` publish stable releases. Each release includes the direct updater assets, the plugin ZIP, and `CHECKSUMS.txt`.
