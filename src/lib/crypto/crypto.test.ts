// @vitest-environment node
import { describe, expect, it } from "vitest";
import { base64ToBytes, base64UrlToBytes, bytesToBase64, bytesToBase64Url, bytesToHex, hexToBytes } from "./base64";
import { ecdsaDerToRaw, ecdsaRawToDer } from "./ecdsa";
import { spkiFingerprint } from "./fingerprint";
import { derToPem, parsePem, parseSupportedKeyPem, pemToBuf } from "./pem";

describe("base64 and hex helpers", () => {
  it("round-trips arbitrary bytes, including large inputs", () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 31) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
  it("handles base64url with and without padding", () => {
    const bytes = Uint8Array.from([251, 255, 254, 1]);
    const url = bytesToBase64Url(bytes);
    expect(url).not.toMatch(/[+/=]/);
    expect(base64UrlToBytes(url)).toEqual(bytes);
  });
  it("rejects malformed base64", () => {
    expect(() => base64ToBytes("not base64!")).toThrow("Not valid Base64");
    expect(() => base64ToBytes("A")).toThrow("Not valid Base64");
  });
  it("converts hex both ways, ignoring colons and whitespace", () => {
    expect(bytesToHex(Uint8Array.from([0, 15, 255]))).toBe("000fff");
    expect(hexToBytes("00:0F ff")).toEqual(Uint8Array.from([0, 15, 255]));
    expect(() => hexToBytes("abc")).toThrow("hexadecimal");
  });
});

describe("PEM helpers", () => {
  const der = Uint8Array.from({ length: 100 }, (_, i) => i);
  it("round-trips PEM with 64-column lines", () => {
    const pem = derToPem("PUBLIC KEY", der);
    expect(pem.split("\n").every((line) => line.length <= 64)).toBe(true);
    expect(parsePem(pem)).toEqual({ label: "PUBLIC KEY", der });
    expect(new Uint8Array(pemToBuf(pem))).toEqual(der);
  });
  it("classifies supported keys", () => {
    expect(parseSupportedKeyPem(derToPem("PRIVATE KEY", der)).kind).toBe("private");
    expect(parseSupportedKeyPem(derToPem("PUBLIC KEY", der)).kind).toBe("public");
  });
  it("explains unsupported variants with a conversion hint", () => {
    const wrap = (label: string) => `-----BEGIN ${label}-----\nAAAA\n-----END ${label}-----`;
    expect(() => parseSupportedKeyPem(wrap("RSA PRIVATE KEY"))).toThrow("PKCS#1");
    expect(() => parseSupportedKeyPem(wrap("EC PRIVATE KEY"))).toThrow("SEC1");
    expect(() => parseSupportedKeyPem(wrap("ENCRYPTED PRIVATE KEY"))).toThrow("Encrypted");
    expect(() => parseSupportedKeyPem(wrap("CERTIFICATE"))).toThrow("Unsupported PEM type");
    expect(() => parseSupportedKeyPem("garbage")).toThrow("No PEM block");
  });
});

describe("ECDSA raw/DER conversion", () => {
  it("round-trips signatures including high-bit and short integers", () => {
    const cases = [
      Uint8Array.from({ length: 64 }, (_, i) => (i < 32 ? 0xff : 0x01)), // high bit set in r, small s
      Uint8Array.from({ length: 64 }, (_, i) => (i === 31 || i === 63 ? 1 : 0)), // tiny r and s
      Uint8Array.from({ length: 96 }, (_, i) => (i * 7 + 3) % 256),
    ];
    for (const raw of cases) {
      const coord = raw.length / 2;
      expect(ecdsaDerToRaw(ecdsaRawToDer(raw), coord)).toEqual(raw);
    }
  });
  it("rejects malformed DER", () => {
    expect(() => ecdsaDerToRaw(Uint8Array.from([1, 2, 3]), 32)).toThrow("Malformed");
    expect(() => ecdsaDerToRaw(Uint8Array.from([0x30, 0x02, 0x02, 0x01]), 32)).toThrow("Malformed");
  });
  it("rejects a P-384 signature when read as P-256", () => {
    const raw = Uint8Array.from({ length: 96 }, () => 0xaa);
    expect(() => ecdsaDerToRaw(ecdsaRawToDer(raw), 32)).toThrow("does not match this curve");
  });
});

describe("fingerprint", () => {
  it("is a colon-separated SHA-256 of the SPKI bytes", async () => {
    const fp = await spkiFingerprint(Uint8Array.from([1, 2, 3]));
    expect(fp).toMatch(/^([0-9a-f]{2}:){31}[0-9a-f]{2}$/);
    // SHA-256("\x01\x02\x03") is a published known-answer value
    expect(fp.replace(/:/g, "")).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
  });
});
