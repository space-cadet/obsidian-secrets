# Project Brief
*Last Updated: 2026-08-12 12:18:38 IST*

## Project Overview
**Project Name**: Obsidian Secrets
**Description**: A safe, simple, secure inline-encryption plugin for Obsidian notes, designed for desktop and Android use.

## Objectives
1. Keep encrypted inline blocks as ciphertext on disk and during vault sync.
2. Reveal plaintext only after an explicit user action and keep the reveal lifecycle short.
3. Make failure behavior fail-closed, testable, and understandable before implementation expands.

## Key Features
- Versioned inline encrypted-block format with authenticated encryption.
- Explicit reveal, copy, lock, and forget-key operations.
- Desktop and Android support using Obsidian APIs and Web Crypto.

## Tech Stack
- **Language**: TypeScript
- **Framework**: Obsidian plugin API
- **Database**: None for the plugin; mb-core SQLite mirror for project Memory Bank records
- **Other tools**: Web Crypto API, Node.js, mb-core, GitHub Actions

## Constraints & Requirements
- Never write plaintext as a fallback after an encryption or save error.
- Do not require a server, cloud KMS, or platform-specific desktop secret store for core operation.
- Do not store passwords or plaintext in vault files, plugin settings, logs, or debug output.
- Keep the first implementation inline-only; whole-note conversion is out of scope.

## Success Metrics
- Every supported encryption failure leaves the original ciphertext or editor content unchanged.
- Parser, crypto, lifecycle, and mobile-background tests pass before a release candidate.
- An independent security review finds no open high-severity findings.

## Repository
**URL**: To be created as a public GitHub repository during project setup.

## Team/Contributors
- Deepak: Project owner
- Codex: Design and implementation collaborator
