export type HashName = "SHA-256" | "SHA-384" | "SHA-512";
export const HASHES: HashName[] = ["SHA-256", "SHA-384", "SHA-512"];
export const HASH_BYTES: Record<HashName, number> = { "SHA-256": 32, "SHA-384": 48, "SHA-512": 64 };

export type AlgorithmId = "RSA-PSS-2048" | "RSA-PSS-3072" | "ECDSA-P256" | "ECDSA-P384";

export interface AlgorithmInfo {
  id: AlgorithmId;
  family: "RSA-PSS" | "ECDSA";
  label: string;
  modulusLength?: 2048 | 3072;
  namedCurve?: "P-256" | "P-384";
  /** Curve size in bytes, used to convert ECDSA signatures between raw and DER. */
  coordLength?: number;
}

export const ALGORITHMS: AlgorithmInfo[] = [
  { id: "ECDSA-P256", family: "ECDSA", label: "ECDSA P-256", namedCurve: "P-256", coordLength: 32 },
  { id: "ECDSA-P384", family: "ECDSA", label: "ECDSA P-384", namedCurve: "P-384", coordLength: 48 },
  { id: "RSA-PSS-2048", family: "RSA-PSS", label: "RSA-PSS 2048", modulusLength: 2048 },
  { id: "RSA-PSS-3072", family: "RSA-PSS", label: "RSA-PSS 3072", modulusLength: 3072 },
];

export function algorithmById(id: string): AlgorithmInfo {
  const found = ALGORITHMS.find((a) => a.id === id);
  if (!found) throw new Error(`Unsupported algorithm "${id}".`);
  return found;
}

export function isHashName(value: unknown): value is HashName {
  return typeof value === "string" && (HASHES as string[]).includes(value);
}

/** Algorithm parameters for importKey / generateKey. */
export function keyAlgorithm(info: AlgorithmInfo, hash: HashName): RsaHashedImportParams | EcKeyImportParams {
  return info.family === "RSA-PSS"
    ? { name: "RSA-PSS", hash }
    : { name: "ECDSA", namedCurve: info.namedCurve! };
}

/** Algorithm parameters for sign / verify. */
export function signParams(info: AlgorithmInfo, hash: HashName): RsaPssParams | EcdsaParams {
  return info.family === "RSA-PSS"
    ? { name: "RSA-PSS", saltLength: HASH_BYTES[hash] }
    : { name: "ECDSA", hash };
}
