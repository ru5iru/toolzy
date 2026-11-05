export type HashName = "SHA-256" | "SHA-384" | "SHA-512";
export const HASHES: HashName[] = ["SHA-256", "SHA-384", "SHA-512"];
export const HASH_BYTES: Record<HashName, number> = { "SHA-256": 32, "SHA-384": 48, "SHA-512": 64 };

export type AlgorithmId = "RSA-PSS-2048" | "RSA-PSS-3072" | "RSA-PSS-4096" | "ECDSA-P256" | "ECDSA-P384" | "Ed25519";

export interface AlgorithmInfo {
  id: AlgorithmId;
  family: "RSA-PSS" | "ECDSA" | "Ed25519";
  label: string;
  modulusLength?: 2048 | 3072 | 4096;
  namedCurve?: "P-256" | "P-384";
  /** Curve size in bytes, used to convert ECDSA signatures between raw and DER. */
  coordLength?: number;
}

export const ALGORITHMS: AlgorithmInfo[] = [
  { id: "ECDSA-P256", family: "ECDSA", label: "ECDSA P-256", namedCurve: "P-256", coordLength: 32 },
  { id: "ECDSA-P384", family: "ECDSA", label: "ECDSA P-384", namedCurve: "P-384", coordLength: 48 },
  { id: "Ed25519", family: "Ed25519", label: "Ed25519" },
  { id: "RSA-PSS-2048", family: "RSA-PSS", label: "RSA-PSS 2048", modulusLength: 2048 },
  { id: "RSA-PSS-3072", family: "RSA-PSS", label: "RSA-PSS 3072", modulusLength: 3072 },
  { id: "RSA-PSS-4096", family: "RSA-PSS", label: "RSA-PSS 4096", modulusLength: 4096 },
];

export function algorithmById(id: string): AlgorithmInfo {
  const found = ALGORITHMS.find((a) => a.id === id);
  if (!found) throw new Error(`Unsupported algorithm "${id}".`);
  return found;
}

export function isHashName(value: unknown): value is HashName {
  return typeof value === "string" && (HASHES as string[]).includes(value);
}

/** Ed25519 signs the message directly, so no signing hash applies. */
export function usesSigningHash(info: AlgorithmInfo): boolean {
  return info.family !== "Ed25519";
}

let ed25519Support: Promise<boolean> | undefined;
/** Browsers differ in Ed25519 support, so detect it by trying a real operation. Cached. */
export function isEd25519Supported(): Promise<boolean> {
  ed25519Support ??= (async () => {
    try {
      await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
      return true;
    } catch {
      return false;
    }
  })();
  return ed25519Support;
}

/** Algorithms the current browser can use, in display order. */
export async function supportedAlgorithms(): Promise<AlgorithmInfo[]> {
  const ed = await isEd25519Supported();
  return ALGORITHMS.filter((a) => a.family !== "Ed25519" || ed);
}

/** Algorithm parameters for importKey / generateKey. */
export function keyAlgorithm(info: AlgorithmInfo, hash: HashName): RsaHashedImportParams | EcKeyImportParams | Algorithm {
  if (info.family === "RSA-PSS") return { name: "RSA-PSS", hash };
  if (info.family === "ECDSA") return { name: "ECDSA", namedCurve: info.namedCurve! };
  return { name: "Ed25519" };
}

/** Algorithm parameters for sign / verify. */
export function signParams(info: AlgorithmInfo, hash: HashName): RsaPssParams | EcdsaParams | Algorithm {
  if (info.family === "RSA-PSS") return { name: "RSA-PSS", saltLength: HASH_BYTES[hash] };
  if (info.family === "ECDSA") return { name: "ECDSA", hash };
  return { name: "Ed25519" };
}
