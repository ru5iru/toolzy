/** Minimal DER reader/writer, enough for PKCS#8 encryption envelopes and X.509 inspection. */

export interface DerNode {
  /** Full tag byte (class, constructed bit and number for low tags). */
  tag: number;
  /** Content bytes (without header). */
  content: Uint8Array;
  /** Header + content bytes. */
  raw: Uint8Array;
  /** Children when the node is constructed. */
  children: DerNode[];
}

const CONSTRUCTED = 0x20;

export function readDer(bytes: Uint8Array, offset = 0): { node: DerNode; end: number } {
  if (offset + 2 > bytes.length) throw new Error("Truncated DER data.");
  const tag = bytes[offset];
  if ((tag & 0x1f) === 0x1f) throw new Error("Unsupported high-tag-number DER element.");
  let pos = offset + 1;
  let length = bytes[pos++];
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4) throw new Error("Unsupported DER length encoding.");
    if (pos + count > bytes.length) throw new Error("Truncated DER data.");
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + bytes[pos++];
  }
  const end = pos + length;
  if (end > bytes.length) throw new Error("Truncated DER data.");
  const content = bytes.subarray(pos, end);
  const children: DerNode[] = [];
  if (tag & CONSTRUCTED) {
    let p = 0;
    while (p < content.length) {
      const child = readDer(content, p);
      children.push(child.node);
      p = child.end;
    }
  }
  return { node: { tag, content, raw: bytes.subarray(offset, end), children }, end };
}

export function parseDer(bytes: Uint8Array): DerNode {
  const { node, end } = readDer(bytes, 0);
  if (end !== bytes.length) throw new Error("Unexpected trailing data after DER element.");
  return node;
}

function lengthBytes(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  return [0x80 | out.length, ...out];
}

export function derEncode(tag: number, ...parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, p) => sum + p.length, 0);
  const header = [tag, ...lengthBytes(size)];
  const out = new Uint8Array(header.length + size);
  out.set(header, 0);
  let pos = header.length;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

export const derSequence = (...parts: Uint8Array[]) => derEncode(0x30, ...parts);
export const derOctetString = (bytes: Uint8Array) => derEncode(0x04, bytes);
export const derNull = () => new Uint8Array([0x05, 0x00]);

export function derInteger(value: number): Uint8Array {
  const bytes: number[] = [];
  for (let v = value; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256);
  if (bytes.length === 0) bytes.push(0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return derEncode(0x02, new Uint8Array(bytes));
}

export function derOid(oid: string): Uint8Array {
  const parts = oid.split(".").map(Number);
  const out: number[] = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const chunk = [part & 0x7f];
    for (let v = Math.floor(part / 128); v > 0; v = Math.floor(v / 128)) chunk.unshift((v & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return derEncode(0x06, new Uint8Array(out));
}

export function decodeOid(content: Uint8Array): string {
  if (content.length === 0) throw new Error("Empty OBJECT IDENTIFIER.");
  const parts: number[] = [Math.floor(content[0] / 40), content[0] % 40];
  let value = 0;
  for (let i = 1; i < content.length; i++) {
    value = value * 128 + (content[i] & 0x7f);
    if (!(content[i] & 0x80)) { parts.push(value); value = 0; }
  }
  return parts.join(".");
}

export function decodeInteger(content: Uint8Array): number {
  let v = 0;
  for (const b of content) v = v * 256 + b;
  return v;
}
