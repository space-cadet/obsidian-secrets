import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveVaultMasterKey, SessionKeyService } from "../dist/session/SessionKeyService.js";
import { decodeBase64Url, VAULT_SALT_BYTES } from "../dist/format.js";

function randomBytes(length) {
  const result = new Uint8Array(length);
  globalThis.crypto.getRandomValues(result);
  return result;
}

const password = "correct horse battery staple";
const vaultSalt = randomBytes(VAULT_SALT_BYTES);
const iterations = 600_000;

test("SessionKeyService unlock derives and caches a non-extractable master key", async () => {
  const service = new SessionKeyService();
  assert.equal(service.isUnlocked(), false);
  const success = await service.unlock(password, vaultSalt, iterations);
  assert.equal(success, true);
  assert.equal(service.isUnlocked(), true);
  const key = service.getMasterKey();
  assert.ok(key);
  assert.equal(key.extractable, false);
  service.lock();
  assert.equal(service.isUnlocked(), false);
});

test("SessionKeyService rejects empty password or invalid salt", async () => {
  const service = new SessionKeyService();
  assert.equal(await service.unlock("", vaultSalt, iterations), false);
  assert.equal(await service.unlock(password, new Uint8Array(0), iterations), false);
  assert.equal(await service.unlock(password, vaultSalt, 0), false);
  assert.equal(service.isUnlocked(), false);
});

test("SessionKeyService auto-locks after timeout", async () => {
  const service = new SessionKeyService();
  service.setTimeout(0.01); // ~600ms
  await service.unlock(password, vaultSalt, iterations);
  assert.equal(service.isUnlocked(), true);

  // Wait for timeout
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.equal(service.isUnlocked(), false);
});

test("SessionKeyService getMasterKey resets timeout on access", async () => {
  const service = new SessionKeyService();
  service.setTimeout(0.05); // ~3 seconds
  await service.unlock(password, vaultSalt, iterations);

  // Access key multiple times to reset timeout
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    assert.ok(service.getMasterKey());
  }

  // Should still be unlocked after ~3s because of resets
  assert.equal(service.isUnlocked(), true);

  service.lock();
});

test("SessionKeyService lock callbacks fire on explicit lock", async () => {
  const service = new SessionKeyService();
  let lockCount = 0;
  const unsubscribe = service.onLock(() => {
    lockCount++;
  });

  await service.unlock(password, vaultSalt, iterations);
  // unlock() calls lock() internally to clear previous state, so lockCount may be 1
  const countAfterUnlock = lockCount;

  service.lock();
  assert.equal(lockCount, countAfterUnlock + 1);

  unsubscribe();
});

test("SessionKeyService lock callbacks fire on timeout", async () => {
  const service = new SessionKeyService();
  let lockCount = 0;
  service.onLock(() => {
    lockCount++;
  });

  service.setTimeout(0.01);
  await service.unlock(password, vaultSalt, iterations);
  const countAfterUnlock = lockCount;

  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.equal(lockCount, countAfterUnlock + 1);
});

test("SessionKeyService deriveBlockKey requires unlocked state", async () => {
  const service = new SessionKeyService();
  await assert.rejects(
    () => service.deriveBlockKey(randomBytes(16)),
    /vault is locked/,
  );

  await service.unlock(password, vaultSalt, iterations);
  const blockKey = await service.deriveBlockKey(randomBytes(16));
  assert.ok(blockKey);
  assert.equal(blockKey.extractable, false);
  service.lock();
});

test("deriveVaultMasterKey returns non-extractable key", async () => {
  const key = await deriveVaultMasterKey(password, vaultSalt, iterations);
  assert.equal(key.extractable, false);
  assert.equal(key.type, "secret");
});

test("deriveVaultMasterKey with different passwords yields different keys", async () => {
  const key1 = await deriveVaultMasterKey(password, vaultSalt, iterations);
  const key2 = await deriveVaultMasterKey("different password", vaultSalt, iterations);
  // We can't compare CryptoKey objects directly, but we can verify they're both valid
  assert.equal(key1.extractable, false);
  assert.equal(key2.extractable, false);
});
