import { parseManifest, type Manifest } from "./manifest";
import type { VerifyResult } from "./verifyUtils";

export type Trust = "self-declared" | "verified";

export interface InspectorRow {
  label: string;
  value: string;
  trust: Trust;
}

/**
 * Lists manifest fields and says which are only self-declared and which were confirmed by the most
 * recent verification of this same signature. A manifest can never vouch for itself.
 */
export function inspectManifest(text: string, verification?: VerifyResult): { manifest: Manifest; rows: InspectorRow[]; confirmed: boolean } {
  const manifest = parseManifest(text);
  const confirmed = verification?.status === "valid" && verification.signatureB64 === manifest.signature.value;
  const row = (label: string, value: string, verified = false): InspectorRow => ({ label, value, trust: confirmed && verified ? "verified" : "self-declared" });
  const sig = manifest.signature;
  const rows: InspectorRow[] = [
    row("Document filename", manifest.document.filename),
    row("Document size", `${manifest.document.size} bytes`, verification?.documentSize === manifest.document.size),
    row("Document hash algorithm", manifest.document.hashAlgorithm, true),
    row("Document hash", manifest.document.hash, verification?.recalculatedHash === manifest.document.hash),
    row("Signature algorithm", sig.algorithm, true),
    ...(sig.modulusLength ? [row("RSA modulus", `${sig.modulusLength} bits`, true)] : []),
    ...(sig.curve ? [row("ECDSA curve", sig.curve, true)] : []),
    ...(sig.saltLength !== undefined ? [row("PSS salt length", `${sig.saltLength} bytes`, true)] : []),
    ...(sig.hashAlgorithm ? [row("Signature hash algorithm", sig.hashAlgorithm, true)] : []),
    row("Signature format", sig.format),
    row("Signature encoding", sig.encoding),
    row("Signature length", `${atobLength(sig.value)} bytes`, true),
    row("Public key fingerprint (SHA-256)", manifest.signer.publicKeyFingerprint, verification?.keyFingerprint === manifest.signer.publicKeyFingerprint),
    row("Signed at", manifest.metadata.createdAt),
  ];
  return { manifest, rows, confirmed };
}

function atobLength(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}
