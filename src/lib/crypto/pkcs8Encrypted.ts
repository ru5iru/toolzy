import { toArrayBuffer } from "./base64";
import {
  decodeInteger, decodeOid, derInteger, derNull, derOctetString, derOid, derSequence, parseDer, type DerNode,
} from "./der";

/** PBES2 (RFC 8018) EncryptedPrivateKeyInfo with PBKDF2-HMAC-SHA256 and AES-256-CBC, readable by OpenSSL. */

export const PBKDF2_ITERATIONS = 600_000;
const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;

const OID_PBES2 = "1.2.840.113549.1.5.13";
const OID_PBKDF2 = "1.2.840.113549.1.5.12";
const PRF_BY_OID: Record<string, "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512"> = {
  "1.2.840.113549.2.7": "SHA-1",
  "1.2.840.113549.2.9": "SHA-256",
  "1.2.840.113549.2.10": "SHA-384",
  "1.2.840.113549.2.11": "SHA-512",
};
const OID_HMAC_SHA256 = "1.2.840.113549.2.9";
const CIPHER_BY_OID: Record<string, number> = {
  "2.16.840.1.101.3.4.1.2": 128,
  "2.16.840.1.101.3.4.1.22": 192,
  "2.16.840.1.101.3.4.1.42": 256,
};
const OID_AES256_CBC = "2.16.840.1.101.3.4.1.42";

export class WrongPasswordError extends Error {
  constructor() { super("Wrong password, or the key file is damaged."); this.name = "WrongPasswordError"; }
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations: number, hash: string, bits: number, usage: KeyUsage): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations, hash },
    base,
    { name: "AES-CBC", length: bits },
    false,
    [usage],
  );
}

/** Encrypt a PKCS#8 DER private key. Returns EncryptedPrivateKeyInfo DER. */
export async function encryptPkcs8(pkcs8: Uint8Array, password: string, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  if (!password) throw new Error("Enter a password to encrypt the key.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveAesKey(password, salt, iterations, "SHA-256", 256, "encrypt");
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv: toArrayBuffer(iv) }, key, toArrayBuffer(pkcs8)));
  const kdf = derSequence(
    derOid(OID_PBKDF2),
    derSequence(derOctetString(salt), derInteger(iterations), derSequence(derOid(OID_HMAC_SHA256), derNull())),
  );
  const cipher = derSequence(derOid(OID_AES256_CBC), derOctetString(iv));
  return derSequence(derSequence(derOid(OID_PBES2), derSequence(kdf, cipher)), derOctetString(encrypted));
}

function expect(node: DerNode | undefined, tag: number, what: string): DerNode {
  if (!node || node.tag !== tag) throw new Error(`Unsupported encrypted key structure (${what}).`);
  return node;
}

/** Decrypt EncryptedPrivateKeyInfo DER into PKCS#8 DER. */
export async function decryptPkcs8(der: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) throw new Error("Enter the password for this encrypted key.");
  let root: DerNode;
  try { root = parseDer(der); } catch { throw new Error("The encrypted key is not valid DER."); }
  const algId = expect(root.children[0], 0x30, "algorithm");
  const data = expect(root.children[1], 0x04, "ciphertext").content;
  if (decodeOid(expect(algId.children[0], 0x06, "algorithm OID").content) !== OID_PBES2) {
    throw new Error("Only PBES2 encrypted keys are supported. Re-encrypt with: openssl pkcs8 -topk8 -v2 aes-256-cbc");
  }
  const params = expect(algId.children[1], 0x30, "PBES2 parameters");
  const kdf = expect(params.children[0], 0x30, "key derivation");
  const cipher = expect(params.children[1], 0x30, "cipher");
  if (decodeOid(expect(kdf.children[0], 0x06, "KDF OID").content) !== OID_PBKDF2) {
    throw new Error("Only PBKDF2 key derivation is supported (scrypt is not).");
  }
  const kp = expect(kdf.children[1], 0x30, "PBKDF2 parameters");
  const salt = expect(kp.children[0], 0x04, "salt").content;
  const iterations = decodeInteger(expect(kp.children[1], 0x02, "iterations").content);
  if (iterations < 1 || iterations > MAX_ITERATIONS) throw new Error("The key uses an unreasonable PBKDF2 iteration count.");
  let hash: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512" = "SHA-1";
  for (const extra of kp.children.slice(2)) {
    if (extra.tag === 0x30) {
      const prf = PRF_BY_OID[decodeOid(expect(extra.children[0], 0x06, "PRF OID").content)];
      if (!prf) throw new Error("Unsupported PBKDF2 hash function.");
      hash = prf;
    }
  }
  const cipherBits = CIPHER_BY_OID[decodeOid(expect(cipher.children[0], 0x06, "cipher OID").content)];
  if (!cipherBits) throw new Error("Only AES-CBC encrypted keys are supported (3DES is not). Re-encrypt with: openssl pkcs8 -topk8 -v2 aes-256-cbc");
  const iv = expect(cipher.children[1], 0x04, "IV").content;
  if (iv.length !== 16) throw new Error("Unsupported encrypted key structure (IV length).");
  const key = await deriveAesKey(password, salt, iterations, hash, cipherBits, "decrypt");
  try {
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv: toArrayBuffer(iv) }, key, toArrayBuffer(data)));
    // A wrong password can occasionally produce valid padding; PKCS#8 always starts with a SEQUENCE.
    if (plain[0] !== 0x30) throw new WrongPasswordError();
    return plain;
  } catch (e) {
    if (e instanceof WrongPasswordError) throw e;
    throw new WrongPasswordError();
  }
}
