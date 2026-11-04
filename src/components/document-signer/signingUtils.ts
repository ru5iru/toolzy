import { base64ToBytes, bytesToBase64, toArrayBuffer } from "@/lib/crypto/base64";
import { ecdsaDerToRaw, ecdsaRawToDer } from "@/lib/crypto/ecdsa";
import { digestHex } from "@/lib/crypto/fingerprint";
import { algorithmById, HASH_BYTES, keyAlgorithm, signParams, usesSigningHash, type AlgorithmId, type HashName } from "./algorithms";
import type { KeyRecord } from "./keyUtils";
import { manifestToText, type Manifest } from "./manifest";

export const MAX_FILE_BYTES = 256 * 1024 * 1024;

export function validateFileSize(size: number): void {
  if (size === 0) throw new Error("The file is empty. Select a file with content to sign or verify.");
  if (size > MAX_FILE_BYTES) throw new Error("The file is larger than 256 MiB. Choose a smaller file.");
}

/** Signs `data`. ECDSA output is converted to DER so OpenSSL can verify it. */
export async function signBytes(data: Uint8Array, pkcs8: Uint8Array, algorithm: AlgorithmId, hash: HashName): Promise<Uint8Array> {
  const info = algorithmById(algorithm);
  const key = await crypto.subtle.importKey("pkcs8", toArrayBuffer(pkcs8), keyAlgorithm(info, hash), false, ["sign"]);
  const raw = new Uint8Array(await crypto.subtle.sign(signParams(info, hash), key, toArrayBuffer(data)));
  // RSA-PSS and Ed25519 signatures are the same bytes OpenSSL produces; ECDSA needs DER.
  return info.family === "ECDSA" ? ecdsaRawToDer(raw) : raw;
}

/** Verifies `signature` over `data`. ECDSA accepts DER or raw r||s. Throws on malformed input. */
export async function verifyBytes(data: Uint8Array, signature: Uint8Array, spki: Uint8Array, algorithm: AlgorithmId, hash: HashName): Promise<boolean> {
  const info = algorithmById(algorithm);
  const key = await crypto.subtle.importKey("spki", toArrayBuffer(spki), keyAlgorithm(info, hash), false, ["verify"]);
  let sig = signature;
  if (info.family === "ECDSA") {
    const coord = info.coordLength!;
    sig = signature.length === coord * 2 ? signature : ecdsaDerToRaw(signature, coord);
  }
  return crypto.subtle.verify(signParams(info, hash), key, toArrayBuffer(sig), toArrayBuffer(data));
}

export interface SignDocumentInput {
  data: Uint8Array;
  filename: string;
  key: KeyRecord;
  hash: HashName;
}

export interface SignDocumentResult {
  signature: Uint8Array;
  manifest: Manifest;
  manifestText: string;
  documentHash: string;
}

export async function signDocument({ data, filename, key, hash }: SignDocumentInput): Promise<SignDocumentResult> {
  if (!key.pkcs8) throw new Error("The selected key has no private part. Choose a key pair or import a private key.");
  validateFileSize(data.length);
  const info = algorithmById(key.algorithm);
  const documentHash = await digestHex(data, hash);
  const signature = await signBytes(data, key.pkcs8, key.algorithm, hash);
  const manifest: Manifest = {
    version: 1,
    document: { filename, size: data.length, hashAlgorithm: hash, hash: documentHash },
    signature: {
      algorithm: info.family,
      // Ed25519 hashes internally as part of the algorithm, so no signing hash is recorded for it.
      ...(usesSigningHash(info) ? { hashAlgorithm: hash } : {}),
      ...(info.family === "RSA-PSS" ? { modulusLength: info.modulusLength, saltLength: HASH_BYTES[hash] } : {}),
      ...(info.family === "ECDSA" ? { curve: info.namedCurve } : {}),
      format: info.family === "RSA-PSS" ? "rsa-pss" : info.family === "ECDSA" ? "ecdsa-der" : "ed25519",
      encoding: "base64",
      value: bytesToBase64(signature),
    },
    signer: { publicKeyFingerprint: key.fingerprint },
    metadata: { createdAt: new Date().toISOString() },
  };
  return { signature, manifest, manifestText: manifestToText(manifest), documentHash };
}

/** Decode the signature carried inside a manifest. */
export function manifestSignatureBytes(manifest: Manifest): Uint8Array {
  return base64ToBytes(manifest.signature.value);
}
