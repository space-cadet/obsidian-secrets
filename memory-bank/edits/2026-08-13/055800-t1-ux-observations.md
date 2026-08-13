#### 05:58 IST - T1: UX observations from real-world testing
- **Created** `memory-bank/ux-observations-2026-08-13.md` documenting 7 issues found during testing session
- Key findings:
  - Modal decryption wrong for short secrets (should be inline)
  - 200-char overhead for 10-char plaintext (format designed for large blocks)
  - Auto-lock 15 min default annoying (fixed to 0)
  - Unlock button type="button" failed on mobile (fixed to type="submit")
  - Live Preview showed nothing (fixed with MarkdownPostProcessor)
  - History not persisted (fixed with disk save)
  - Updater intermittent failures on mobile
