# Error Log
*Last Updated: 2026-08-12 12:25:00 IST*

## 2026-08-12

### MB-BOOT-1: Fresh database parser bootstrap
- **Task**: T1
- **Symptom**: The first task and session parser runs reported missing SQLite tables.
- **Cause**: The fresh database schema had not been initialized.
- **Attempted resolution**: Ran the generated `memory-bank/database/init-schema.js` tool.
- **Result**: The initializer split `schema.sql` on semicolons and skipped the first commented `CREATE TABLE` statement, then failed when creating its index (`edit_entries` was missing).
- **Impact**: Markdown records remain valid; SQLite mirror validation is deferred until the mb-core initializer/parser defect is repaired or a corrected schema bootstrap is approved.
