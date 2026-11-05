import { bytesToHex, toArrayBuffer } from "@/lib/crypto/base64";
import { decodeInteger, decodeOid, parseDer, type DerNode } from "@/lib/crypto/der";
import { parsePem } from "@/lib/crypto/pem";

export interface Name { text: string; parts: { label: string; value: string }[] }
export interface Extension { oid: string; name: string; critical: boolean; value: string[] }
export interface PublicKeyInfo { algorithm: string; detail: string; sizeBits?: number }

export interface ParsedCertificate {
  kind: "certificate" | "csr";
  version: number;
  serial?: string;
  signatureAlgorithm: string;
  issuer?: Name;
  subject: Name;
  notBefore?: Date;
  notAfter?: Date;
  publicKey: PublicKeyInfo;
  extensions: Extension[];
  selfIssued: boolean;
  fingerprints: { sha1: string; sha256: string };
}

const ATTRIBUTES: Record<string, string> = {
  "2.5.4.3": "CN", "2.5.4.6": "C", "2.5.4.7": "L", "2.5.4.8": "ST", "2.5.4.9": "street", "2.5.4.10": "O", "2.5.4.11": "OU",
  "2.5.4.5": "serialNumber", "2.5.4.4": "SN", "2.5.4.42": "GN", "2.5.4.12": "title", "2.5.4.97": "organizationIdentifier",
  "1.2.840.113549.1.9.1": "emailAddress", "0.9.2342.19200300.100.1.25": "DC", "0.9.2342.19200300.100.1.1": "UID",
};
const SIGNATURE_ALGS: Record<string, string> = {
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption", "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption", "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.113549.1.1.10": "RSASSA-PSS", "1.2.840.113549.1.1.4": "md5WithRSAEncryption",
  "1.2.840.10045.4.1": "ecdsa-with-SHA1", "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384", "1.2.840.10045.4.3.4": "ecdsa-with-SHA512", "1.3.101.112": "Ed25519", "1.3.101.113": "Ed448",
};
const KEY_ALGS: Record<string, string> = {
  "1.2.840.113549.1.1.1": "RSA", "1.2.840.10045.2.1": "EC", "1.3.101.112": "Ed25519", "1.3.101.113": "Ed448", "1.3.101.110": "X25519", "1.3.101.111": "X448",
};
const CURVES: Record<string, { name: string; bits: number }> = {
  "1.2.840.10045.3.1.7": { name: "P-256 (prime256v1)", bits: 256 },
  "1.3.132.0.34": { name: "P-384 (secp384r1)", bits: 384 },
  "1.3.132.0.35": { name: "P-521 (secp521r1)", bits: 521 },
  "1.3.132.0.10": { name: "secp256k1", bits: 256 },
};
const EKU: Record<string, string> = {
  "1.3.6.1.5.5.7.3.1": "TLS server authentication", "1.3.6.1.5.5.7.3.2": "TLS client authentication", "1.3.6.1.5.5.7.3.3": "Code signing",
  "1.3.6.1.5.5.7.3.4": "Email protection", "1.3.6.1.5.5.7.3.8": "Time stamping", "1.3.6.1.5.5.7.3.9": "OCSP signing", "2.5.29.37.0": "Any extended key usage",
};
const EXTENSIONS: Record<string, string> = {
  "2.5.29.14": "Subject Key Identifier", "2.5.29.15": "Key Usage", "2.5.29.17": "Subject Alternative Name", "2.5.29.19": "Basic Constraints",
  "2.5.29.35": "Authority Key Identifier", "2.5.29.37": "Extended Key Usage", "2.5.29.31": "CRL Distribution Points", "1.3.6.1.5.5.7.1.1": "Authority Information Access",
  "2.5.29.32": "Certificate Policies", "2.5.29.30": "Name Constraints",
};
const KEY_USAGE_BITS = ["Digital Signature", "Non Repudiation", "Key Encipherment", "Data Encipherment", "Key Agreement", "Certificate Sign", "CRL Sign", "Encipher Only", "Decipher Only"];

const colonHex = (bytes: Uint8Array, upper = true) => {
  const hex = bytesToHex(bytes);
  return (hex.match(/.{2}/g) ?? []).map((h) => (upper ? h.toUpperCase() : h)).join(":");
};

function decodeString(node: DerNode): string {
  switch (node.tag) {
    case 0x1e: { // BMPString (UTF-16BE)
      let out = "";
      for (let i = 0; i + 1 < node.content.length; i += 2) out += String.fromCharCode((node.content[i] << 8) | node.content[i + 1]);
      return out;
    }
    case 0x14: case 0x13: case 0x16: // Teletex (treated as Latin-1), Printable, IA5
      return String.fromCharCode(...node.content);
    default:
      return new TextDecoder("utf-8", { fatal: false }).decode(node.content);
  }
}

function parseName(node: DerNode): Name {
  const parts: Name["parts"] = [];
  for (const rdn of node.children) {
    for (const atv of rdn.children) {
      const oid = decodeOid(atv.children[0].content);
      parts.push({ label: ATTRIBUTES[oid] ?? oid, value: decodeString(atv.children[1]) });
    }
  }
  return { parts, text: parts.map((p) => `${p.label}=${p.value}`).join(", ") };
}

function parseTime(node: DerNode): Date {
  const s = String.fromCharCode(...node.content);
  const m = node.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s);
  if (!m) throw new Error("The certificate has an unsupported time format.");
  let year = Number(m[1]);
  if (node.tag === 0x17) year += year >= 50 ? 1900 : 2000;
  return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)));
}

function bitLength(bytes: Uint8Array): number {
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  if (i === bytes.length) return 0;
  return (bytes.length - i - 1) * 8 + (32 - Math.clz32(bytes[i]));
}

function parseSpki(spki: DerNode): PublicKeyInfo {
  const algNode = spki.children[0];
  const oid = decodeOid(algNode.children[0].content);
  const algorithm = KEY_ALGS[oid] ?? oid;
  const bits = spki.children[1].content.subarray(1); // drop "unused bits" byte
  if (algorithm === "RSA") {
    const key = parseDer(bits);
    const modulus = key.children[0].content;
    const exponent = decodeInteger(key.children[1].content);
    const sizeBits = bitLength(modulus);
    return { algorithm, sizeBits, detail: `${sizeBits}-bit, exponent ${exponent}` };
  }
  if (algorithm === "EC") {
    const curveOid = algNode.children[1] ? decodeOid(algNode.children[1].content) : "";
    const curve = CURVES[curveOid];
    return { algorithm, sizeBits: curve?.bits, detail: curve ? curve.name : `curve ${curveOid || "unknown"}` };
  }
  return { algorithm, detail: algorithm === "Ed25519" ? "256-bit" : "" };
}

function generalName(node: DerNode): string {
  const text = () => String.fromCharCode(...node.content);
  switch (node.tag) {
    case 0x82: return `DNS: ${text()}`;
    case 0x81: return `Email: ${text()}`;
    case 0x86: return `URI: ${text()}`;
    case 0x87: {
      const c = node.content;
      if (c.length === 4) return `IP: ${Array.from(c).join(".")}`;
      if (c.length === 16) {
        const groups: string[] = [];
        for (let i = 0; i < 16; i += 2) groups.push(((c[i] << 8) | c[i + 1]).toString(16));
        return `IP: ${groups.join(":").replace(/(^|:)0(:0)+(:|$)/, "::")}`;
      }
      return `IP: ${colonHex(c)}`;
    }
    case 0xa4: return `Directory: ${parseName(node.children[0]).text}`;
    default: return `Other (tag ${node.tag.toString(16)})`;
  }
}

function parseExtensionValue(oid: string, octets: Uint8Array): string[] {
  try {
    const node = parseDer(octets);
    switch (oid) {
      case "2.5.29.17": return node.children.map(generalName);
      case "2.5.29.19": {
        const isCa = node.children[0]?.tag === 0x01 && node.children[0].content[0] !== 0;
        const pathLen = node.children.find((c) => c.tag === 0x02);
        return [isCa ? "CA: yes" : "CA: no", ...(pathLen ? [`Path length: ${decodeInteger(pathLen.content)}`] : [])];
      }
      case "2.5.29.15": {
        const bytes = node.content.subarray(1);
        return KEY_USAGE_BITS.filter((_, i) => i < bytes.length * 8 && bytes[i >> 3] & (0x80 >> (i & 7)));
      }
      case "2.5.29.37": return node.children.map((c) => { const o = decodeOid(c.content); return EKU[o] ?? o; });
      case "2.5.29.14": return [colonHex(node.content)];
      case "2.5.29.35": {
        const id = node.children.find((c) => c.tag === 0x80);
        return id ? [`Key ID: ${colonHex(id.content)}`] : ["(no key identifier)"];
      }
      default: return [`${octets.length} bytes`];
    }
  } catch {
    return ["(could not decode)"];
  }
}

function parseExtensionList(list: DerNode): Extension[] {
  return list.children.map((ext) => {
    const oid = decodeOid(ext.children[0].content);
    const critical = ext.children[1].tag === 0x01 && ext.children[1].content[0] !== 0;
    const octets = ext.children[ext.children.length - 1].content;
    return { oid, name: EXTENSIONS[oid] ?? oid, critical, value: parseExtensionValue(oid, octets) };
  });
}

async function fingerprints(der: Uint8Array) {
  const hash = async (alg: string) => colonHex(new Uint8Array(await crypto.subtle.digest(alg, toArrayBuffer(der))));
  return { sha1: await hash("SHA-1"), sha256: await hash("SHA-256") };
}

const sigAlgName = (node: DerNode) => { const oid = decodeOid(node.children[0].content); return SIGNATURE_ALGS[oid] ?? oid; };

export async function parseCertificateDer(der: Uint8Array): Promise<ParsedCertificate> {
  let root: DerNode;
  try { root = parseDer(der); } catch (e) { throw new Error(`This is not a valid certificate: ${e instanceof Error ? e.message : "bad DER"}`); }
  try {
    const tbs = root.children[0];
    let i = 0;
    let version = 1;
    if (tbs.children[0].tag === 0xa0) { version = decodeInteger(tbs.children[0].children[0].content) + 1; i = 1; }
    const serial = bytesToHex(tbs.children[i].content.length > 1 && tbs.children[i].content[0] === 0 ? tbs.children[i].content.subarray(1) : tbs.children[i].content).toUpperCase();
    const issuer = parseName(tbs.children[i + 2]);
    const subject = parseName(tbs.children[i + 4]);
    const validity = tbs.children[i + 3];
    const extNode = tbs.children.find((c) => c.tag === 0xa3);
    return {
      kind: "certificate", version, serial,
      signatureAlgorithm: sigAlgName(root.children[1]),
      issuer, subject,
      notBefore: parseTime(validity.children[0]), notAfter: parseTime(validity.children[1]),
      publicKey: parseSpki(tbs.children[i + 5]),
      extensions: extNode ? parseExtensionList(extNode.children[0]) : [],
      selfIssued: issuer.text === subject.text,
      fingerprints: await fingerprints(der),
    };
  } catch (e) {
    throw new Error(`This is not a valid certificate: ${e instanceof Error ? e.message : "unexpected structure"}`);
  }
}

export async function parseCsrDer(der: Uint8Array): Promise<ParsedCertificate> {
  let root: DerNode;
  try { root = parseDer(der); } catch (e) { throw new Error(`This is not a valid certificate request: ${e instanceof Error ? e.message : "bad DER"}`); }
  try {
    const info = root.children[0];
    const attrs = info.children.find((c) => c.tag === 0xa0);
    let extensions: Extension[] = [];
    for (const attr of attrs?.children ?? []) {
      if (decodeOid(attr.children[0].content) === "1.2.840.113549.1.9.14") extensions = parseExtensionList(attr.children[1].children[0]);
    }
    const subject = parseName(info.children[1]);
    return {
      kind: "csr", version: decodeInteger(info.children[0].content) + 1,
      signatureAlgorithm: sigAlgName(root.children[1]),
      subject, publicKey: parseSpki(info.children[2]), extensions, selfIssued: false,
      fingerprints: await fingerprints(der),
    };
  } catch (e) {
    throw new Error(`This is not a valid certificate request: ${e instanceof Error ? e.message : "unexpected structure"}`);
  }
}

export type ValidityState = "valid" | "expired" | "not-yet-valid";
export function validityState(cert: ParsedCertificate, now = new Date()): { state: ValidityState; daysLeft: number } | undefined {
  if (!cert.notBefore || !cert.notAfter) return undefined;
  const daysLeft = Math.floor((cert.notAfter.getTime() - now.getTime()) / 86_400_000);
  if (now < cert.notBefore) return { state: "not-yet-valid", daysLeft };
  if (now > cert.notAfter) return { state: "expired", daysLeft };
  return { state: "valid", daysLeft };
}

/** Parse every certificate or request in pasted PEM text, or a single DER/Base64 body. */
export async function parseCertificateText(text: string): Promise<ParsedCertificate[]> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste a PEM certificate or certificate request first.");
  const blocks = [...trimmed.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END \1-----/g)].map((m) => m[0]);
  if (blocks.length === 0) throw new Error("No PEM block found. Expected -----BEGIN CERTIFICATE----- or -----BEGIN CERTIFICATE REQUEST-----.");
  const out: ParsedCertificate[] = [];
  for (const block of blocks) {
    const { label, der } = parsePem(block);
    if (label === "CERTIFICATE" || label === "TRUSTED CERTIFICATE" || label === "X509 CERTIFICATE") out.push(await parseCertificateDer(der));
    else if (label === "CERTIFICATE REQUEST" || label === "NEW CERTIFICATE REQUEST") out.push(await parseCsrDer(der));
    else if (/PRIVATE KEY/.test(label)) throw new Error("That is a private key. Paste a certificate; this tool never needs your private key.");
    else throw new Error(`Unsupported PEM type "${label}". Paste a certificate or certificate request.`);
  }
  return out;
}

/** Parse a file's bytes: PEM text, or raw DER (certificate first, then request). */
export async function parseCertificateFile(bytes: Uint8Array): Promise<ParsedCertificate[]> {
  const head = new TextDecoder().decode(bytes.subarray(0, 64));
  if (head.includes("-----BEGIN")) return parseCertificateText(new TextDecoder().decode(bytes));
  try { return [await parseCertificateDer(bytes)]; }
  catch (certError) {
    try { return [await parseCsrDer(bytes)]; } catch { throw certError; }
  }
}
