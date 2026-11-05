import { spkiFingerprint } from "@/lib/crypto/fingerprint";
import { derToPem, parseSupportedKeyPem } from "@/lib/crypto/pem";
import { toArrayBuffer } from "@/lib/crypto/base64";
import { decryptPkcs8, encryptPkcs8 } from "@/lib/crypto/pkcs8Encrypted";
import { ALGORITHMS, algorithmById, isEd25519Supported, keyAlgorithm, type AlgorithmId, type AlgorithmInfo } from "./algorithms";

/**
 * A key held in memory only. Plain bytes (no CryptoKey) so records can be posted to a worker
 * and are re-imported as non-extractable keys for each sign or verify operation.
 */
export interface KeyRecord {
  id: string;
  name: string;
  algorithm: AlgorithmId;
  /** SPKI DER of the public key. Always present. */
  spki: Uint8Array;
  /** PKCS#8 DER of the private key. Present only when a private key is held. */
  pkcs8?: Uint8Array;
  fingerprint: string;
  createdAt: string;
  source: "generated" | "imported";
  /**
   * Non-extractable private-key handles, keyed by hash name ("any" when the algorithm does not bind a hash).
   * Present on keys restored from device storage, where no private bytes exist.
   */
  privateKeys?: Partial<Record<string, CryptoKey>>;
  /** True when this key is saved on this device (IndexedDB). */
  persisted?: boolean;
}

/** True when the record can sign, either from private bytes or from stored handles. */
export function hasPrivateKey(record: Pick<KeyRecord, "pkcs8" | "privateKeys">): boolean {
  return Boolean(record.pkcs8 || record.privateKeys);
}

const ALL_HASHES = ["SHA-256", "SHA-384", "SHA-512"] as const;

/**
 * Import non-extractable private-key handles from PKCS#8. RSA-PSS binds the hash when a key is
 * imported, so one handle is made per hash; other algorithms need a single handle.
 */
export async function makePrivateHandles(record: Pick<KeyRecord, "algorithm" | "pkcs8">): Promise<Record<string, CryptoKey>> {
  if (!record.pkcs8) throw new Error("This entry has no private key.");
  const info = algorithmById(record.algorithm);
  const buffer = toArrayBuffer(record.pkcs8);
  if (info.family !== "RSA-PSS") return { any: await crypto.subtle.importKey("pkcs8", buffer, keyAlgorithm(info, DEFAULT_HASH), false, ["sign"]) };
  const handles: Record<string, CryptoKey> = {};
  for (const hash of ALL_HASHES) handles[hash] = await crypto.subtle.importKey("pkcs8", buffer, keyAlgorithm(info, hash), false, ["sign"]);
  return handles;
}

const DEFAULT_HASH = "SHA-256" as const;
const PUBLIC_JWK_FIELDS = ["kty", "n", "e", "crv", "x", "y"] as const;
const PRIVATE_JWK_FIELDS = [...PUBLIC_JWK_FIELDS, "d", "p", "q", "dp", "dq", "qi"] as const;

function newId(): string {
  return crypto.randomUUID();
}

async function buildRecord(
  info: AlgorithmInfo,
  spki: Uint8Array,
  pkcs8: Uint8Array | undefined,
  name: string,
  source: KeyRecord["source"],
): Promise<KeyRecord> {
  return {
    id: newId(),
    name: name.trim() || `${info.label} key`,
    algorithm: info.id,
    spki,
    pkcs8,
    fingerprint: await spkiFingerprint(spki),
    createdAt: new Date().toISOString(),
    source,
  };
}

export async function generateKeyRecord(algorithmId: AlgorithmId, name = ""): Promise<KeyRecord> {
  const info = algorithmById(algorithmId);
  if (info.family === "Ed25519" && !(await isEd25519Supported())) {
    throw new Error("This browser does not support Ed25519. Choose ECDSA or RSA-PSS instead.");
  }
  const params = info.family === "RSA-PSS"
    ? { name: "RSA-PSS", modulusLength: info.modulusLength!, publicExponent: new Uint8Array([1, 0, 1]), hash: DEFAULT_HASH }
    : info.family === "ECDSA" ? { name: "ECDSA", namedCurve: info.namedCurve! } : { name: "Ed25519" };
  const pair = (await crypto.subtle.generateKey(params, true, ["sign", "verify"])) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return buildRecord(info, spki, pkcs8, name, "generated");
}

/** Identify which supported algorithm a DER key uses by attempting an import. */
async function detectAlgorithm(format: "spki" | "pkcs8", der: Uint8Array): Promise<AlgorithmInfo> {
  const usages: KeyUsage[] = format === "spki" ? ["verify"] : ["sign"];
  const buffer = toArrayBuffer(der);
  for (const info of ALGORITHMS.filter((a) => a.family === "ECDSA")) {
    try {
      await crypto.subtle.importKey(format, buffer, keyAlgorithm(info, DEFAULT_HASH), true, usages);
      return info;
    } catch { /* try the next curve */ }
  }
  if (await isEd25519Supported()) {
    try {
      await crypto.subtle.importKey(format, buffer, keyAlgorithm(algorithmById("Ed25519"), DEFAULT_HASH), true, usages);
      return algorithmById("Ed25519");
    } catch { /* not an Ed25519 key */ }
  }
  try {
    const key = await crypto.subtle.importKey(format, buffer, keyAlgorithm(algorithmById("RSA-PSS-2048"), DEFAULT_HASH), true, usages);
    const bits = (key.algorithm as RsaHashedKeyAlgorithm).modulusLength;
    const match = ALGORITHMS.find((a) => a.family === "RSA-PSS" && a.modulusLength === bits);
    if (!match) throw new Error(`RSA ${bits}-bit keys are not supported. Use 2048, 3072 or 4096 bits.`);
    return match;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RSA ")) throw error;
    throw new Error("This key is not a supported type. Supported: RSA 2048/3072/4096 (used with RSA-PSS), ECDSA P-256/P-384 and Ed25519.");
  }
}

function pickFields(source: Record<string, unknown>, fields: readonly string[]): JsonWebKey {
  const out: Record<string, unknown> = {};
  for (const field of fields) if (typeof source[field] === "string") out[field] = source[field];
  return out as JsonWebKey;
}

/** Derive the public SPKI from a private key via its JWK, since Web Crypto cannot do it directly. */
async function publicSpkiFromPrivate(info: AlgorithmInfo, pkcs8: Uint8Array): Promise<Uint8Array> {
  const privateKey = await crypto.subtle.importKey("pkcs8", toArrayBuffer(pkcs8), keyAlgorithm(info, DEFAULT_HASH), true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const publicJwk = pickFields(jwk as Record<string, unknown>, PUBLIC_JWK_FIELDS);
  const publicKey = await crypto.subtle.importKey("jwk", publicJwk, keyAlgorithm(info, DEFAULT_HASH), true, ["verify"]);
  return new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
}

async function recordFromDer(kind: "private" | "public", der: Uint8Array, name: string): Promise<KeyRecord> {
  if (kind === "public") {
    const info = await detectAlgorithm("spki", der);
    return buildRecord(info, der, undefined, name, "imported");
  }
  const info = await detectAlgorithm("pkcs8", der);
  const spki = await publicSpkiFromPrivate(info, der);
  return buildRecord(info, spki, der, name, "imported");
}

async function recordFromJwk(jwk: Record<string, unknown>, name: string): Promise<KeyRecord> {
  const isPrivate = typeof jwk.d === "string";
  const clean = pickFields(jwk, isPrivate ? PRIVATE_JWK_FIELDS : PUBLIC_JWK_FIELDS);
  let info: AlgorithmInfo | undefined;
  if (clean.kty === "EC") {
    info = ALGORITHMS.find((a) => a.namedCurve === clean.crv);
    if (!info) throw new Error(`Curve "${String(clean.crv)}" is not supported. Use P-256 or P-384.`);
  } else if (clean.kty === "OKP") {
    if (clean.crv !== "Ed25519") throw new Error(`Curve "${String(clean.crv)}" is not supported. Only Ed25519 is supported for OKP keys.`);
    if (!(await isEd25519Supported())) throw new Error("This browser does not support Ed25519.");
    info = algorithmById("Ed25519");
  } else if (clean.kty === "RSA") {
    info = algorithmById("RSA-PSS-2048");
  } else {
    throw new Error(`JWK key type "${String(clean.kty)}" is not supported. Use RSA, EC or OKP (Ed25519).`);
  }
  let der: Uint8Array;
  try {
    const key = await crypto.subtle.importKey("jwk", clean, keyAlgorithm(info, DEFAULT_HASH), true, [isPrivate ? "sign" : "verify"]);
    der = new Uint8Array(await crypto.subtle.exportKey(isPrivate ? "pkcs8" : "spki", key));
  } catch {
    throw new Error("The JWK could not be imported. Check that its fields are complete and valid.");
  }
  return recordFromDer(isPrivate ? "private" : "public", der, name);
}

/** Thrown when an encrypted key is imported without a password, so the UI can ask for one. */
export class PasswordRequiredError extends Error {
  constructor() { super("This key is encrypted. Enter its password to import it."); this.name = "PasswordRequiredError"; }
}

/** True when the pasted text is an encrypted PKCS#8 PEM. */
export function isEncryptedKeyText(text: string): boolean {
  return /-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(text);
}

/** Import a PEM (PKCS#8 / encrypted PKCS#8 / SPKI) or JWK key pasted as text. */
export async function importKeyText(text: string, name = "", password = ""): Promise<KeyRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste a PEM or JWK key first.");
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch { throw new Error("The JWK is not valid JSON."); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The JWK must be a JSON object.");
    return recordFromJwk(parsed as Record<string, unknown>, name);
  }
  const { kind, der } = parseSupportedKeyPem(trimmed);
  if (kind === "encrypted") {
    if (!password) throw new PasswordRequiredError();
    return recordFromDer("private", await decryptPkcs8(der, password), name);
  }
  return recordFromDer(kind, der, name);
}

export function exportPublicPem(record: KeyRecord): string {
  return derToPem("PUBLIC KEY", record.spki);
}

export function exportPrivatePem(record: KeyRecord): string {
  if (!record.pkcs8) throw new Error("This entry has no private key.");
  return derToPem("PRIVATE KEY", record.pkcs8);
}

/** PKCS#8 private key encrypted with a password (PBES2: PBKDF2-HMAC-SHA256 + AES-256-CBC). */
export async function exportEncryptedPrivatePem(record: KeyRecord, password: string): Promise<string> {
  if (!record.pkcs8) throw new Error("This entry has no private key.");
  return derToPem("ENCRYPTED PRIVATE KEY", await encryptPkcs8(record.pkcs8, password));
}

export async function exportJwk(record: KeyRecord, includePrivate: boolean): Promise<string> {
  const info = algorithmById(record.algorithm);
  const useDer = includePrivate && record.pkcs8 ? { format: "pkcs8" as const, der: record.pkcs8, usage: "sign" as const } : { format: "spki" as const, der: record.spki, usage: "verify" as const };
  if (includePrivate && !record.pkcs8) throw new Error("This entry has no private key.");
  const key = await crypto.subtle.importKey(useDer.format, toArrayBuffer(useDer.der), keyAlgorithm(info, DEFAULT_HASH), true, [useDer.usage]);
  const jwk = pickFields(await crypto.subtle.exportKey("jwk", key) as Record<string, unknown>, PRIVATE_JWK_FIELDS);
  return JSON.stringify(jwk, null, 2);
}

/** True when the private key in `privateRecord` belongs to the public key `spki`. */
export function keysMatch(privateRecord: KeyRecord, spki: Uint8Array): boolean {
  if (privateRecord.spki.length !== spki.length) return false;
  let diff = 0;
  for (let i = 0; i < spki.length; i++) diff |= privateRecord.spki[i] ^ spki[i];
  return diff === 0;
}
