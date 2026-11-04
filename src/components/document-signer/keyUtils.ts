import { spkiFingerprint } from "@/lib/crypto/fingerprint";
import { derToPem, parseSupportedKeyPem } from "@/lib/crypto/pem";
import { toArrayBuffer } from "@/lib/crypto/base64";
import { ALGORITHMS, algorithmById, keyAlgorithm, type AlgorithmId, type AlgorithmInfo } from "./algorithms";

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
  const params = info.family === "RSA-PSS"
    ? { name: "RSA-PSS", modulusLength: info.modulusLength!, publicExponent: new Uint8Array([1, 0, 1]), hash: DEFAULT_HASH }
    : { name: "ECDSA", namedCurve: info.namedCurve! };
  const pair = await crypto.subtle.generateKey(params, true, ["sign", "verify"]);
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
  try {
    const key = await crypto.subtle.importKey(format, buffer, keyAlgorithm(algorithmById("RSA-PSS-2048"), DEFAULT_HASH), true, usages);
    const bits = (key.algorithm as RsaHashedKeyAlgorithm).modulusLength;
    const match = ALGORITHMS.find((a) => a.family === "RSA-PSS" && a.modulusLength === bits);
    if (!match) throw new Error(`RSA ${bits}-bit keys are not supported. Use 2048 or 3072 bits.`);
    return match;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RSA ")) throw error;
    throw new Error("This key is not a supported type. Supported: RSA 2048/3072 (used with RSA-PSS) and ECDSA P-256/P-384.");
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
  } else if (clean.kty === "RSA") {
    info = algorithmById("RSA-PSS-2048");
  } else {
    throw new Error(`JWK key type "${String(clean.kty)}" is not supported. Use RSA or EC.`);
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

/** Import a PEM (PKCS#8 / SPKI) or JWK key pasted as text. */
export async function importKeyText(text: string, name = ""): Promise<KeyRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste a PEM or JWK key first.");
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch { throw new Error("The JWK is not valid JSON."); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The JWK must be a JSON object.");
    return recordFromJwk(parsed as Record<string, unknown>, name);
  }
  const { kind, der } = parseSupportedKeyPem(trimmed);
  return recordFromDer(kind, der, name);
}

export function exportPublicPem(record: KeyRecord): string {
  return derToPem("PUBLIC KEY", record.spki);
}

export function exportPrivatePem(record: KeyRecord): string {
  if (!record.pkcs8) throw new Error("This entry has no private key.");
  return derToPem("PRIVATE KEY", record.pkcs8);
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
