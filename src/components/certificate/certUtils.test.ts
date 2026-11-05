// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCertificateDer, parseCertificateFile, parseCertificateText, validityState } from "./certUtils";

const fx = (n: string) => readFileSync(new URL(`./__fixtures__/${n}`, import.meta.url));
const txt = (n: string) => fx(n).toString("utf8");
const expected = JSON.parse(txt("expected.json"));
const opensslDate = (s: string) => new Date(s.replace(/\s+/g, " ").replace(" GMT", " UTC"));

describe("certificate parser", () => {
  it.each(["ca-rsa.pem", "leaf-ec.pem", "ed25519.pem", "p384.pem"])("%s matches OpenSSL: serial, dates, fingerprints, names", async (name) => {
    const [cert] = await parseCertificateText(txt(name));
    const want = expected[name];
    expect(cert.serial).toBe(want.serial.replace(/^0+/, "").padStart(want.serial.length, "0") === want.serial ? want.serial : want.serial);
    expect(cert.fingerprints.sha256).toBe(want.sha256);
    expect(cert.fingerprints.sha1).toBe(want.sha1);
    expect(cert.notBefore!.getTime()).toBe(opensslDate(want.notBefore).getTime());
    expect(cert.notAfter!.getTime()).toBe(opensslDate(want.notAfter).getTime());
    // RFC 2253 lists RDNs in reverse order; compare as sets of "label=value".
    const asSet = (s: string) => new Set(s.split(/,(?=[A-Za-z.]+=)/).map((p) => p.trim()));
    const ours = new Set(cert.subject.parts.map((p) => `${p.label}=${p.value}`));
    const wantSubject = asSet(want.subject.replace(/\\C3\\AB/g, "ë").replace(/\\C3\\96/g, "Ö"));
    expect(ours).toEqual(wantSubject);
    expect(cert.issuer!.parts.length).toBe(asSet(want.issuer).size);
  });

  it("reads extensions of the leaf certificate", async () => {
    const [leaf] = await parseCertificateText(txt("leaf-ec.pem"));
    expect(leaf.version).toBe(3);
    expect(leaf.signatureAlgorithm).toBe("sha256WithRSAEncryption");
    expect(leaf.publicKey).toMatchObject({ algorithm: "EC", sizeBits: 256 });
    const ext = (name: string) => leaf.extensions.find((e) => e.name === name)!;
    expect(ext("Subject Alternative Name").value).toEqual([
      "DNS: www.example.test", "DNS: *.example.test", "IP: 192.0.2.10", "IP: 2001:db8::1", "Email: admin@example.test", "URI: https://example.test/id",
    ]);
    expect(ext("Key Usage")).toMatchObject({ critical: true, value: ["Digital Signature", "Key Encipherment"] });
    expect(ext("Extended Key Usage").value).toEqual(["TLS server authentication", "TLS client authentication"]);
    expect(ext("Basic Constraints").value).toEqual(["CA: no"]);
    expect(ext("Authority Key Identifier").value[0]).toMatch(/^Key ID: ([0-9A-F]{2}:){19}[0-9A-F]{2}$/);
    expect(leaf.selfIssued).toBe(false);
  });

  it("reads the CA certificate", async () => {
    const [ca] = await parseCertificateText(txt("ca-rsa.pem"));
    expect(ca.selfIssued).toBe(true);
    expect(ca.publicKey).toMatchObject({ algorithm: "RSA", sizeBits: 2048 });
    expect(ca.publicKey.detail).toContain("exponent 65537");
    const bc = ca.extensions.find((e) => e.name === "Basic Constraints")!;
    expect(bc).toMatchObject({ critical: true, value: ["CA: yes", "Path length: 1"] });
    expect(ca.extensions.find((e) => e.name === "Key Usage")!.value).toEqual(["Certificate Sign", "CRL Sign"]);
  });

  it("identifies Ed25519 and P-384 and decodes UTF-8 names", async () => {
    const [ed] = await parseCertificateText(txt("ed25519.pem"));
    expect(ed.signatureAlgorithm).toBe("Ed25519");
    expect(ed.publicKey.algorithm).toBe("Ed25519");
    const [p384] = await parseCertificateText(txt("p384.pem"));
    expect(p384.publicKey).toMatchObject({ algorithm: "EC", sizeBits: 384 });
    expect(p384.signatureAlgorithm).toBe("ecdsa-with-SHA384");
    expect(p384.subject.text).toContain("Tëst Örg");
  });

  it("accepts DER files and the same certificate yields the same fingerprint", async () => {
    const [fromDer] = await parseCertificateFile(new Uint8Array(fx("leaf-ec.der")));
    expect(fromDer.fingerprints.sha256).toBe(expected["leaf-ec.pem"].sha256);
    const direct = await parseCertificateDer(new Uint8Array(fx("leaf-ec.der")));
    expect(direct.serial).toBe(fromDer.serial);
  });

  it("parses a CSR with requested extensions", async () => {
    const [csr] = await parseCertificateText(txt("leaf-ec.csr"));
    expect(csr.kind).toBe("csr");
    expect(csr.subject.parts.find((p) => p.label === "CN")?.value).toBe("www.example.test");
    expect(csr.extensions.find((e) => e.name === "Subject Alternative Name")!.value).toContain("DNS: www.example.test");
    expect(csr.publicKey.algorithm).toBe("EC");
    expect(csr.notAfter).toBeUndefined();
  });

  it("handles chains and reports validity", async () => {
    const chain = await parseCertificateText(txt("leaf-ec.pem") + txt("ca-rsa.pem"));
    expect(chain).toHaveLength(2);
    expect(validityState(chain[0], new Date("2026-11-06"))?.state).toBe("valid");
    expect(validityState(chain[0], new Date("2040-01-01"))?.state).toBe("expired");
    expect(validityState(chain[0], new Date("2020-01-01"))?.state).toBe("not-yet-valid");
  });

  it("gives clear errors", async () => {
    await expect(parseCertificateText("")).rejects.toThrow("Paste");
    await expect(parseCertificateText("hello")).rejects.toThrow("No PEM block");
    await expect(parseCertificateText("-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----")).rejects.toThrow("private key");
    await expect(parseCertificateText("-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----")).rejects.toThrow("not a valid certificate");
    await expect(parseCertificateText("-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----")).rejects.toThrow("Unsupported PEM type");
  });
});
