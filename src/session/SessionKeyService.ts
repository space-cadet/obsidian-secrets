import { CryptoError, deriveBlockKeyFromMaster, deriveVaultMasterKey } from "../crypto.js";

export { deriveVaultMasterKey, deriveBlockKeyFromMaster };

export class SessionKeyService {
  private masterKey: CryptoKey | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private lockCallbacks: Array<() => void> = [];
  private autoLockCallback?: () => void;
  private timeoutMinutes = 15;

  /**
   * Derive and cache a non-extractable vault master key.
   * Returns true on success, false if the password derivation fails (should not happen with valid inputs).
   */
  async unlock(password: string, vaultSalt: Uint8Array, iterations: number): Promise<boolean> {
    if (typeof password !== "string" || password.length === 0) {
      return false;
    }
    if (vaultSalt.byteLength === 0 || iterations < 1) {
      return false;
    }

    this.lock();

    try {
      this.masterKey = await deriveVaultMasterKey(password, vaultSalt, iterations);
    } catch {
      return false;
    }

    this.refreshTimeout();
    return true;
  }

  /**
   * Explicitly clear the cached key and all references.
   */
  lock(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.masterKey = null;
    // Notify callbacks (copy array to handle re-entrant registration)
    const callbacks = this.lockCallbacks.slice();
    for (const cb of callbacks) {
      try {
        cb();
      } catch {
        // Ignore callback errors
      }
    }
  }

  isUnlocked(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Returns the cached non-extractable master key, or null if locked.
   * Resets the auto-lock timeout on each access.
   */
  getMasterKey(): CryptoKey | null {
    this.refreshTimeout();
    return this.masterKey;
  }

  /**
   * Derive a per-block AES-GCM key from the cached master key.
   * Throws CryptoError if the vault is locked.
   */
  async deriveBlockKey(blockSalt: Uint8Array): Promise<CryptoKey> {
    const masterKey = this.getMasterKey();
    if (!masterKey) {
      throw new CryptoError("vault is locked");
    }
    return deriveBlockKeyFromMaster(masterKey, blockSalt);
  }

  /**
   * Set the auto-lock timeout in minutes. 0 disables auto-lock.
   */
  setTimeout(minutes: number): void {
    this.timeoutMinutes = Math.max(0, minutes);
    this.refreshTimeout();
  }

  /**
   * Set a callback that fires specifically on auto-lock (timeout-based).
   */
  onAutoLock(callback: () => void): () => void {
    this.autoLockCallback = callback;
    return () => {
      this.autoLockCallback = undefined;
    };
  }

  /**
   * Register a callback that fires when the vault locks (explicit, timeout, or via clear).
   * Returns an unsubscribe function.
   */
  onLock(callback: () => void): () => void {
    this.lockCallbacks.push(callback);
    return () => {
      const index = this.lockCallbacks.indexOf(callback);
      if (index !== -1) this.lockCallbacks.splice(index, 1);
    };
  }

  private refreshTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.masterKey !== null && this.timeoutMinutes > 0) {
      this.timeoutId = setTimeout(() => {
        this.autoLockCallback?.();
        this.lock();
      }, this.timeoutMinutes * 60 * 1000);
    }
  }
}
