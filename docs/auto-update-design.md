# Auto-update design

The updater is a separate operational component. It does not receive passwords, plaintext, ciphertext, or session keys.

## Supported flow

1. Check the GitHub Releases API for the selected stable or rolling `dev` channel.
2. For `dev`, compare the embedded local commit hash with GitHub `main` so a rolling tag does not create perpetual update prompts.
3. Require direct HTTPS assets named `main.js`, `manifest.json`, and `styles.css`.
4. Download into a temporary directory inside the plugin folder.
5. Validate the downloaded manifest's plugin ID and release version.
6. Back up the current runtime files and install the staged files.
7. Restore the backup automatically if any write fails.
8. Keep the last successful backup available for explicit rollback.

The updater uses injected host functions so the production adapter can pass Obsidian's `requestUrl` and `vault.adapter`, while tests run without an Obsidian runtime.

## Safety rules

- A failed check or download does not modify the installed plugin.
- A partial installation is rolled back before the error is reported.
- Update state is stored under `.obsidian/plugins/obsidian-secrets/.backup` and contains only runtime files and file-presence metadata.
- No update error path logs or persists secret-plugin data.
- The updater does not silently install. The plugin shell now persists the selected stable/dev channel and an optional startup-check preference in Obsidian plugin settings. Startup checks only report available updates; installation, confirmation, reload, and artifact-integrity enforcement remain separate gates.

## Release contract

The pnpm release workflow at `.github/workflows/build-release.yml` publishes the three direct assets alongside the normal plugin archive. Stable tags use numeric versions; the rolling development release uses `dev` and embeds the source commit hash at build time. Each build also publishes a SHA-256 `CHECKSUMS.txt` manifest; updater-side enforcement remains a separate integrity gate before unattended installation.
