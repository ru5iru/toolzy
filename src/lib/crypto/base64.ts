/** Shared byte/text encoding helpers. Pure functions, no React. */

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new Error("Not valid Base64 data.");
  }
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Accepts base64url with or without padding. */
export function base64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  return base64ToBytes(pad ? padded + "=".repeat(4 - pad) : padded);
}

/** ArrayBuffer view for crypto.subtle callers that want a standalone buffer. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[\s:]/g, "").toLowerCase();
  if (clean.length % 2 !== 0 || /[^0-9a-f]/.test(clean)) throw new Error("Not valid hexadecimal data.");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
