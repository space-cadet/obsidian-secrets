# Design Retrospective — Obsidian Secrets Pause (2026-08-13)
*Created: 2026-08-13 20:45:00 IST*

## Context

After implementing T4 (sidebar simplification + mobile quick-unlock + context menu), user indicated dissatisfaction with the overall plugin design and chose to pause the project. This document captures the state and open design questions for when work resumes.

## What Was Delivered

1. **Unified sidebar panel** (T4.1–T4.6): Collapsed 4-tab layout to single vault status panel with quick actions.
2. **Quick-unlock modal** (T4.7): Password modal appears over editor, auto-resumes pending encrypt/decrypt. Fixes mobile selection-loss bug.
3. **Editor context menu** (T4.8): Long-press → "🔒 Encrypt" / "🔓 Decrypt" on mobile.
4. **Status bar widget**: Shows 🔒/🔓 + block count, clickable to open sidebar.
5. **v2 format spec** (T5): Designed compact binary envelope reducing overhead from ~180 bytes to ~35 bytes per block.

**Commit:** `801d8c0` on `main`.
**Tests:** 49/49 passing.

## What Remains

- T4.9: Device testing on OnePlus Nord 4 (not done)
- T5: Implement compact v2 format (spec written, code not written)
- Security review (was always planned pre-release)

## Open Design Concerns (from user)

The user is "not very satisfied with the plugin design as a whole." Specific concerns were not enumerated, but the design has accumulated complexity from iterative changes:

1. **Scope creep**: Started as inline-only encryption, grew sidebar, updater, history, export/import, mobile UX — each layer adds surface area.
2. **Plugin vs. use case mismatch**: The tool is simple (encrypt selection, decrypt click) but the plugin architecture became elaborate (vault abstraction, session keys, auto-lock, status bar, modals, context menus).
3. **Format tension**: v1 has ~180 byte overhead per block, making it unusable for API keys. v2 spec exists but isn't implemented — the format question should have been resolved before UI work.
4. **Mobile-first was an afterthought**: The initial design was desktop-centric. Mobile UX was retrofitted, not designed from the start.

## Recommendations for Restart

1. **Strip to essentials**: Consider whether the plugin needs a sidebar at all. A command-palette-only or context-menu-only approach might be simpler.
2. **Resolve format first**: Implement v2 before any more UI work. The format is the core value proposition.
3. **Re-evaluate the vault abstraction**: A single password per vault is convenient but adds complexity (salt management, session lifecycle, auto-lock). Could a per-block password model be simpler?
4. **Consider a different plugin model**: Instead of inline markers in Markdown, what about a dedicated encrypted-note type? Or a code-block fence (` ```secrets `)?

## State at Pause

- `main` branch: `801d8c0` — all T4 subtasks except device testing complete
- T3 (original 4-tab sidebar): paused, superseded by T4
- T4: implementation complete, paused pending design review
- T5: spec written, implementation pending
- T1 (crypto): complete, secure, tested
- T2 (updater): complete, separate concern, unaffected

## References

- `memory-bank/implementation-details/sidebar-redesign-path-a.md`
- `memory-bank/implementation-details/mobile-unlock-modal.md`
- `memory-bank/implementation-details/compact-format-v2.md`
- `memory-bank/implementation-details/inline-encryption-design.md`
