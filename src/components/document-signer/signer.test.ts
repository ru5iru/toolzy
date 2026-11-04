// @vitest-environment node
import { constants, verify as nodeVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { derToPem } from "@/lib/crypto/pem";
import { bytesToBase64 } from "@/lib/crypto/base64";
import { ALGORITHMS, HASHES, HASH_BYTES, type AlgorithmId, type HashName } from "./algorithms";
import { exportJwk, exportPrivatePem, exportPublicPem, generateKeyRecord, importKeyText, keysMatch, type KeyRecord } from "./keyUtils";
import { manifestToText, parseManifest } from "./manifest";
import { inspectManifest } from "./inspectorUtils";
import { signBytes, signDocument, verifyBytes } from "./signingUtils";
import { verifyDocument } from "./verifyUtils";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url));
const text = (name: string) => fixture(name).toString("utf8");
const bytes = (name: string) => new Uint8Array(fixture(name));
const doc = new TextEncoder().encode("The quick brown fox signs a document.\n");

const keyCache = new Map<AlgorithmId, Promise<KeyRecord>>();
const keyFor = (id: AlgorithmId) => {
  if (!keyCache.has(id)) keyCache.set(id, generateKeyRecord(id, `test ${id}`));
  return keyCache.get(id)!;
};

describe("key generation, export and import", () => {
  it.each(ALGORITHMS.map((a) => a.id))("generates, exports and re-imports %s", async (id) => {
    const key = await keyFor(id);
    expect(key.pkcs8).toBeDefined();
    expect(key.fingerprint).toMatch(/^([0-9a-f]{2}:){31}[0-9a-f]{2}$/);

    const fromPrivatePem = await importKeyText(exportPrivatePem(key));
    expect(fromPrivatePem.algorithm).toBe(id);
    expect(fromPrivatePem.fingerprint).toBe(key.fingerprint); // public key derived from the private one

    const fromPublicPem = await importKeyText(exportPublicPem(key));
    expect(fromPublicPem.pkcs8).toBeUndefined();
    expect(fromPublicPem.fingerprint).toBe(key.fingerprint);

    const fromPrivateJwk = await importKeyText(await exportJwk(key, true));
    const fromPublicJwk = await importKeyText(await exportJwk(key, false));
    expect(fromPrivateJwk.fingerprint).toBe(key.fingerprint);
    expect(fromPublicJwk.fingerprint).toBe(key.fingerprint);
    expect(fromPublicJwk.pkcs8).toBeUndefined();
  });

  it("detects key/pair mismatch", async () => {
    const a = await keyFor("ECDSA-P256");
    const b = await keyFor("ECDSA-P384");
    expect(keysMatch(a, a.spki)).toBe(true);
    expect(keysMatch(a, b.spki)).toBe(false);
  });

  it("rejects unsupported and malformed keys with readable errors", async () => {
    await expect(importKeyText("")).rejects.toThrow("Paste a PEM or JWK");
    await expect(importKeyText("{not json")).rejects.toThrow("not valid JSON");
    await expect(importKeyText(text("rsa2048-pkcs1.pem"))).rejects.toThrow("PKCS#1");
    await expect(importKeyText(text("ec-p256-sec1.pem"))).rejects.toThrow("SEC1");
    await expect(importKeyText(JSON.stringify({ kty: "oct", k: "AAAA" }))).rejects.toThrow("not supported");
    await expect(importKeyText(JSON.stringify({ kty: "EC", crv: "P-521", x: "a", y: "b" }))).rejects.toThrow("P-256 or P-384");
    const p521 = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-521" }, true, ["sign"]);
    const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", p521.privateKey));
    await expect(importKeyText(derToPem("PRIVATE KEY", der))).rejects.toThrow("not a supported type");
  });

  it("does not leak private fields when exporting a public JWK", async () => {
    const jwk = JSON.parse(await exportJwk(await keyFor("RSA-PSS-2048"), false));
    expect(jwk.d).toBeUndefined();
    expect(Object.keys(jwk).sort()).toEqual(["e", "kty", "n"]);
  });
});

describe("sign and verify round trips", () => {
  const cases = ALGORITHMS.flatMap((a) => HASHES.map((h) => [a.id, h] as [AlgorithmId, HashName]));
  it.each(cases)("%s with %s", async (id, hash) => {
    const key = await keyFor(id);
    const signed = await signDocument({ data: doc, filename: "doc.txt", key, hash });
    const result = await verifyDocument({ data: doc, signature: signed.signature, manifest: signed.manifest, key });
    expect(result.status).toBe("valid");
    expect(result.warnings).toEqual([]);
  });

  it("produces the documented manifest shape", async () => {
    const key = await keyFor("RSA-PSS-3072");
    const { manifest, manifestText, documentHash } = await signDocument({ data: doc, filename: "a.pdf", key, hash: "SHA-384" });
    expect(parseManifest(manifestText)).toEqual(manifest);
    expect(manifest.signature).toMatchObject({ algorithm: "RSA-PSS", modulusLength: 3072, saltLength: HASH_BYTES["SHA-384"], format: "rsa-pss", encoding: "base64" });
    expect(manifest.document).toMatchObject({ filename: "a.pdf", size: doc.length, hashAlgorithm: "SHA-384", hash: documentHash });
    expect(manifest.signer.publicKeyFingerprint).toBe(key.fingerprint);
  });

  it("emits DER ECDSA signatures and accepts raw ones on verify", async () => {
    const key = await keyFor("ECDSA-P256");
    const der = await signBytes(doc, key.pkcs8!, key.algorithm, "SHA-256");
    expect(der[0]).toBe(0x30);
    expect(await verifyBytes(doc, der, key.spki, key.algorithm, "SHA-256")).toBe(true);
    const imported = await crypto.subtle.importKey("pkcs8", key.pkcs8!, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, imported, doc));
    expect(raw.length).toBe(64);
    expect(await verifyBytes(doc, raw, key.spki, key.algorithm, "SHA-256")).toBe(true);
  });

  it("refuses to sign without a private key", async () => {
    const pub = await importKeyText(exportPublicPem(await keyFor("ECDSA-P256")));
    await expect(signDocument({ data: doc, filename: "x", key: pub, hash: "SHA-256" })).rejects.toThrow("no private part");
  });

  it("refuses empty documents", async () => {
    await expect(signDocument({ data: new Uint8Array(), filename: "x", key: await keyFor("ECDSA-P256"), hash: "SHA-256" })).rejects.toThrow("empty");
  });
});

describe("verification outcomes", () => {
  it("reports modified when the document changed", async () => {
    const key = await keyFor("ECDSA-P256");
    const signed = await signDocument({ data: doc, filename: "doc.txt", key, hash: "SHA-256" });
    const tampered = Uint8Array.from(doc);
    tampered[3] ^= 1;
    const result = await verifyDocument({ data: tampered, signature: signed.signature, manifest: signed.manifest, key });
    expect(result.status).toBe("modified");
    expect(result.recalculatedHash).not.toBe(signed.documentHash);
  });

  it("reports invalid, not modified, when there is no manifest to compare against", async () => {
    const key = await keyFor("ECDSA-P256");
    const signed = await signDocument({ data: doc, filename: "doc.txt", key, hash: "SHA-256" });
    const tampered = Uint8Array.from(doc);
    tampered[0] ^= 1;
    expect((await verifyDocument({ data: tampered, signature: signed.signature, key })).status).toBe("invalid");
  });

  it("reports invalid for the wrong key", async () => {
    const signed = await signDocument({ data: doc, filename: "d", key: await keyFor("ECDSA-P256"), hash: "SHA-256" });
    const other = await generateKeyRecord("ECDSA-P256");
    const result = await verifyDocument({ data: doc, signature: signed.signature, manifest: signed.manifest, key: other });
    expect(result.status).toBe("invalid");
    expect(result.warnings.join(" ")).toContain("fingerprint differs");
  });

  it("handles a key of the wrong type for the signature", async () => {
    const ec = await keyFor("ECDSA-P256");
    const rsa = await keyFor("RSA-PSS-2048");
    const ecSigned = await signDocument({ data: doc, filename: "d", key: ec, hash: "SHA-256" });
    expect((await verifyDocument({ data: doc, signature: ecSigned.signature, key: rsa })).status).toBe("invalid");
    const rsaSigned = await signDocument({ data: doc, filename: "d", key: rsa, hash: "SHA-256" });
    const result = await verifyDocument({ data: doc, signature: rsaSigned.signature, key: ec });
    expect(result.status).toBe("error");
    expect(result.message).toContain("different key type");
  });

  it("reports error for a malformed ECDSA signature and invalid for a truncated RSA one", async () => {
    const ec = await keyFor("ECDSA-P256");
    expect((await verifyDocument({ data: doc, signature: Uint8Array.from([1, 2, 3]), key: ec })).status).toBe("error");
    const rsa = await keyFor("RSA-PSS-2048");
    const signed = await signDocument({ data: doc, filename: "d", key: rsa, hash: "SHA-256" });
    expect((await verifyDocument({ data: doc, signature: signed.signature.slice(0, 100), key: rsa })).status).toBe("invalid");
  });

  it("reports missing inputs and names them", async () => {
    const key = await keyFor("ECDSA-P256");
    expect(await verifyDocument({ signature: Uint8Array.from([1]), key })).toMatchObject({ status: "missing", message: expect.stringContaining("original document") });
    expect(await verifyDocument({ data: doc, key })).toMatchObject({ status: "missing", message: expect.stringContaining("signature") });
    expect(await verifyDocument({ data: doc, signature: Uint8Array.from([1]) })).toMatchObject({ status: "missing", message: expect.stringContaining("public key") });
  });

  it("never trusts the manifest's hash: a valid signature with an edited manifest still verifies, with a warning", async () => {
    const key = await keyFor("RSA-PSS-2048");
    const signed = await signDocument({ data: doc, filename: "doc.txt", key, hash: "SHA-256" });
    const edited = { ...signed.manifest, document: { ...signed.manifest.document, hash: "0".repeat(64) } };
    const result = await verifyDocument({ data: doc, manifest: edited, key });
    expect(result.status).toBe("valid");
    expect(result.warnings.join(" ")).toContain("manifest's recorded hash");
  });

  it("uses the manifest signature when no .sig file is supplied, and warns if the two differ", async () => {
    const key = await keyFor("ECDSA-P384");
    const signed = await signDocument({ data: doc, filename: "doc.txt", key, hash: "SHA-384" });
    expect((await verifyDocument({ data: doc, manifest: signed.manifest, key })).status).toBe("valid");
    const other = await signBytes(new TextEncoder().encode("other"), key.pkcs8!, key.algorithm, "SHA-384");
    const mixed = await verifyDocument({ data: doc, signature: other, manifest: signed.manifest, key });
    expect(mixed.status).not.toBe("valid");
    expect(mixed.warnings.join(" ")).toContain(".sig file differs");
  });
});

describe("interoperability with OpenSSL", () => {
  const data = bytes("fixture.txt");
  it("verifies OpenSSL RSA-PSS (SHA-256, salt 32)", async () => {
    const key = await importKeyText(text("rsa2048-public.pem"));
    expect(await verifyBytes(data, bytes("rsa2048-pss-sha256.sig"), key.spki, key.algorithm, "SHA-256")).toBe(true);
  });
  it("verifies OpenSSL ECDSA P-256 and P-384 DER signatures", async () => {
    const p256 = await importKeyText(text("ec-p256-public.pem"));
    expect(p256.algorithm).toBe("ECDSA-P256");
    expect(await verifyBytes(data, bytes("ec-p256-sha256.sig"), p256.spki, p256.algorithm, "SHA-256")).toBe(true);
    const p384 = await importKeyText(text("ec-p384-public.pem"));
    expect(p384.algorithm).toBe("ECDSA-P384");
    expect(await verifyBytes(data, bytes("ec-p384-sha384.sig"), p384.spki, p384.algorithm, "SHA-384")).toBe(true);
  });
  it("imports OpenSSL PKCS#8 private keys and signs so that Node's OpenSSL accepts the result", async () => {
    for (const [file, pub, hash, id] of [
      ["rsa2048-private.pem", "rsa2048-public.pem", "SHA-256", "RSA-PSS-2048"],
      ["ec-p256-private.pem", "ec-p256-public.pem", "SHA-256", "ECDSA-P256"],
      ["ec-p384-private.pem", "ec-p384-public.pem", "SHA-384", "ECDSA-P384"],
    ] as const) {
      const key = await importKeyText(text(file));
      expect(key.algorithm).toBe(id);
      expect(key.fingerprint).toBe((await importKeyText(text(pub))).fingerprint);
      const sig = await signBytes(data, key.pkcs8!, key.algorithm, hash);
      const options = id.startsWith("RSA")
        ? { key: text(pub), padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: HASH_BYTES[hash] }
        : { key: text(pub) };
      expect(nodeVerify(hash.replace("SHA-", "sha"), data, options, sig)).toBe(true);
      expect(nodeVerify(hash.replace("SHA-", "sha"), Buffer.from("tampered"), options, sig)).toBe(false);
    }
  });
});

describe("manifest parsing and the inspector", () => {
  it("rejects malformed manifests with the failing field", () => {
    expect(() => parseManifest("nope")).toThrow("not valid JSON");
    expect(() => parseManifest("{}")).toThrow("Invalid manifest: version");
    expect(() => parseManifest(JSON.stringify({ version: 2 }))).toThrow("Invalid manifest: version");
  });

  it("labels fields self-declared until a matching verification confirms them", async () => {
    const key = await keyFor("ECDSA-P256");
    const signed = await signDocument({ data: doc, filename: "doc.txt", key, hash: "SHA-256" });
    const before = inspectManifest(manifestToText(signed.manifest));
    expect(before.confirmed).toBe(false);
    expect(before.rows.every((r) => r.trust === "self-declared")).toBe(true);

    const verification = await verifyDocument({ data: doc, signature: signed.signature, manifest: signed.manifest, key });
    const after = inspectManifest(manifestToText(signed.manifest), verification);
    expect(after.confirmed).toBe(true);
    const trust = Object.fromEntries(after.rows.map((r) => [r.label, r.trust]));
    expect(trust["Document hash"]).toBe("verified");
    expect(trust["Public key fingerprint (SHA-256)"]).toBe("verified");
    expect(trust["Document filename"]).toBe("self-declared");
    expect(trust["Signed at"]).toBe("self-declared");
  });

  it("does not confirm a manifest whose signature differs from the one that was verified", async () => {
    const key = await keyFor("ECDSA-P256");
    const a = await signDocument({ data: doc, filename: "doc.txt", key, hash: "SHA-256" });
    const b = await signDocument({ data: new TextEncoder().encode("another"), filename: "b.txt", key, hash: "SHA-256" });
    const verification = await verifyDocument({ data: doc, signature: a.signature, manifest: a.manifest, key });
    expect(inspectManifest(b.manifestText, verification).confirmed).toBe(false);
    expect(bytesToBase64(a.signature)).not.toBe(b.manifest.signature.value);
  });
});
