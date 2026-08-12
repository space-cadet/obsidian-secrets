# Session Key Service Design
*Created: 2026-08-12 21:30:00 IST*
*Last Updated: 2026-08-12 21:30:00 IST*

## Ownership
Owned by **T1**. The sidebar Vault tab (T3) calls this service but does not own key material.

## Purpose
Manage the vault master key lifecycle: derive a non-extractable key from the user's password, cache it in memory, and guarantee cleanup on lock, timeout, unload, vault change, or mobile background.

## Design

### API
```typescript
class SessionKeyService {
  // Derive and cache a non-extractable master key. Returns true on success.
  async unlock(password: string, vaultSalt: Uint8Array, iterations: number): Promise<boolean>;

  // Explicitly clear the cached key and all references.
  lock(): void;

  // Returns true if a master key is currently cached.
  isUnlocked(): boolean;

  // Returns the cached master key for block-key derivation, or null if locked.
  // The key itself is non-extractable; only Web Crypto operations can use it.
  getMasterKey(): CryptoKey | null;

  // Configure auto-lock timeout in minutes. 0 = no timeout.
  setTimeout(minutes: number): void;

  // Register a callback for lock events (explicit, timeout, unload, etc.)
  onLock(callback: () => void): () => void;
}
```

### Key Derivation
1. Import password as raw PBKDF2 key material.
2. Derive 256 bits using PBKDF2-HMAC-SHA-256 with the vault salt and configured iterations.
3. Import the derived bits as a non-extractable `CryptoKey` for HKDF.
4. Store only the `CryptoKey` handle. Never store the raw derived bits or password.

### Security Invariants
- The cached key has `extractable: false`.
- The password string is zeroed/overwritten after derivation (best effort in JS).
- `lock()` clears the key reference and notifies all registered callbacks.
- No plaintext, ciphertext, or key material is ever logged.

### Lifecycle Events That Trigger `lock()`
1. **Explicit user action**: Vault tab "Lock" button or command.
2. **Timeout**: Configurable inactivity timer (default: 15 minutes).
3. **Plugin unload**: `onunload` event.
4. **Vault change**: User switches to a different vault.
5. **Mobile background**: App moves to background ( Obsidian mobile lifecycle).

### Failure Modes
- **Wrong password**: `unlock()` returns false; no key is cached.
- **Already unlocked**: Calling `unlock()` when already unlocked re-derives and replaces the key (supports password change).
- **Web Crypto unavailable**: Throws `CryptoError`.

## Integration Points
- **T1 (crypto.ts)**: `SessionKeyService` uses `deriveBlockKey` logic adapted for vault-scoped master keys.
- **T3 (SecretsSidebarView.ts)**: Vault tab calls `unlock()`/`lock()`/`isUnlocked()` and displays state.
- **Editor adapter (future)**: Will call `getMasterKey()` to derive per-block keys for encrypt/decrypt.

## Files
- `src/session/SessionKeyService.ts`: Implementation.
- `test/session-key.test.mjs`: Lifecycle and security tests.

## Deferred
- Clipboard clearing after reveal is platform-dependent; documented as limitation.
- KDF iteration count benchmarking on OnePlus Nord 4 is pending.
