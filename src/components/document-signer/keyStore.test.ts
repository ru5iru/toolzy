// @vitest-environment node
import { describe, expect, it } from "vitest";
import { forgetKey, loadStoredKeys, rememberKey, type KeyStoreBackend, type StoredKey } from "./keyStore";
import { generateKeyRecord, hasPrivateKey, importKeyText, exportPublicPem } from "./keyUtils";
import { signDocument } from "./signingUtils";
import { verifyDocument } from "./verifyUtils";

const memoryBackend = (): KeyStoreBackend & { rows: Map<string, StoredKey> } => {
  const rows = new Map<string, StoredKey>();
  return { rows, getAll: async () => [...rows.values()], put: async (e) => { rows.set(e.id, e); }, remove: async (id) => { rows.delete(id); } };
};
const doc = new TextEncoder().encode("persisted signing");

describe("device key storage", () => {
  it.each(["ECDSA-P256", "Ed25519", "RSA-PSS-2048"] as const)("a restored %s key signs with every hash and cannot be exported", async (algorithm) => {
    const backend = memoryBackend();
    const original = await generateKeyRecord(algorithm, "stored");
    const kept = await rememberKey(backend, original);
    expect(kept.pkcs8).toBeUndefined();
    expect(kept.persisted).toBe(true);
    const [restored] = await loadStoredKeys(backend);
    expect(restored.persisted).toBe(true);
    expect(restored.pkcs8).toBeUndefined();
    expect(hasPrivateKey(restored)).toBe(true);
    for (const handle of Object.values(restored.privateKeys!)) {
      expect(handle!.extractable).toBe(false);
      await expect(crypto.subtle.exportKey("pkcs8", handle!)).rejects.toThrow();
    }
    for (const hash of ["SHA-256", "SHA-384", "SHA-512"] as const) {
      const out = await signDocument({ data: doc, filename: "d.txt", key: restored, hash });
      const verified = await verifyDocument({ data: doc, signature: out.signature, manifest: out.manifest, key: restored });
      expect(verified.status).toBe("valid");
    }
  });

  it("stores public-only keys and forgets keys", async () => {
    const backend = memoryBackend();
    const pair = await generateKeyRecord("ECDSA-P256");
    const pub = await importKeyText(exportPublicPem(pair), "pub");
    await rememberKey(backend, pub);
    expect(backend.rows.get(pub.id)?.privateKeys).toBeUndefined();
    await forgetKey(backend, pub.id);
    expect(await loadStoredKeys(backend)).toEqual([]);
  });

  it("does not persist private bytes", async () => {
    const backend = memoryBackend();
    const key = await generateKeyRecord("ECDSA-P256");
    await rememberKey(backend, key);
    expect("pkcs8" in backend.rows.get(key.id)!).toBe(false);
  });

  it("signing without any private material fails clearly", async () => {
    const pair = await generateKeyRecord("ECDSA-P256");
    const pub = await importKeyText(exportPublicPem(pair));
    await expect(signDocument({ data: doc, filename: "d", key: pub, hash: "SHA-256" })).rejects.toThrow("no private part");
  });
});
