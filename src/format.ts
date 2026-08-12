export const FORMAT_VERSION = 1 as const;
export const ALGORITHM = "A256GCM" as const;
export const KDF = "PBKDF2-SHA-256" as const;
export const MIN_ITERATIONS = 600_000;
export const MAX_ITERATIONS = 2_000_000;
export const VAULT_SALT_BYTES = 16;
export const BLOCK_SALT_BYTES = 16;
export const IV_BYTES = 12;
export const GCM_TAG_BYTES = 16;

const MARKER_PREFIX = "<!-- obsidian-secrets:v1:";
const MARKER_SUFFIX = " -->";
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export type Envelope = {
  v: 1;
  alg: typeof ALGORITHM;
  kdf: typeof KDF;
  iter: number;
  vs: string;
  bs: string;
  iv: string;
  ct: string;
};

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function fromUtf8(value: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(value);
}

export function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function decodeBase64Url(value: string, field: string): Uint8Array {
  if (!BASE64URL.test(value) || value.length % 4 === 1) {
    throw new FormatError(`${field} is not canonical base64url`);
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new FormatError(`${field} is not valid base64url`);
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (encodeBase64Url(bytes) !== value) {
    throw new FormatError(`${field} is not canonical base64url`);
  }
  return bytes;
}

function headerFromEnvelope(envelope: Envelope): Omit<Envelope, "ct"> {
  return {
    v: envelope.v,
    alg: envelope.alg,
    kdf: envelope.kdf,
    iter: envelope.iter,
    vs: envelope.vs,
    bs: envelope.bs,
    iv: envelope.iv,
  };
}

export function canonicalHeader(envelope: Envelope): string {
  return JSON.stringify(headerFromEnvelope(envelope));
}

export function serializeEnvelope(envelope: Envelope): string {
  validateEnvelope(envelope);
  const json = JSON.stringify(envelope);
  return `${MARKER_PREFIX}${encodeBase64Url(utf8(json))}${MARKER_SUFFIX}`;
}

function assertExactKeys(value: Record<string, unknown>): void {
  const expected = ["v", "alg", "kdf", "iter", "vs", "bs", "iv", "ct"];
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new FormatError("envelope fields are not canonical");
  }
}

export function validateEnvelope(value: unknown): asserts value is Envelope {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FormatError("envelope must be an object");
  }
  const envelope = value as Record<string, unknown>;
  assertExactKeys(envelope);
  if (envelope.v !== FORMAT_VERSION || envelope.alg !== ALGORITHM || envelope.kdf !== KDF) {
    throw new FormatError("unsupported envelope version or algorithm");
  }
  if (typeof envelope.iter !== "number" || !Number.isInteger(envelope.iter) || envelope.iter < MIN_ITERATIONS || envelope.iter > MAX_ITERATIONS) {
    throw new FormatError("unsafe KDF iteration count");
  }
  for (const field of ["vs", "bs", "iv", "ct"] as const) {
    if (typeof envelope[field] !== "string") throw new FormatError(`${field} must be a string`);
  }
  const vs = envelope.vs as string;
  const bs = envelope.bs as string;
  const iv = envelope.iv as string;
  const ct = envelope.ct as string;
  if (decodeBase64Url(vs, "vs").byteLength !== VAULT_SALT_BYTES) throw new FormatError("vs has the wrong length");
  if (decodeBase64Url(bs, "bs").byteLength !== BLOCK_SALT_BYTES) throw new FormatError("bs has the wrong length");
  if (decodeBase64Url(iv, "iv").byteLength !== IV_BYTES) throw new FormatError("iv has the wrong length");
  if (decodeBase64Url(ct, "ct").byteLength < GCM_TAG_BYTES) throw new FormatError("ct is truncated");
}

export function parseBlock(marker: string): Envelope {
  const match = /^<!-- obsidian-secrets:v1:([A-Za-z0-9_-]+) -->$/u.exec(marker);
  if (!match) throw new FormatError("input is not one complete encrypted block");
  const encoded = match[1];
  let value: unknown;
  try {
    value = JSON.parse(fromUtf8(decodeBase64Url(encoded, "envelope")));
  } catch (error) {
    if (error instanceof FormatError) throw error;
    throw new FormatError("envelope JSON is invalid");
  }
  validateEnvelope(value);
  if (encodeBase64Url(utf8(JSON.stringify(value))) !== encoded) {
    throw new FormatError("envelope JSON is not canonical");
  }
  return value;
}

export function parseSingleBlock(input: string): Envelope {
  const matches = input.match(/<!-- obsidian-secrets:v1:[A-Za-z0-9_-]+ -->/gu) ?? [];
  if (matches.length !== 1 || matches[0] !== input) {
    throw new FormatError("selection must contain exactly one complete encrypted block");
  }
  return parseBlock(input);
}

export function countBlockMarkers(input: string): number {
  return (input.match(/<!-- obsidian-secrets:v1:/gu) ?? []).length;
}
