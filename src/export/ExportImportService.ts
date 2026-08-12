import { parseBlock, serializeEnvelope, type Envelope } from "../format.js";

export class ExportImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportImportError";
  }
}

export type EncryptedBlockEntry = {
  id: string;
  envelope: Envelope;
  marker: string;
  createdAt: string; // ISO timestamp of export
};

export type ExportBundle = {
  version: 1;
  exportedAt: string;
  source: string; // note path or "vault"
  blocks: EncryptedBlockEntry[];
};

export function extractEncryptedBlocks(content: string): Array<{ marker: string; envelope: Envelope }> {
  const blocks: Array<{ marker: string; envelope: Envelope }> = [];
  const pattern = /<!-- obsidian-secrets:v1:[A-Za-z0-9_-]+ -->/gu;
  const matches = content.match(pattern) ?? [];

  for (const marker of matches) {
    try {
      const envelope = parseBlock(marker);
      blocks.push({ marker, envelope });
    } catch {
      // Skip malformed blocks
    }
  }

  return blocks;
}

export function exportBlocksToBundle(
  blocks: Array<{ marker: string; envelope: Envelope }>,
  source: string,
): ExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    source,
    blocks: blocks.map((b, index) => ({
      id: `block-${index + 1}`,
      envelope: b.envelope,
      marker: b.marker,
      createdAt: new Date().toISOString(),
    })),
  };
}

export function serializeExportBundle(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function parseExportBundle(json: string): ExportBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ExportImportError("export file is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ExportImportError("export bundle must be an object");
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new ExportImportError(`unsupported export bundle version: ${String(obj.version)}`);
  }

  if (typeof obj.exportedAt !== "string" || typeof obj.source !== "string") {
    throw new ExportImportError("export bundle missing required fields");
  }

  if (!Array.isArray(obj.blocks)) {
    throw new ExportImportError("export bundle blocks must be an array");
  }

  const blocks: EncryptedBlockEntry[] = [];
  for (const raw of obj.blocks) {
    if (typeof raw !== "object" || raw === null) {
      throw new ExportImportError("each block must be an object");
    }
    const block = raw as Record<string, unknown>;
    if (typeof block.id !== "string" || typeof block.marker !== "string" || typeof block.createdAt !== "string") {
      throw new ExportImportError("block missing required fields");
    }
    try {
      const envelope = parseBlock(block.marker);
      blocks.push({ id: block.id, envelope, marker: block.marker, createdAt: block.createdAt });
    } catch {
      throw new ExportImportError(`block ${String(block.id)} has invalid marker format`);
    }
  }

  return { version: 1, exportedAt: obj.exportedAt, source: obj.source, blocks };
}

export function generateImportContent(bundle: ExportBundle): string {
  return bundle.blocks.map((b) => b.marker).join("\n\n");
}
