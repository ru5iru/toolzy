// @vitest-environment node
import { describe, expect, it } from "vitest";
import { base64ToBytes, base64UrlToBytes, hexToBytes } from "@/lib/crypto/base64";
import { MAX_BYTES, MAX_COUNT, PRESETS, entropyBits, generateSecrets, validateOptions } from "./secretsUtils";

describe("generateSecrets", () => {
  it("produces the requested number of values that decode to the requested byte length", () => {
    for (const bytes of [1, 16, 32, 33, 64, 1024]) {
      expect(hexToBytes(generateSecrets({ bytes, count: 1, format: "hex" })[0])).toHaveLength(bytes);
      expect(base64ToBytes(generateSecrets({ bytes, count: 1, format: "base64" })[0])).toHaveLength(bytes);
      expect(base64UrlToBytes(generateSecrets({ bytes, count: 1, format: "base64url" })[0])).toHaveLength(bytes);
    }
    expect(generateSecrets({ bytes: 16, count: 7, format: "hex" })).toHaveLength(7);
  });

  it("uses URL-safe characters without padding for base64url", () => {
    const fill = (b: Uint8Array) => b.fill(0xfb); // encodes with + and / in standard base64
    expect(generateSecrets({ bytes: 5, count: 1, format: "base64" }, fill)[0]).toMatch(/[+/=]/);
    expect(generateSecrets({ bytes: 5, count: 1, format: "base64url" }, fill)[0]).not.toMatch(/[+/=]/);
  });

  it("encodes known bytes exactly", () => {
    const fill = (b: Uint8Array) => { b.set([0, 15, 255]); return b; };
    expect(generateSecrets({ bytes: 3, count: 1, format: "hex" }, fill)).toEqual(["000fff"]);
    expect(generateSecrets({ bytes: 3, count: 1, format: "base64" }, fill)).toEqual(["AA//"]);
  });

  it("draws fresh randomness for every value", () => {
    const values = generateSecrets({ bytes: 32, count: MAX_COUNT, format: "hex" });
    expect(new Set(values).size).toBe(MAX_COUNT);
  });

  it("rejects out-of-range or non-integer options", () => {
    const ok = { bytes: 16, count: 1, format: "hex" as const };
    expect(() => generateSecrets({ ...ok, bytes: 0 })).toThrow("Length");
    expect(() => generateSecrets({ ...ok, bytes: MAX_BYTES + 1 })).toThrow("Length");
    expect(() => generateSecrets({ ...ok, bytes: 1.5 })).toThrow("Length");
    expect(() => generateSecrets({ ...ok, bytes: Number.NaN })).toThrow("Length");
    expect(() => generateSecrets({ ...ok, count: 0 })).toThrow("Count");
    expect(() => generateSecrets({ ...ok, count: MAX_COUNT + 1 })).toThrow("Count");
  });
});

describe("presets", () => {
  it("are valid and sized to the algorithm they name", () => {
    for (const preset of PRESETS) expect(() => validateOptions({ bytes: preset.bytes, count: 1 })).not.toThrow();
    const byId = Object.fromEntries(PRESETS.map((p) => [p.id, p.bytes]));
    expect(byId).toMatchObject({ hs256: 32, hs384: 48, hs512: 64, aes128: 16, aes256: 32 });
    expect(entropyBits(byId.hs256)).toBe(256);
  });
});
