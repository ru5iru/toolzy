// @vitest-environment node
import { createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePem, derToPem } from "./pem";
import { decryptPkcs8, encryptPkcs8, WrongPasswordError } from "./pkcs8Encrypted";

const dir = "../../components/document-signer/__fixtures__/";
const fx = (n: string) => readFileSync(new URL(dir + n, import.meta.url), "utf8");
const PASS = "fixture-pass-123";
const plainDer = (n: string) => parsePem(fx(n)).der;

describe("encrypted PKCS#8", () => {
  it.each([
    ["enc-p256-aes256-sha256.pem", "ec-p256-private.pem"],
    ["enc-rsa2048-aes128-sha1.pem", "rsa2048-private.pem"],
    ["enc-ed25519-aes256-sha512.pem", "ed25519-private.pem"],
  ])("decrypts OpenSSL output %s", async (enc, plain) => {
    const out = await decryptPkcs8(parsePem(fx(enc)).der, PASS);
    expect(Array.from(out)).toEqual(Array.from(plainDer(plain)));
  });

  it("rejects a wrong password", async () => {
    await expect(decryptPkcs8(parsePem(fx("enc-p256-aes256-sha256.pem")).der, "nope")).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("explains unsupported 3DES keys", async () => {
    await expect(decryptPkcs8(parsePem(fx("enc-p256-3des.pem")).der, PASS)).rejects.toThrow(/AES-CBC|PBES2/);
  });

  it("round-trips and is readable by OpenSSL (via node:crypto)", async () => {
    const der = plainDer("rsa2048-private.pem");
    const enc = await encryptPkcs8(der, "pässword ✓", 5000);
    expect(Array.from(await decryptPkcs8(enc, "pässword ✓"))).toEqual(Array.from(der));
    const pem = derToPem("ENCRYPTED PRIVATE KEY", enc);
    const key = createPrivateKey({ key: pem, format: "pem", passphrase: "pässword ✓" });
    expect(key.asymmetricKeyType).toBe("rsa");
    expect(() => createPrivateKey({ key: pem, format: "pem", passphrase: "wrong" })).toThrow();
  });

  it("requires a password", async () => {
    await expect(encryptPkcs8(new Uint8Array([1]), "")).rejects.toThrow();
  });
});
