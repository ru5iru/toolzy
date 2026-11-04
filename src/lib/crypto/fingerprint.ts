import { bytesToHex, toArrayBuffer } from "./base64";

/** SHA-256 fingerprint of a key's SPKI DER bytes, as colon-separated lowercase hex. */
export async function spkiFingerprint(spki: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(spki)));
  return (bytesToHex(digest).match(/.{2}/g) ?? []).join(":");
}

export async function digestHex(data: Uint8Array, algorithm: "SHA-256" | "SHA-384" | "SHA-512"): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest(algorithm, toArrayBuffer(data))));
}
