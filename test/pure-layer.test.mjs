import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptBlock, encryptBlock } from "../dist/crypto.js";
import { countBlockMarkers, FormatError, parseBlock, parseSingleBlock } from "../dist/format.js";

const password = "correct horse battery staple";

test("round trips Unicode and multiline plaintext", async () => {
  const plaintext = "秘密 🔐\nsecond line\r\nthird line";
  const marker = await encryptBlock(plaintext, password, { iterations: 600_000 });
  assert.equal(await decryptBlock(marker, password), plaintext);
  assert.equal(marker.includes(plaintext), false);
  assert.equal(marker.includes(password), false);
});

test("round trips an empty plaintext without persisting it", async () => {
  const marker = await encryptBlock("", password, { iterations: 600_000 });
  assert.equal(await decryptBlock(marker, password), "");
});

test("rejects empty passwords", async () => {
  await assert.rejects(() => encryptBlock("secret", ""));
  const marker = await encryptBlock("secret", password, { iterations: 600_000 });
  await assert.rejects(() => decryptBlock(marker, ""));
});

test("wrong passwords and tampered ciphertext fail closed", async () => {
  const marker = await encryptBlock("secret", password, { iterations: 600_000 });
  await assert.rejects(() => decryptBlock(marker, "wrong password"), /could not be decrypted/);
  const encoded = marker.slice("<!-- obsidian-secrets:v1:".length, -" -->".length);
  const last = encoded.at(-1);
  const replacement = last === "A" ? "B" : "A";
  const tampered = `${marker.slice(0, -" -->".length - 1)}${replacement} -->`;
  await assert.rejects(() => decryptBlock(tampered, password));
});

test("rejects truncated, non-canonical, and unknown envelopes", async () => {
  const marker = await encryptBlock("secret", password, { iterations: 600_000 });
  const encoded = marker.slice("<!-- obsidian-secrets:v1:".length, -" -->".length);
  const truncated = `<!-- obsidian-secrets:v1:${encoded.slice(0, -2)} -->`;
  assert.throws(() => parseBlock(truncated), FormatError);
  assert.throws(() => parseBlock(`${marker} extra`), FormatError);
  assert.throws(() => parseBlock("<!-- obsidian-secrets:v1:not valid -->"), FormatError);
});

test("requires exactly one complete marker for a selection", async () => {
  const first = await encryptBlock("one", password, { iterations: 600_000 });
  const second = await encryptBlock("two", password, { iterations: 600_000 });
  assert.equal(countBlockMarkers(`${first}\n${second}`), 2);
  assert.throws(() => parseSingleBlock("ordinary text"), FormatError);
  assert.throws(() => parseSingleBlock(`${first}\n${second}`), FormatError);
  assert.doesNotThrow(() => parseSingleBlock(first));
});

test("rejects unsafe KDF iteration counts", async () => {
  const marker = await encryptBlock("secret", password, { iterations: 600_000 });
  const encoded = marker.slice("<!-- obsidian-secrets:v1:".length, -" -->".length);
  const json = JSON.parse(Buffer.from(encoded.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"));
  json.iter = 1;
  const unsafe = Buffer.from(JSON.stringify(json)).toString("base64url");
  assert.throws(() => parseBlock(`<!-- obsidian-secrets:v1:${unsafe} -->`), FormatError);
});
