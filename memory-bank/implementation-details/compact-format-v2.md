# Compact v2 Block Format Specification
*Created: 2026-08-13 11:34:00 IST*
*Last Updated: 2026-08-13 11:34:00 IST*

## Motivation

The v1 format has ~180 bytes of fixed overhead per block:
- Envelope metadata (version, algorithm, KDF): ~40 chars
- Vault salt (`vs`): ~22 chars
- Block salt (`bs`): ~22 chars
- IV (`iv`): ~16 chars
- GCM tag overhead in base64: ~24 chars
- HTML comment wrapper: ~9 chars

For a 10-character secret, the marker is ~200 bytes — 95% overhead. This is unacceptable for API keys, tokens, and short passwords. A compact format is needed.

## Design Goals

1. **Dramatically reduce overhead**: Target < 40 bytes fixed overhead.
2. **Maintain security**: Same AES-256-GCM encryption, same key derivation strength.
3. **Backward compatibility**: v1 blocks remain readable forever.
4. **Simple parsing**: Unambiguous marker grammar, no nesting issues.

## Proposed v2 Format

### Marker Grammar

```
<!-- 🔒:<base64url(v2-envelope)> -->
```

Where `v2-envelope` is a compact binary structure (not JSON), base64url-encoded.

### Binary Envelope Structure

| Field | Size | Description |
|-------|------|-------------|
| Magic | 1 byte | `0x02` — version identifier |
| Flags | 1 byte | Reserved (algorithm, KDF hints) |
| Iterations | 4 bytes | PBKDF2 iteration count (uint32 BE) |
| IV | 12 bytes | AES-GCM nonce |
| Ciphertext + Tag | variable | AES-256-GCM ciphertext with 16-byte auth tag |

**Total fixed overhead**: 1 + 1 + 4 + 12 = 18 bytes binary → ~24 bytes base64url.
**Plus HTML comment wrapper**: `<!-- 🔒:` + `-->` = 11 chars.
**Total marker overhead**: ~35 bytes (vs ~180 for v1).

### Key Derivation (v2)

Since the vault salt is already stored in plugin settings, v2 does not repeat it per block.

```
vaultSalt = from settings (16 bytes, already stored)
masterKey = PBKDF2(password, vaultSalt, iterations)  // same as v1

// Per-block key derivation (no per-block salt needed)
blockKey = HKDF-SHA256(masterKey, salt=iv, info="obsidian-secrets/v2/block-key")
```

Using the IV as the HKDF salt is safe because:
1. The IV is random and never reused for the same masterKey.
2. HKDF's `salt` parameter does not need to be secret — it only needs to be unique.
3. This saves 16 bytes of per-block salt.

### Associated Data (v2)

The AES-GCM associated data is the compact envelope header (everything except ciphertext):

```
associatedData = concat([magic(1), flags(1), iterations(4), iv(12)])
```

This binds the ciphertext to the exact parameters used for encryption.

### Format Comparison

| Secret Length | v1 Marker Size | v2 Marker Size | v1 Overhead | v2 Overhead |
|---------------|----------------|----------------|-------------|-------------|
| 10 chars | ~200 bytes | ~55 bytes | ~190 bytes | ~45 bytes |
| 50 chars | ~250 bytes | ~95 bytes | ~200 bytes | ~45 bytes |
| 200 chars | ~420 bytes | ~310 bytes | ~220 bytes | ~110 bytes |
| 1000 chars | ~1250 bytes | ~1380 bytes | ~250 bytes | ~380 bytes |

**Note**: v2 is optimized for short secrets. For long text (>500 chars), v1 and v2 are comparable. The plugin should use v2 by default for all new blocks.

## Open Decisions

### 1. Block Identity for Associated Data

Should v2 bind to the note path to prevent cut-paste attacks between notes?

- **Option A**: No binding. Simple, portable, but allows cut-paste between notes.
- **Option B**: Bind to note path hash. Prevents cut-paste, but breaks on rename.
- **Option C**: Bind to a user-defined label. Adds UI complexity.

**Current leaning**: Option A for simplicity. Cut-paste between notes is not a critical threat for this use case (attacker needs the password either way).

### 2. Iteration Count Storage

Should v2 store the iteration count per block, or assume a global default?

- **Per-block**: Allows gradual migration to higher iteration counts. Adds 4 bytes.
- **Global**: Assumes all blocks use the same iteration count (stored in settings). Saves 4 bytes but prevents per-block tuning.

**Current leaning**: Per-block (4 bytes) for flexibility. The iteration count may need to change if the user's device changes.

### 3. Algorithm Identification

The `flags` byte can encode:
- Algorithm (AES-256-GCM = 0x00)
- KDF (PBKDF2-SHA-256 = 0x00)
- Reserved bits for future extensions

This allows v2 to evolve without breaking backward compatibility.

## Implementation Plan

See `memory-bank/tasks/T5.md` for the implementation task breakdown.

## Backward Compatibility

- v1 markers: `<!-- obsidian-secrets:v1:<base64url> -->`
- v2 markers: `<!-- 🔒:<base64url> -->`

The distinct prefix (`obsidian-secrets:v1:` vs `🔒:`) makes unambiguous detection trivial. The parser can branch on the prefix:

```typescript
if (marker.includes("obsidian-secrets:v1:")) {
  return parseV1(marker);
} else if (marker.includes("🔒:")) {
  return parseV2(marker);
}
```

## References

- Task file: `memory-bank/tasks/T5.md`
- v1 format spec: `memory-bank/implementation-details/inline-encryption-design.md`
- Overhead analysis: `memory-bank/techContext.md` (Format Observations From Testing)
