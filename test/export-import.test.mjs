import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractEncryptedBlocks,
  exportBlocksToBundle,
  serializeExportBundle,
  parseExportBundle,
  generateImportContent,
  ExportImportError,
} from "../dist/export/ExportImportService.js";
import { encryptBlock } from "../dist/crypto.js";

async function createTestBlock(plaintext, password) {
  return encryptBlock(plaintext, password);
}

test("extractEncryptedBlocks finds blocks in content", async () => {
  const password = "test-password";
  const block1 = await createTestBlock("secret 1", password);
  const block2 = await createTestBlock("secret 2", password);
  const content = `Some text\n\n${block1}\n\nMore text\n\n${block2}\n\nEnd`;

  const blocks = extractEncryptedBlocks(content);
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0].marker, block1);
  assert.strictEqual(blocks[1].marker, block2);
});

test("extractEncryptedBlocks returns empty array for no blocks", () => {
  const content = "Just plain text with no encrypted blocks.";
  const blocks = extractEncryptedBlocks(content);
  assert.deepStrictEqual(blocks, []);
});

test("extractEncryptedBlocks skips malformed markers", async () => {
  const password = "test-password";
  const block = await createTestBlock("secret", password);
  const content = `${block}\n\n<!-- obsidian-secrets:v1:INVALID -->\n\nMore text`;

  const blocks = extractEncryptedBlocks(content);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0].marker, block);
});

test("exportBlocksToBundle creates valid bundle", async () => {
  const password = "test-password";
  const block = await createTestBlock("secret", password);
  const blocks = [{ marker: block, envelope: (await import("../dist/format.js")).parseBlock(block) }];

  const bundle = exportBlocksToBundle(blocks, "test-note.md");
  assert.strictEqual(bundle.version, 1);
  assert.strictEqual(bundle.source, "test-note.md");
  assert.strictEqual(bundle.blocks.length, 1);
  assert.strictEqual(bundle.blocks[0].marker, block);
  assert.ok(typeof bundle.exportedAt === "string");
});

test("serializeExportBundle produces valid JSON", async () => {
  const password = "test-password";
  const block = await createTestBlock("secret", password);
  const blocks = [{ marker: block, envelope: (await import("../dist/format.js")).parseBlock(block) }];
  const bundle = exportBlocksToBundle(blocks, "test");

  const json = serializeExportBundle(bundle);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.blocks.length, 1);
});

test("parseExportBundle validates version", () => {
  assert.throws(
    () => parseExportBundle(JSON.stringify({ version: 2, exportedAt: "2024-01-01", source: "test", blocks: [] })),
    ExportImportError,
  );
});

test("parseExportBundle validates required fields", () => {
  assert.throws(() => parseExportBundle(JSON.stringify({ version: 1 })), ExportImportError);
  assert.throws(() => parseExportBundle(JSON.stringify({ version: 1, exportedAt: "2024", source: "test" })), ExportImportError);
});

test("parseExportBundle rejects invalid JSON", () => {
  assert.throws(() => parseExportBundle("not json"), ExportImportError);
});

test("parseExportBundle validates block markers", () => {
  const bundle = {
    version: 1,
    exportedAt: "2024-01-01",
    source: "test",
    blocks: [{ id: "1", marker: "invalid", createdAt: "2024" }],
  };
  assert.throws(() => parseExportBundle(JSON.stringify(bundle)), ExportImportError);
});

test("parseExportBundle accepts valid bundle", async () => {
  const password = "test-password";
  const block = await createTestBlock("secret", password);
  const blocks = [{ marker: block, envelope: (await import("../dist/format.js")).parseBlock(block) }];
  const bundle = exportBlocksToBundle(blocks, "test");
  const json = serializeExportBundle(bundle);

  const parsed = parseExportBundle(json);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.blocks.length, 1);
  assert.strictEqual(parsed.blocks[0].marker, block);
});

test("generateImportContent produces markers joined by newlines", async () => {
  const password = "test-password";
  const block1 = await createTestBlock("secret 1", password);
  const block2 = await createTestBlock("secret 2", password);
  const blocks = [
    { marker: block1, envelope: (await import("../dist/format.js")).parseBlock(block1) },
    { marker: block2, envelope: (await import("../dist/format.js")).parseBlock(block2) },
  ];
  const bundle = exportBlocksToBundle(blocks, "test");

  const content = generateImportContent(bundle);
  const lines = content.split("\n\n");
  assert.strictEqual(lines.length, 2);
  assert.strictEqual(lines[0], block1);
  assert.strictEqual(lines[1], block2);
});

test("extractEncryptedBlocks handles overlapping or adjacent blocks", async () => {
  const password = "test-password";
  const block1 = await createTestBlock("secret 1", password);
  const block2 = await createTestBlock("secret 2", password);
  const content = `${block1}${block2}`;

  const blocks = extractEncryptedBlocks(content);
  assert.strictEqual(blocks.length, 2);
});
