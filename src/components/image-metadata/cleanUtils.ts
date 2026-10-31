import { inspectImage, validateSize, type MetadataRow } from "./metadataUtils";

/** Removable metadata block kinds. Removal is lossless: whole segments/chunks are dropped, image data is copied byte-for-byte. */
export type BlockKind = "exif" | "xmp" | "iptc" | "comment" | "text" | "time" | "other";
export type CleanFormat = "JPEG" | "PNG";
export interface Segment { kind: BlockKind | "essential"; name: string; start: number; end: number }
export interface Structure { format: CleanFormat; segments: Segment[]; width?: number; height?: number; orientation?: number; animated: boolean; hasIcc: boolean; hasAlpha: boolean }
export interface CleanOptions { remove: BlockKind[]; keepOrientation: boolean; mode: "all" | "selective" }
export const BLOCK_KINDS: BlockKind[] = ["exif", "xmp", "iptc", "comment", "text", "time", "other"];
export const KIND_INFO: Record<BlockKind, { label: string; description: string }> = {
  exif: { label: "EXIF block", description: "Camera and lens, serial numbers, capture dates, GPS location, software, and the embedded EXIF thumbnail. These fields share one block and are removed together." },
  xmp: { label: "XMP metadata", description: "Creator, rights, titles, keywords, location descriptions, and editing history stored as XMP." },
  iptc: { label: "IPTC / Photoshop", description: "Byline, copyright, captions, keywords, and location fields in the Photoshop (APP13) block." },
  comment: { label: "Comments", description: "Free-text JPEG comment segments." },
  text: { label: "PNG text chunks", description: "tEXt, zTXt, and iTXt entries such as Author, Description, Software, or Creation Time." },
  time: { label: "PNG modification time", description: "The tIME chunk recording when the image was last changed." },
  other: { label: "Other ancillary data", description: "Previews, multi-picture data, application-specific segments, unknown ancillary chunks, and data after the image end." },
};

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
const startsWith = (b: Uint8Array, text: string) => b.length >= text.length && ascii(b, 0, text.length) === text;

export function readTiffOrientation(tiff: Uint8Array): number | undefined {
  if (tiff.length < 8) return;
  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!le && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return;
  const v = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd = v.getUint32(4, le);
  if (ifd + 2 > tiff.length) return;
  const count = v.getUint16(ifd, le);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > tiff.length) return;
    if (v.getUint16(e, le) === 0x0112 && v.getUint16(e + 2, le) === 3) {
      const o = v.getUint16(e + 8, le);
      return o >= 1 && o <= 8 ? o : undefined;
    }
  }
}
/** Minimal big-endian TIFF containing only IFD0 Orientation, so visual rotation survives EXIF removal. */
export function orientationTiff(o: number): Uint8Array {
  return new Uint8Array([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0]);
}

export function scanJpeg(b: Uint8Array): Structure {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error("Not a JPEG file.");
  const s: Structure = { format: "JPEG", segments: [{ kind: "essential", name: "SOI", start: 0, end: 2 }], animated: false, hasIcc: false, hasAlpha: false };
  const corrupt = () => new Error("JPEG structure is truncated or corrupted; no clean copy was created.");
  let p = 2;
  for (;;) {
    if (p + 1 >= b.length || b[p] !== 0xff) throw corrupt();
    while (b[p + 1] === 0xff) p++;
    const m = b[p + 1];
    if (m === 0xd9) throw corrupt();
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { s.segments.push({ kind: "essential", name: "Marker", start: p, end: p + 2 }); p += 2; continue; }
    if (p + 4 > b.length) throw corrupt();
    const len = (b[p + 2] << 8) | b[p + 3], end = p + 2 + len;
    if (len < 2 || end > b.length) throw corrupt();
    const data = b.subarray(p + 4, end);
    if (m === 0xda) {
      // Walk entropy-coded data and any later marker segments up to EOI.
      let q = end;
      for (;;) {
        if (q + 1 >= b.length) throw corrupt();
        if (b[q] !== 0xff) { q++; continue; }
        const n = b[q + 1];
        if (n === 0xff) { q++; continue; }
        if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) { q += 2; continue; }
        if (n === 0xd9) { q += 2; break; }
        if (q + 4 > b.length) throw corrupt();
        const l = (b[q + 2] << 8) | b[q + 3];
        if (l < 2 || q + 2 + l > b.length) throw corrupt();
        q += 2 + l;
      }
      s.segments.push({ kind: "essential", name: "Image data", start: p, end: q });
      if (q < b.length) s.segments.push({ kind: "other", name: "Data after image end", start: q, end: b.length });
      if (!s.width) throw corrupt();
      return s;
    }
    let kind: Segment["kind"] = "essential", name = `Marker 0x${m.toString(16).toUpperCase()}`;
    if (m === 0xe1 && startsWith(data, "Exif\0")) { kind = "exif"; name = "APP1 EXIF"; s.orientation = readTiffOrientation(data.subarray(6)); }
    else if (m === 0xe1 && startsWith(data, "http://ns.adobe.com/")) { kind = "xmp"; name = "APP1 XMP"; }
    else if (m === 0xed) { kind = "iptc"; name = "APP13 Photoshop/IPTC"; }
    else if (m === 0xe2 && startsWith(data, "ICC_PROFILE\0")) { name = "APP2 ICC profile"; s.hasIcc = true; }
    else if (m === 0xe0 && startsWith(data, "JFIF\0")) name = "APP0 JFIF";
    else if (m === 0xee && startsWith(data, "Adobe")) name = "APP14 Adobe colour transform";
    else if (m === 0xfe) { kind = "comment"; name = "Comment"; }
    else if (m >= 0xe0 && m <= 0xef) { kind = "other"; name = `APP${m - 0xe0} segment`; }
    else if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && data.length >= 5) { s.height = (data[1] << 8) | data[2]; s.width = (data[3] << 8) | data[4]; name = "Frame header"; }
    s.segments.push({ kind, name, start: p, end });
    p = end;
  }
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes: Uint8Array): number { let c = 0xffffffff; for (const x of bytes) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(Array.from(type, c => c.charCodeAt(0)), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD", "hIST", "sPLT", "acTL", "fcTL", "fdAT", "cICP", "mDCv", "cLLi"]);
export function scanPng(b: Uint8Array): Structure {
  if (!PNG_SIG.every((n, i) => b[i] === n)) throw new Error("Not a PNG file.");
  const s: Structure = { format: "PNG", segments: [{ kind: "essential", name: "Signature", start: 0, end: 8 }], animated: false, hasIcc: false, hasAlpha: false };
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8;
  for (;;) {
    if (p + 12 > b.length) throw new Error("PNG structure is truncated; no clean copy was created.");
    const len = v.getUint32(p), type = ascii(b, p + 4, 4), end = p + 12 + len;
    if (end > b.length || !/^[A-Za-z]{4}$/.test(type)) throw new Error("PNG structure is corrupted; no clean copy was created.");
    if (crc32(b.subarray(p + 4, p + 8 + len)) !== v.getUint32(p + 8 + len)) throw new Error(`PNG chunk ${type} failed its checksum; no clean copy was created.`);
    const data = b.subarray(p + 8, p + 8 + len);
    let kind: Segment["kind"] = "essential";
    if (type === "IHDR") { s.width = v.getUint32(p + 8); s.height = v.getUint32(p + 12); s.hasAlpha = data[9] === 4 || data[9] === 6; }
    else if (type === "tRNS") s.hasAlpha = true;
    else if (type === "acTL") s.animated = true;
    else if (type === "iCCP") s.hasIcc = true;
    else if (type === "eXIf") { kind = "exif"; s.orientation = readTiffOrientation(data); }
    else if (type === "iTXt" && startsWith(data, "XML:com.adobe.xmp\0")) kind = "xmp";
    else if (type === "tEXt" || type === "zTXt" || type === "iTXt") kind = "text";
    else if (type === "tIME") kind = "time";
    else if (!PNG_KEEP.has(type) && type[0] === type[0].toLowerCase()) kind = "other"; // unknown ancillary; unknown critical chunks are kept
    s.segments.push({ kind, name: type, start: p, end });
    p = end;
    if (type === "IEND") {
      if (p < b.length) s.segments.push({ kind: "other", name: "Data after IEND", start: p, end: b.length });
      if (!s.width) throw new Error("PNG is missing its header chunk.");
      return s;
    }
  }
}
export function scanStructure(b: Uint8Array): Structure {
  if (b[0] === 0xff && b[1] === 0xd8) return scanJpeg(b);
  if (PNG_SIG.every((n, i) => b[i] === n)) return scanPng(b);
  throw new Error("Metadata removal supports JPEG and PNG only. TIFF is not supported because rewriting its offset-based structure safely is not implemented.");
}
export const presentKinds = (s: Structure) => BLOCK_KINDS.filter(k => s.segments.some(seg => seg.kind === k));

/** Builds the cleaned bytes. Never mutates the input. */
export function cleanBytes(input: Uint8Array, options: CleanOptions): { output: Uint8Array; structure: Structure; orientationKept: boolean } {
  const structure = scanStructure(input);
  const remove = new Set(options.mode === "all" ? presentKinds(structure) : options.remove);
  const parts: Uint8Array[] = [];
  const o = structure.orientation;
  const needOrientation = options.keepOrientation && remove.has("exif") && o !== undefined && o > 1;
  let inserted = false;
  for (const seg of structure.segments) {
    const isJpegAnchor = structure.format === "JPEG" && seg.kind === "essential" && seg.name !== "SOI" && seg.name !== "APP0 JFIF";
    const isPngAnchor = structure.format === "PNG" && seg.name === "IDAT";
    if (needOrientation && !inserted && (isJpegAnchor || isPngAnchor)) {
      const tiff = orientationTiff(o!);
      if (structure.format === "JPEG") {
        const app1 = new Uint8Array(4 + 6 + tiff.length);
        app1.set([0xff, 0xe1, (app1.length - 2) >> 8, (app1.length - 2) & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0]);
        app1.set(tiff, 10);
        parts.push(app1);
      } else parts.push(pngChunk("eXIf", tiff));
      inserted = true;
    }
    if (seg.kind !== "essential" && remove.has(seg.kind)) continue;
    parts.push(input.slice(seg.start, seg.end));
  }
  const output = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let off = 0;
  for (const part of parts) { output.set(part, off); off += part.length; }
  return { output, structure, orientationKept: inserted };
}

export type BlockStatus = "Removed" | "Still present" | "Preserved" | "Lost" | "Not applicable";
export type FieldStatus = "Removed" | "Still present" | "Retained" | "Lost" | "Not verified";
export interface VerificationReport {
  verified: boolean; issues: string[];
  blocks: { kind: BlockKind; label: string; status: BlockStatus }[];
  fields: { tag: string; label: string; status: FieldStatus; original: string; cleaned?: string }[];
  imageDataIdentical: boolean; dimensionsMatch: boolean; orientationKept: boolean;
}
export function kindOfTag(tag: string, format: CleanFormat): BlockKind | "essential" | undefined {
  const g = tag.split(".")[0].toLowerCase();
  if (["ifd0", "exif", "gps", "interop", "ifd1", "thumbnail"].includes(g)) return "exif";
  if (g === "xmp") return "xmp";
  if (g === "iptc" || g === "photoshop") return "iptc";
  if (g === "icc" || g === "jfif") return "essential";
  if (g === "ihdr") return format === "PNG" && !/^ihdr\.(ImageWidth|ImageHeight|BitDepth|ColorType|Compression|Filter|Interlace)$/.test(tag) ? "text" : "essential";
  return undefined;
}
const essentialBytes = (b: Uint8Array, s: Structure) => s.segments.filter(x => x.kind === "essential").map(x => b.subarray(x.start, x.end));
function sameBytes(a: Uint8Array[], b: Uint8Array[]) {
  const la = a.reduce((n, x) => n + x.length, 0), lb = b.reduce((n, x) => n + x.length, 0);
  if (la !== lb) return false;
  const flat = (xs: Uint8Array[]) => { const o = new Uint8Array(la); let i = 0; for (const x of xs) { o.set(x, i); i += x.length; } return o; };
  const fa = flat(a), fb = flat(b);
  for (let i = 0; i < la; i++) if (fa[i] !== fb[i]) return false;
  return true;
}
const embedded = (rows: MetadataRow[]) => rows.filter(r => r.category !== "Overview");

export function verifyClean(args: {
  format: CleanFormat; remove: BlockKind[]; mode: CleanOptions["mode"]; orientationKept: boolean;
  original: { bytes: Uint8Array; structure: Structure; rows: MetadataRow[] };
  cleaned: { bytes: Uint8Array; structure?: Structure; rows?: MetadataRow[]; error?: string };
}): VerificationReport {
  const { original, cleaned, format, orientationKept } = args;
  const removeSet = new Set(args.mode === "all" ? presentKinds(original.structure) : args.remove);
  const issues: string[] = [];
  if (cleaned.error || !cleaned.structure || !cleaned.rows) issues.push(`The cleaned file could not be re-parsed: ${cleaned.error ?? "unknown error"}`);
  const outKinds = new Set(cleaned.structure ? presentKinds(cleaned.structure) : []);
  const origKinds = new Set(presentKinds(original.structure));
  const blocks = BLOCK_KINDS.map(kind => {
    let status: BlockStatus;
    if (!origKinds.has(kind)) status = kind === "exif" && orientationKept ? "Preserved" : "Not applicable";
    else if (removeSet.has(kind)) status = outKinds.has(kind) && !(kind === "exif" && orientationKept) ? "Still present" : "Removed";
    else status = outKinds.has(kind) ? "Preserved" : "Lost";
    return { kind, label: KIND_INFO[kind].label, status };
  });
  if (orientationKept && cleaned.structure) {
    // The only EXIF allowed back is the minimal orientation block we wrote.
    const exifSegs = cleaned.structure.segments.filter(s => s.kind === "exif");
    const maxLen = format === "JPEG" ? 36 : 38;
    if (exifSegs.length !== 1 || exifSegs[0].end - exifSegs[0].start > maxLen) blocks.find(b => b.kind === "exif")!.status = "Still present";
  }
  const outRows = new Map((cleaned.rows ? embedded(cleaned.rows) : []).map(r => [r.tag, r.value]));
  const fields = embedded(original.rows).map(row => {
    const kind = kindOfTag(row.tag, format);
    const after = outRows.get(row.tag);
    let status: FieldStatus;
    if (!cleaned.rows) status = "Not verified";
    else if (after !== undefined) {
      if (kind === "essential" || (kind && !removeSet.has(kind)) || (orientationKept && /^ifd0\.Orientation$/.test(row.tag))) status = "Retained";
      else if (kind) status = "Still present";
      else status = "Not verified";
    } else status = kind && kind !== "essential" && !removeSet.has(kind) ? "Lost" : "Removed";
    return { tag: row.tag, label: row.label, status, original: row.value, cleaned: after };
  });
  for (const b of blocks) {
    if (b.status === "Still present") issues.push(`${b.label} is still detectable in the cleaned file.`);
    if (b.status === "Lost") issues.push(`${b.label} was meant to be preserved but is missing.`);
  }
  for (const f of fields) {
    if (f.status === "Still present") issues.push(`Field ${f.tag} is still present.`);
    if (f.status === "Lost") issues.push(`Field ${f.tag} was meant to be preserved but is missing.`);
    if (f.status === "Not verified" && args.mode === "all") issues.push(`Field ${f.tag} is still detected and its source could not be classified.`);
  }
  const imageDataIdentical = !!cleaned.structure && sameBytes(essentialBytes(original.bytes, original.structure), essentialBytes(cleaned.bytes, cleaned.structure));
  if (cleaned.structure && !imageDataIdentical) issues.push("Image data and required structures are not byte-identical to the original.");
  const dimensionsMatch = !!cleaned.structure && cleaned.structure.width === original.structure.width && cleaned.structure.height === original.structure.height;
  if (cleaned.structure && !dimensionsMatch) issues.push("Image dimensions changed.");
  return { verified: issues.length === 0, issues, blocks, fields, imageDataIdentical, dimensionsMatch, orientationKept };
}

export function cleanedFilename(name: string, format: CleanFormat): string {
  const base = (name.replace(/\.[^.]*$/, "").normalize("NFKC").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 80)) || "image";
  return `${base}-cleaned.${format === "JPEG" ? "jpg" : "png"}`;
}
export const mimeFor = (f: CleanFormat) => (f === "JPEG" ? "image/jpeg" : "image/png");

export interface CleanResult {
  output: ArrayBuffer; filename: string; mime: string; format: CleanFormat; report: VerificationReport;
  original: { size: number; width?: number; height?: number; animated: boolean; hasIcc: boolean; hasAlpha: boolean };
  cleaned: { size: number; width?: number; height?: number; animated: boolean; hasIcc: boolean; hasAlpha: boolean };
}
export async function createCleanCopy(buffer: ArrayBuffer, file: { name: string; size: number; type: string; lastModified: number }, options: CleanOptions): Promise<CleanResult> {
  validateSize(buffer.byteLength);
  const input = new Uint8Array(buffer);
  const { output, structure, orientationKept } = cleanBytes(input, options);
  const originalInspection = await inspectImage(buffer, file);
  const filename = cleanedFilename(file.name, structure.format), mime = mimeFor(structure.format);
  const outBuffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  let cleanedStructure: Structure | undefined, cleanedRows: MetadataRow[] | undefined, error: string | undefined;
  try {
    cleanedStructure = scanStructure(output);
    cleanedRows = (await inspectImage(outBuffer.slice(0), { name: filename, size: output.length, type: mime, lastModified: file.lastModified })).rows;
  } catch (e) { error = e instanceof Error ? e.message : String(e); }
  const report = verifyClean({ format: structure.format, remove: options.remove, mode: options.mode, orientationKept, original: { bytes: input, structure, rows: originalInspection.rows }, cleaned: { bytes: output, structure: cleanedStructure, rows: cleanedRows, error } });
  const facts = (s: Structure | undefined, size: number) => ({ size, width: s?.width, height: s?.height, animated: !!s?.animated, hasIcc: !!s?.hasIcc, hasAlpha: !!s?.hasAlpha });
  return { output: outBuffer, filename, mime, format: structure.format, report, original: facts(structure, input.length), cleaned: facts(cleanedStructure, output.length) };
}
