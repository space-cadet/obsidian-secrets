import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;

const candidates = process.argv.slice(2).length > 0
  ? process.argv.slice(2).map(Number)
  : [600_000, 900_000, 1_200_000, 1_500_000, 2_000_000];
const password = new TextEncoder().encode("benchmark-only-password");
const salt = new TextEncoder().encode("benchmark-only-salt");
const passwordKey = await crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]);

const results = [];
for (const iterations of candidates) {
  const start = performance.now();
  await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, passwordKey, 256);
  results.push({ iterations, milliseconds: Math.round((performance.now() - start) * 100) / 100 });
}

console.log(JSON.stringify({ runtime: "Node", results }, null, 2));
