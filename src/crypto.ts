import {
  ALGORITHM,
  BLOCK_SALT_BYTES,
  canonicalHeader,
  decodeBase64Url,
  encodeBase64Url,
  Envelope,
  FORMAT_VERSION,
  GCM_TAG_BYTES,
  IV_BYTES,
  KDF,
  MIN_ITERATIONS,
  parseSingleBlock,
  serializeEnvelope,
  validateEnvelope,
  VAULT_SALT_BYTES,
} from "./format.js";

const HKDF_INFO = new TextEncoder().encode("obsidian-secrets/v1/block-key");

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export class DecryptionError extends CryptoError {
  constructor() {
    super("encrypted block could not be decrypted");
    this.name = "DecryptionError";
  }
}

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) throw new CryptoError("Web Crypto is unavailable");
  return globalThis.crypto.subtle;
}

// TypeScript 5.9 models Uint8Array as potentially backed by SharedArrayBuffer,
// while Web Crypto's DOM declarations still require an ArrayBuffer-backed view.
function asBufferSource(value: Uint8Array): BufferSource {
  return value as unknown as BufferSource;
}

function randomBytes(length: number): Uint8Array {
  const result = new Uint8Array(length);
  globalThis.crypto?.getRandomValues(result);
  if (result.every((value) => value === 0)) throw new CryptoError("secure randomness is unavailable");
  return result;
}

function requirePassword(password: string): void {
  if (typeof password !== "string" || password.length === 0) {
    throw new CryptoError("password must not be empty");
  }
}

async function deriveBlockKey(password: string, envelope: Pick<Envelope, "iter" | "vs" | "bs">): Promise<CryptoKey> {
  const api = subtle();
  const passwordKey = await api.importKey("raw", asBufferSource(new TextEncoder().encode(password)), "PBKDF2", false, ["deriveBits"]);
  const masterBits = await api.deriveBits(
    { name: "PBKDF2", salt: asBufferSource(decodeBase64Url(envelope.vs, "vs")), iterations: envelope.iter, hash: "SHA-256" },
    passwordKey,
    256,
  );
  const masterKey = await api.importKey("raw", masterBits, "HKDF", false, ["deriveKey"]);
  return api.deriveKey(
    { name: "HKDF", salt: asBufferSource(decodeBase64Url(envelope.bs, "bs")), hash: "SHA-256", info: asBufferSource(HKDF_INFO) },
    masterKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type EncryptOptions = {
  vaultSalt?: Uint8Array;
  iterations?: number;
};

export async function encryptBlock(plaintext: string, password: string, options: EncryptOptions = {}): Promise<string> {
  requirePassword(password);
  const vaultSalt = options.vaultSalt ? new Uint8Array(options.vaultSalt) : randomBytes(VAULT_SALT_BYTES);
  if (vaultSalt.byteLength !== VAULT_SALT_BYTES) throw new CryptoError("vault salt has the wrong length");
  const iterations = options.iterations ?? MIN_ITERATIONS;
  const envelopeWithoutCiphertext: Envelope = {
    v: FORMAT_VERSION,
    alg: ALGORITHM,
    kdf: KDF,
    iter: iterations,
    vs: encodeBase64Url(vaultSalt),
    bs: encodeBase64Url(randomBytes(BLOCK_SALT_BYTES)),
    iv: encodeBase64Url(randomBytes(IV_BYTES)),
    ct: encodeBase64Url(new Uint8Array(GCM_TAG_BYTES)),
  };
  validateEnvelope(envelopeWithoutCiphertext);
  const key = await deriveBlockKey(password, envelopeWithoutCiphertext);
  const ciphertext = await subtle().encrypt(
    {
      name: "AES-GCM",
      iv: asBufferSource(decodeBase64Url(envelopeWithoutCiphertext.iv, "iv")),
      additionalData: asBufferSource(new TextEncoder().encode(canonicalHeader(envelopeWithoutCiphertext))),
      tagLength: 128,
    },
    key,
    asBufferSource(new TextEncoder().encode(plaintext)),
  );
  return serializeEnvelope({ ...envelopeWithoutCiphertext, ct: encodeBase64Url(new Uint8Array(ciphertext)) });
}

export async function decryptBlock(marker: string, password: string): Promise<string> {
  requirePassword(password);
  const envelope = parseSingleBlock(marker);
  try {
    const key = await deriveBlockKey(password, envelope);
    const plaintext = await subtle().decrypt(
      {
        name: "AES-GCM",
        iv: asBufferSource(decodeBase64Url(envelope.iv, "iv")),
        additionalData: asBufferSource(new TextEncoder().encode(canonicalHeader(envelope))),
        tagLength: 128,
      },
      key,
      asBufferSource(decodeBase64Url(envelope.ct, "ct")),
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    throw new DecryptionError();
  }
}
