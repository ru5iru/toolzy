import { bytesToBase64 } from "@/lib/crypto/base64";
import { digestHex } from "@/lib/crypto/fingerprint";
import { algorithmById, isHashName, type HashName } from "./algorithms";
import type { KeyRecord } from "./keyUtils";
import { manifestSignatureBytes, validateFileSize, verifyBytes } from "./signingUtils";
import type { Manifest } from "./manifest";

export type VerifyStatus = "valid" | "invalid" | "modified" | "missing" | "error";

export interface VerifyDocumentInput {
  data?: Uint8Array;
  /** Detached signature bytes from a .sig file. Takes precedence over the manifest's value. */
  signature?: Uint8Array;
  manifest?: Manifest;
  /** Public key (a pair works too; only the public part is used). */
  key?: Pick<KeyRecord, "spki" | "algorithm" | "fingerprint">;
  /** Hash to use when no manifest supplies one. */
  hash?: HashName;
}

export interface VerifyResult {
  status: VerifyStatus;
  message: string;
  warnings: string[];
  recalculatedHash?: string;
  hashAlgorithm?: HashName;
  /** Base64 of the signature that was checked, so the Inspector can tell which manifest it matches. */
  signatureB64?: string;
  keyFingerprint?: string;
  documentSize?: number;
}

const result = (status: VerifyStatus, message: string, rest: Partial<VerifyResult> = {}): VerifyResult => ({ status, message, warnings: [], ...rest });

export async function verifyDocument(input: VerifyDocumentInput): Promise<VerifyResult> {
  const { data, manifest, key } = input;
  const missing: string[] = [];
  if (!data) missing.push("the original document");
  const signature = input.signature ?? (manifest ? safeManifestSignature(manifest) : undefined);
  if (!signature) missing.push("a signature (.sig file or manifest)");
  if (!key) missing.push("a public key");
  if (!data || !signature || !key) return result("missing", `Missing ${missing.join(", ")}.`);

  try {
    validateFileSize(data.length);
  } catch (error) {
    return result("error", error instanceof Error ? error.message : "The document could not be read.");
  }

  const hash: HashName = isHashName(manifest?.signature.hashAlgorithm) ? manifest.signature.hashAlgorithm : input.hash ?? "SHA-256";
  const warnings: string[] = [];
  const signatureB64 = bytesToBase64(signature);
  const base = { warnings, hashAlgorithm: hash, signatureB64, keyFingerprint: key.fingerprint, documentSize: data.length };

  // The manifest's hash is a claim: always recalculate from the document bytes.
  const hashForManifest = isHashName(manifest?.document.hashAlgorithm) ? manifest.document.hashAlgorithm : hash;
  const recalculatedHash = await digestHex(data, hashForManifest);
  let manifestSaysModified = false;
  if (manifest) {
    if (recalculatedHash !== manifest.document.hash) manifestSaysModified = true;
    if (data.length !== manifest.document.size) manifestSaysModified = true;
    if (key.fingerprint !== manifest.signer.publicKeyFingerprint) {
      warnings.push("The supplied public key's fingerprint differs from the one declared in the manifest.");
    }
    const info = algorithmById(key.algorithm);
    if (manifest.signature.algorithm !== info.family) {
      warnings.push(`The manifest declares ${manifest.signature.algorithm}, but the supplied key is ${info.label}. The key's type was used.`);
    }
    if (input.signature && bytesToBase64(input.signature) !== manifest.signature.value) {
      warnings.push("The .sig file differs from the signature value inside the manifest. The .sig file was used.");
    }
  }

  let valid: boolean;
  try {
    valid = await verifyBytes(data, signature, key.spki, key.algorithm, hash);
  } catch (error) {
    const detail = error instanceof Error && /Malformed|does not match this curve/.test(error.message)
      ? `${error.message.replace(/\.$/, "")}. The signature may have been made with a different key type or curve.`
      : "The signature or key could not be processed. Check that the key type matches the signature.";
    return result("error", detail, { ...base, recalculatedHash });
  }

  if (valid) {
    if (manifestSaysModified) warnings.push("The signature is valid for this document, but the manifest's recorded hash or size does not match it. The manifest is stale or was edited.");
    return result("valid", "Signature is valid for this document and public key. This does not prove who holds the key.", { ...base, recalculatedHash });
  }
  if (manifestSaysModified) {
    return result("modified", "The document differs from what the manifest says was signed (hash or size changed), and the signature does not verify.", { ...base, recalculatedHash });
  }
  return result("invalid", "Signature verification failed. The signature, document or public key does not match.", { ...base, recalculatedHash });
}

function safeManifestSignature(manifest: Manifest): Uint8Array | undefined {
  try {
    return manifestSignatureBytes(manifest);
  } catch {
    return undefined;
  }
}
