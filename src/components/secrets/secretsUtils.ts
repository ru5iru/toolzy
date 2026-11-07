import { bytesToBase64, bytesToBase64Url, bytesToHex } from "@/lib/crypto/base64";

export type SecretFormat = "hex" | "base64" | "base64url";
export const FORMATS: { value: SecretFormat; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "base64", label: "Base64" },
  { value: "base64url", label: "Base64URL" },
];

export const MIN_BYTES = 1;
export const MAX_BYTES = 1024;
export const MAX_COUNT = 50;

export interface SecretPreset {
  id: string;
  label: string;
  bytes: number;
  format: SecretFormat;
  note: string;
}

export const PRESETS: SecretPreset[] = [
  { id: "hs256", label: "JWT HS256 secret", bytes: 32, format: "base64url", note: "HMAC keys should be at least as long as the hash output: 256 bits for HS256 (RFC 7518)." },
  { id: "hs384", label: "JWT HS384 secret", bytes: 48, format: "base64url", note: "384 bits, matching the SHA-384 output length." },
  { id: "hs512", label: "JWT HS512 secret", bytes: 64, format: "base64url", note: "512 bits, matching the SHA-512 output length." },
  { id: "aes128", label: "AES-128 key", bytes: 16, format: "hex", note: "A raw 128-bit key. Use a fresh random IV or nonce for every encryption." },
  { id: "aes256", label: "AES-256 key", bytes: 32, format: "hex", note: "A raw 256-bit key. Use a fresh random IV or nonce for every encryption." },
  { id: "token", label: "API token", bytes: 32, format: "base64url", note: "256 bits of randomness in a URL-safe form. Store only a hash of it server-side." },
  { id: "session", label: "Session / cookie secret", bytes: 48, format: "base64", note: "Used to sign or encrypt sessions. Rotate it if it ever leaks." },
];

export interface GenerateOptions {
  bytes: number;
  count: number;
  format: SecretFormat;
}

type RandomFill = (buffer: Uint8Array) => Uint8Array;

function encode(bytes: Uint8Array, format: SecretFormat): string {
  if (format === "hex") return bytesToHex(bytes);
  return format === "base64" ? bytesToBase64(bytes) : bytesToBase64Url(bytes);
}

export function validateOptions({ bytes, count }: Pick<GenerateOptions, "bytes" | "count">): void {
  if (!Number.isInteger(bytes) || bytes < MIN_BYTES || bytes > MAX_BYTES) {
    throw new Error(`Length must be a whole number of bytes from ${MIN_BYTES} to ${MAX_BYTES}.`);
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`Count must be a whole number from 1 to ${MAX_COUNT}.`);
  }
}

/** Random secrets from the browser's CSPRNG. `fill` is injectable for tests only. */
export function generateSecrets(
  options: GenerateOptions,
  fill: RandomFill = (b) => {
    b.set(crypto.getRandomValues(new Uint8Array(b.byteLength)));
    return b;
  },
): string[] {
  validateOptions(options);
  return Array.from({ length: options.count }, () => encode(fill(new Uint8Array(options.bytes)), options.format));
}

export const entropyBits = (bytes: number): number => bytes * 8;
