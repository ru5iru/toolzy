/**
 * Web Crypto produces ECDSA signatures as raw r||s (IEEE P1363); OpenSSL and most
 * other tools use ASN.1 DER. These helpers convert between the two.
 */

function trimLeadingZeros(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  return bytes.subarray(i);
}

function derInteger(value: Uint8Array): Uint8Array {
  const v = trimLeadingZeros(value);
  const needsPad = v[0] & 0x80;
  const body = needsPad ? Uint8Array.from([0, ...v]) : v;
  return Uint8Array.from([0x02, ...derLength(body.length), ...body]);
}

function derLength(len: number): number[] {
  if (len < 0x80) return [len];
  if (len < 0x100) return [0x81, len];
  return [0x82, len >> 8, len & 0xff];
}

export function ecdsaRawToDer(raw: Uint8Array): Uint8Array {
  if (raw.length === 0 || raw.length % 2 !== 0) throw new Error("Malformed raw ECDSA signature.");
  const half = raw.length / 2;
  const r = derInteger(raw.subarray(0, half));
  const s = derInteger(raw.subarray(half));
  const body = Uint8Array.from([...r, ...s]);
  return Uint8Array.from([0x30, ...derLength(body.length), ...body]);
}

function readLength(buf: Uint8Array, offset: number): { length: number; next: number } {
  const first = buf[offset];
  if (first === undefined) throw new Error("Malformed DER signature.");
  if (first < 0x80) return { length: first, next: offset + 1 };
  const count = first & 0x7f;
  if (count < 1 || count > 2) throw new Error("Malformed DER signature.");
  let length = 0;
  for (let i = 0; i < count; i++) {
    const b = buf[offset + 1 + i];
    if (b === undefined) throw new Error("Malformed DER signature.");
    length = (length << 8) | b;
  }
  return { length, next: offset + 1 + count };
}

/** `coordLength` is the curve size in bytes: 32 for P-256, 48 for P-384. */
export function ecdsaDerToRaw(der: Uint8Array, coordLength: number): Uint8Array {
  if (der[0] !== 0x30) throw new Error("Malformed DER signature.");
  const seq = readLength(der, 1);
  if (seq.next + seq.length !== der.length) throw new Error("Malformed DER signature.");
  const out = new Uint8Array(coordLength * 2);
  let offset = seq.next;
  for (let part = 0; part < 2; part++) {
    if (der[offset] !== 0x02) throw new Error("Malformed DER signature.");
    const len = readLength(der, offset + 1);
    let value = der.subarray(len.next, len.next + len.length);
    if (value.length !== len.length) throw new Error("Malformed DER signature.");
    value = trimLeadingZeros(value);
    if (value.length > coordLength) throw new Error("ECDSA signature does not match this curve.");
    out.set(value, part * coordLength + (coordLength - value.length));
    offset = len.next + len.length;
  }
  if (offset !== der.length) throw new Error("Malformed DER signature.");
  return out;
}
