// @vitest-environment node
import { constants, createPublicKey, createSign, verify as nodeVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAlgorithmFamily, signECDSA, signRSA, signRSAPSS } from "./encoderUtils";
import { importKeyInput } from "@/lib/crypto/keyInput";
import { base64UrlToBytes } from "@/lib/crypto/base64";

const fx = (n: string) => readFileSync(new URL(`../document-signer/__fixtures__/${n}`, import.meta.url), "utf8");
const H = '{"alg":"PS256","typ":"JWT"}';
const P = '{"sub":"1"}';
const parts = (t: string) => t.split(".");

describe("JWT PS algorithms and JWK keys", () => {
  it("classifies PS algorithms", () => expect(getAlgorithmFamily("PS384")).toBe("RSA-PSS"));

  it.each([["SHA-256"], ["SHA-384"], ["SHA-512"]])("PS signature with %s verifies in OpenSSL", async (hash) => {
    const token = await signRSAPSS(H, P, fx("rsa2048-private.pem"), hash);
    const [h, p, s] = parts(token);
    const ok = nodeVerify(hash.replace("-", "").toLowerCase(), Buffer.from(`${h}.${p}`), {
      key: createPublicKey(fx("rsa2048-public.pem")), padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(hash.slice(4)) / 8,
    }, Buffer.from(base64UrlToBytes(s)));
    expect(ok).toBe(true);
  });

  it("accepts private JWK for signing and public JWK for verification", async () => {
    const pem = fx("rsa2048-private.pem");
    const priv = await importKeyInput(pem, { name: "RSA-PSS", hash: "SHA-256" }, "sign");
    expect(priv.type).toBe("private");
    const jwkPriv = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", await crypto.subtle.importKey("pkcs8", Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ""), "base64"), { name: "RSA-PSS", hash: "SHA-256" }, true, ["sign"]))), alg: "RS256", key_ops: ["sign"] });
    const token = await signRSA('{"alg":"RS256"}', P, jwkPriv, "SHA-256");
    const [h, p, s] = parts(token);
    const v = createSign("sha256"); v.update(`${h}.${p}`);
    expect(v.sign(createPrivateKeyFromJwk(jwkPriv)).toString("base64url")).toBe(s); // PKCS#1 v1.5 is deterministic
    // private JWK used as verification key: private members are dropped
    const pub = await importKeyInput(jwkPriv, { name: "RSA-PSS", hash: "SHA-256" }, "verify");
    expect(pub.type).toBe("public");
  });

  it("rejects a public JWK for signing and bad JSON", async () => {
    await expect(importKeyInput('{"kty":"RSA","n":"AQAB","e":"AQAB"}', { name: "RSA-PSS", hash: "SHA-256" }, "sign")).rejects.toThrow("private part");
    await expect(importKeyInput("{oops", { name: "RSA-PSS", hash: "SHA-256" }, "sign")).rejects.toThrow("valid JSON");
  });

  it("ES256 still signs with PEM keys", async () => {
    const t = await signECDSA('{"alg":"ES256"}', P, fx("ec-p256-private.pem"), "SHA-256", "ES256");
    expect(base64UrlToBytes(parts(t)[2]).length).toBe(64);
  });
});

import { createPrivateKey } from "node:crypto";
function createPrivateKeyFromJwk(jwk: string) {
  const { alg: _a, key_ops: _k, ...rest } = JSON.parse(jwk);
  return createPrivateKey({ key: rest, format: "jwk" });
}
