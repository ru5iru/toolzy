import { pemToBuf } from "./pem";

const PUBLIC_FIELDS = ["kty", "n", "e", "crv", "x", "y"];
const PRIVATE_FIELDS = [...PUBLIC_FIELDS, "d", "p", "q", "dp", "dq", "qi"];

/**
 * Import a key given as PEM (SPKI for verify, PKCS#8 for sign) or JWK JSON.
 * JWK `alg`, `use` and `key_ops` are ignored so the same key works across RS/PS algorithms.
 * A private JWK is accepted for verification by dropping its private fields.
 */
export async function importKeyInput(
  text: string,
  algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams,
  usage: "sign" | "verify",
): Promise<CryptoKey> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(trimmed); } catch { throw new Error("The JWK is not valid JSON."); }
    const wanted = usage === "sign" ? PRIVATE_FIELDS : PUBLIC_FIELDS;
    const jwk: Record<string, unknown> = {};
    for (const field of wanted) if (typeof parsed[field] === "string") jwk[field] = parsed[field];
    if (usage === "sign" && typeof jwk.d !== "string") throw new Error("This JWK has no private part (d). Paste a private JWK to sign.");
    return crypto.subtle.importKey("jwk", jwk as JsonWebKey, algorithm, false, [usage]);
  }
  return crypto.subtle.importKey(usage === "sign" ? "pkcs8" : "spki", pemToBuf(trimmed), algorithm, false, [usage]);
}
