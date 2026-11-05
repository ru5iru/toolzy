import { base64ToBytes, bytesToBase64, toArrayBuffer } from "./base64";

export type PemLabel =
  | "PRIVATE KEY"
  | "PUBLIC KEY"
  | "RSA PRIVATE KEY"
  | "RSA PUBLIC KEY"
  | "EC PRIVATE KEY"
  | "ENCRYPTED PRIVATE KEY"
  | "CERTIFICATE"
  | string;

const PEM_BLOCK = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/;

/** Returns the first PEM block's label and DER bytes, or throws a user-readable error. */
export function parsePem(pem: string): { label: PemLabel; der: Uint8Array } {
  const match = PEM_BLOCK.exec(pem.trim());
  if (!match) throw new Error("No PEM block found. Expected text starting with -----BEGIN … KEY-----.");
  try {
    return { label: match[1], der: base64ToBytes(match[2]) };
  } catch {
    throw new Error("The PEM body is not valid Base64.");
  }
}

/**
 * Parse a PEM key that Web Crypto can import directly (PKCS#8 private or SPKI public)
 * and explain unsupported variants instead of failing with a generic import error.
 */
export function parseSupportedKeyPem(pem: string): { kind: "private" | "public" | "encrypted"; der: Uint8Array } {
  const { label, der } = parsePem(pem);
  switch (label) {
    case "PRIVATE KEY":
      return { kind: "private", der };
    case "PUBLIC KEY":
      return { kind: "public", der };
    case "RSA PRIVATE KEY":
      throw new Error("This is a PKCS#1 key (BEGIN RSA PRIVATE KEY). Convert it first: openssl pkcs8 -topk8 -nocrypt -in key.pem -out key-pkcs8.pem");
    case "EC PRIVATE KEY":
      throw new Error("This is a SEC1 key (BEGIN EC PRIVATE KEY). Convert it first: openssl pkcs8 -topk8 -nocrypt -in key.pem -out key-pkcs8.pem");
    case "RSA PUBLIC KEY":
      throw new Error("This is a PKCS#1 public key (BEGIN RSA PUBLIC KEY). Convert it first: openssl rsa -RSAPublicKey_in -pubout");
    case "ENCRYPTED PRIVATE KEY":
      return { kind: "encrypted", der };
    default:
      throw new Error(`Unsupported PEM type "${label}". Use a PKCS#8 private key or an SPKI public key.`);
  }
}

export function derToPem(label: "PRIVATE KEY" | "PUBLIC KEY" | "ENCRYPTED PRIVATE KEY", der: Uint8Array): string {
  const b64 = bytesToBase64(der);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** Legacy helper used by JWT Hub: strips any PEM armor and returns the DER as an ArrayBuffer. */
export function pemToBuf(pem: string): ArrayBuffer {
  const stripped = pem.replace(/-----[^-]+-----/g, "");
  return toArrayBuffer(base64ToBytes(stripped));
}
