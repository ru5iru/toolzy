import { z } from "zod";
import { HASHES } from "./algorithms";

/**
 * Application-specific detached-signature manifest (version 1). This is not an
 * interoperable standard: use JWS or CMS when other software must consume the signature.
 * Every field here is self-declared; verification must always recalculate from the document bytes.
 */
export const manifestSchema = z.object({
  version: z.literal(1),
  document: z.object({
    filename: z.string().max(1024),
    size: z.number().int().nonnegative(),
    hashAlgorithm: z.enum(HASHES as [string, ...string[]]),
    hash: z.string().regex(/^[0-9a-f]+$/, "Document hash must be lowercase hex."),
  }),
  signature: z.object({
    algorithm: z.enum(["RSA-PSS", "ECDSA", "Ed25519"]),
    /** Absent for Ed25519, which signs the message directly. */
    hashAlgorithm: z.enum(HASHES as [string, ...string[]]).optional(),
    modulusLength: z.number().int().positive().optional(),
    curve: z.enum(["P-256", "P-384"]).optional(),
    saltLength: z.number().int().nonnegative().optional(),
    /** rsa-pss and ed25519: raw signature bytes. ecdsa-der: ASN.1 DER, the form OpenSSL uses. */
    format: z.enum(["rsa-pss", "ecdsa-der", "ed25519"]),
    encoding: z.literal("base64"),
    value: z.string().min(1),
  }),
  signer: z.object({ publicKeyFingerprint: z.string().min(1) }),
  metadata: z.object({ createdAt: z.string() }),
});

export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(text: string): Manifest {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("The manifest is not valid JSON.");
  }
  const result = manifestSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Invalid manifest: ${issue.path.join(".") || "root"} — ${issue.message}`);
  }
  return result.data;
}

export function manifestToText(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function signatureFileName(filename: string): string {
  return `${filename}.sig`;
}
export function manifestFileName(filename: string): string {
  return `${filename}.signature.json`;
}
