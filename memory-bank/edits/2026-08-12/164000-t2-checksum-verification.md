#### 16:40 IST - T2: Add SHA-256 checksum verification to updater

**Action**: Modified
**Files**:
- `src/updater/PluginUpdater.ts`
- `test/updater.test.mjs`
- `memory-bank/tasks/T2.md`
- `memory-bank/activeContext.md`

**Details**:
Added SHA-256 checksum verification to the PluginUpdater download flow:
- Added `sha256()` helper using Web Crypto API SubtleCrypto.digest
- Added `verifyChecksums()` method that downloads CHECKSUMS.txt release asset, parses it, and verifies each RELEASE_FILES entry
- Hard failure on missing checksums asset or any mismatch; temporary directory cleaned up
- Updated tests: refactored to per-test isolated requestUrl mocks, added tests for tampered assets and missing checksums
- All 17 tests pass (8 pure-layer + 9 updater tests)

**Verification**:
- `npm test` passes
- `git diff --check` clean
