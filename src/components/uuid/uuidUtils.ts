// UUID Generation utilities - browser only

export function generateV4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatBytes(bytes);
}

function formatBytes(b: Uint8Array): string {
  const hex = Array.from(b).map(v => v.toString(16).padStart(2, "0"));
  return `${hex.slice(0,4).join("")}-${hex.slice(4,6).join("")}-${hex.slice(6,8).join("")}-${hex.slice(8,10).join("")}-${hex.slice(10).join("")}`;
}

// v1 - timestamp based (simplified browser implementation)
export function generateV1(): string {
  const now = BigInt(Date.now()) * 10000n + 122192928000000000n; // 100ns intervals since UUID epoch
  const timeLow = Number(now & 0xFFFFFFFFn);
  const timeMid = Number((now >> 32n) & 0xFFFFn);
  const timeHiAndVersion = Number((now >> 48n) & 0x0FFFn) | 0x1000;
  const clockSeq = (crypto.getRandomValues(new Uint16Array(1))[0] & 0x3FFF) | 0x8000;
  const node = crypto.getRandomValues(new Uint8Array(6));

  const hex = (n: number, len: number) => n.toString(16).padStart(len, "0");
  return `${hex(timeLow,8)}-${hex(timeMid,4)}-${hex(timeHiAndVersion,4)}-${hex(clockSeq,4)}-${Array.from(node).map(b=>b.toString(16).padStart(2,"0")).join("")}`;
}

// v3/v5 - namespace based
async function namespaceUUID(namespace: string, name: string, version: 3 | 5): Promise<string> {
  const nsBytes = parseUUID(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(nsBytes.length + nameBytes.length);
  data.set(nsBytes);
  data.set(nameBytes, nsBytes.length);

  const algo = version === 3 ? "MD5" : "SHA-1";
  let hash: Uint8Array;

  if (algo === "MD5") {
    // MD5 not in Web Crypto, use simple implementation
    hash = md5(data);
  } else {
    const buf = await crypto.subtle.digest("SHA-1", data);
    hash = new Uint8Array(buf);
  }

  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | (version << 4);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatBytes(bytes);
}

export async function generateV3(namespace: string, name: string): Promise<string> {
  return namespaceUUID(namespace, name, 3);
}

export async function generateV5(namespace: string, name: string): Promise<string> {
  return namespaceUUID(namespace, name, 5);
}

function parseUUID(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// Simple MD5 for v3 UUID (no crypto.subtle support)
function md5(data: Uint8Array): Uint8Array {
  // Minimal MD5 - for UUID generation only
  function md5cycle(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    const ff = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => { a += (b&c | ~b&d) + x + t; return ((a<<s | a>>>(32-s)) + b) | 0; };
    const gg = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => { a += (b&d | c&~d) + x + t; return ((a<<s | a>>>(32-s)) + b) | 0; };
    const hh = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => { a += (b^c^d) + x + t; return ((a<<s | a>>>(32-s)) + b) | 0; };
    const ii = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => { a += (c^(b|~d)) + x + t; return ((a<<s | a>>>(32-s)) + b) | 0; };
    a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1770035416);d=ff(d,a,b,c,k[9],12,-1958414417);c=ff(c,d,a,b,k[10],17,-42063);b=ff(b,c,d,a,k[11],22,-1990404162);
    a=ff(a,b,c,d,k[12],7,1804603682);d=ff(d,a,b,c,k[13],12,-40341101);c=ff(c,d,a,b,k[14],17,-1502002290);b=ff(b,c,d,a,k[15],22,1236535329);
    a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);
    a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022574463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);
    a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560198380);b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);
    x[0] = (a + x[0]) | 0; x[1] = (b + x[1]) | 0; x[2] = (c + x[2]) | 0; x[3] = (d + x[3]) | 0;
  }

  const n = data.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let tail: number[] = [];
  let i: number;

  for (i = 64; i <= n; i += 64) {
    const k: number[] = [];
    for (let j = i - 64; j < i; j += 4)
      k.push(data[j] | (data[j+1] << 8) | (data[j+2] << 16) | (data[j+3] << 24));
    md5cycle(state, k);
  }

  for (let j = i - 64; j < n; j++) tail.push(data[j]);
  tail.push(0x80);
  while (tail.length % 64 !== 56) tail.push(0);
  const bits = n * 8;
  tail.push(bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff, 0, 0, 0, 0);
  
  for (let j = 0; j < tail.length; j += 64) {
    const k: number[] = [];
    for (let m = 0; m < 64; m += 4)
      k.push(tail[j+m] | (tail[j+m+1] << 8) | (tail[j+m+2] << 16) | (tail[j+m+3] << 24));
    md5cycle(state, k);
  }

  const result = new Uint8Array(16);
  for (let j = 0; j < 4; j++) {
    result[j*4] = state[j] & 0xff;
    result[j*4+1] = (state[j] >> 8) & 0xff;
    result[j*4+2] = (state[j] >> 16) & 0xff;
    result[j*4+3] = (state[j] >> 24) & 0xff;
  }
  return result;
}

// Well-known namespaces
export const NAMESPACES = {
  DNS: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  URL: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  OID: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  X500: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
};

// Formatting
export function formatUUID(uuid: string, opts: { uppercase?: boolean; hyphens?: boolean; braces?: boolean; urn?: boolean }): string {
  let result = uuid;
  if (!opts.hyphens) result = result.replace(/-/g, "");
  if (opts.uppercase) result = result.toUpperCase();
  if (opts.braces) result = `{${result}}`;
  if (opts.urn) result = `urn:uuid:${result}`;
  return result;
}

// Validation
export interface UUIDValidation {
  valid: boolean;
  version?: number;
  variant?: string;
}

export function validateUUID(input: string): UUIDValidation {
  const clean = input.replace(/^\{|\}$/g, "").replace(/^urn:uuid:/i, "").trim();
  const regex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  if (!regex.test(clean)) return { valid: false };

  const hex = clean.replace(/-/g, "");
  const version = parseInt(hex[12], 16);
  const variantBits = parseInt(hex[16], 16);
  let variant = "unknown";
  if ((variantBits & 0x8) === 0) variant = "NCS";
  else if ((variantBits & 0xC) === 0x8) variant = "RFC 4122";
  else if ((variantBits & 0xE) === 0xC) variant = "Microsoft";
  else variant = "Future";

  return { valid: true, version, variant };
}

// v1 decoder
export function decodeV1(uuid: string): { timestamp: Date; clockSeq: number } | null {
  const v = validateUUID(uuid);
  if (!v.valid || v.version !== 1) return null;
  const hex = uuid.replace(/-/g, "");
  const timeLow = hex.substring(0, 8);
  const timeMid = hex.substring(8, 12);
  const timeHi = hex.substring(13, 16);
  const timestamp100ns = BigInt(`0x${timeHi}${timeMid}${timeLow}`);
  const unixMs = Number((timestamp100ns - 122192928000000000n) / 10000n);
  const clockSeq = parseInt(hex.substring(16, 20), 16) & 0x3FFF;
  return { timestamp: new Date(unixMs), clockSeq };
}

// Code snippets
export const CODE_SNIPPETS: Record<string, { lang: string; code: string }> = {
  JavaScript: { lang: "javascript", code: `crypto.randomUUID();\n// or\n'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {\n  const r = Math.random() * 16 | 0;\n  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);\n});` },
  Python: { lang: "python", code: `import uuid\nprint(uuid.uuid4())` },
  PHP: { lang: "php", code: `<?php\necho sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',\n  mt_rand(0, 0xffff), mt_rand(0, 0xffff),\n  mt_rand(0, 0xffff),\n  mt_rand(0, 0x0fff) | 0x4000,\n  mt_rand(0, 0x3fff) | 0x8000,\n  mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)\n);` },
  Java: { lang: "java", code: `import java.util.UUID;\nUUID.randomUUID().toString();` },
};

// History
const UUID_HISTORY_KEY = "toolzy_uuid_history";

export interface UUIDHistoryEntry {
  id: string;
  timestamp: number;
  version: string;
  count: number;
  preview: string;
}

export function loadUUIDHistory(): UUIDHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(UUID_HISTORY_KEY) || "[]"); } catch { return []; }
}

export function saveUUIDHistory(entry: UUIDHistoryEntry) {
  const h = loadUUIDHistory();
  h.unshift(entry);
  localStorage.setItem(UUID_HISTORY_KEY, JSON.stringify(h.slice(0, 10)));
}
