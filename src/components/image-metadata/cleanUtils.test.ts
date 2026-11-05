import { describe, expect, it, vi } from "vitest";
import { cleanBytes, cleanedFilename, createCleanCopy, crc32, mimeFor, pngChunk, scanStructure, verifyClean } from "./cleanUtils";
import { inspectImage } from "./metadataUtils";
import { CleanSession, type CleanWorkerPort } from "./cleanSession";

const enc = (s: string) => Array.from(s, c => c.charCodeAt(0));
// Synthetic big-endian TIFF: IFD0 Make, Orientation, DateTime, GPS pointer -> GPS IFD with latitude ref (fictional values).
function tiff(orientation = 6) {
  const make = enc("Synthetic Cam\0"), date = enc("2000:01:01 00:00:00\0");
  const ifd0 = 8, entries = 4, gpsIfd = ifd0 + 2 + entries * 12 + 4, dataStart = gpsIfd + 2 + 12 + 4;
  const b = new Uint8Array(dataStart + make.length + date.length), v = new DataView(b.buffer);
  b.set([0x4d, 0x4d, 0, 42, 0, 0, 0, 8]);
  v.setUint16(ifd0, entries);
  const put = (i: number, tag: number, type: number, count: number, value: number, base = ifd0) => { const e = base + 2 + i * 12; v.setUint16(e, tag); v.setUint16(e + 2, type); v.setUint32(e + 4, count); if (type === 3) v.setUint16(e + 8, value); else v.setUint32(e + 8, value); };
  put(0, 0x010f, 2, make.length, dataStart);
  put(1, 0x0112, 3, 1, orientation);
  put(2, 0x0132, 2, date.length, dataStart + make.length);
  put(3, 0x8825, 4, 1, gpsIfd);
  v.setUint16(gpsIfd, 1);
  const e = gpsIfd + 2; v.setUint16(e, 1); v.setUint16(e + 2, 2); v.setUint32(e + 4, 2); b.set(enc("N\0"), e + 8);
  b.set(make, dataStart); b.set(date, dataStart + make.length);
  return b;
}
const seg = (marker: number, data: number[] | Uint8Array) => [0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 0xff, ...data];
const XMP = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:format="synthetic"/></rdf:RDF></x:xmpmeta>`;
function jpeg(opts: { exif?: boolean; xmp?: boolean; iptc?: boolean; trailer?: boolean } = { exif: true, xmp: true, iptc: true }) {
  const bytes = [0xff, 0xd8, ...seg(0xe0, [...enc("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0])];
  if (opts.exif) bytes.push(...seg(0xe1, [...enc("Exif\0\0"), ...tiff()]));
  if (opts.xmp) bytes.push(...seg(0xe1, enc("http://ns.adobe.com/xap/1.0/\0" + XMP)));
  if (opts.iptc) bytes.push(...seg(0xed, [...enc("Photoshop 3.0\0"), ...enc("8BIM"), 4, 4, 0, 0, 0, 0, 0, 8, 0x1c, 2, 0x50, 0, 3, ...enc("Syn"), 0]));
  const icc = new Array(132).fill(0); icc[3] = 132; icc.splice(36, 4, ...enc("acsp"));
  bytes.push(...seg(0xe2, [...enc("ICC_PROFILE\0"), 1, 1, ...icc]));
  bytes.push(...seg(0xfe, enc("synthetic comment")));
  bytes.push(...seg(0xdb, new Array(65).fill(1)));
  bytes.push(...seg(0xc0, [8, 0, 3, 0, 5, 1, 1, 0x11, 0]));
  bytes.push(...seg(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd9);
  if (opts.trailer) bytes.push(...enc("TRAILER"));
  return new Uint8Array(bytes);
}
function png(withMeta = true) {
  const ihdr = new Uint8Array(13); const v = new DataView(ihdr.buffer); v.setUint32(0, 4); v.setUint32(4, 2); ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ihdr), pngChunk("acTL", new Uint8Array(8)), pngChunk("iCCP", new Uint8Array(enc("p\0\0x")))];
  if (withMeta) parts.push(pngChunk("eXIf", tiff(1)), pngChunk("tEXt", new Uint8Array(enc("Author\0Synthetic"))), pngChunk("iTXt", new Uint8Array(enc("XML:com.adobe.xmp\0\0\0\0\0" + XMP))), pngChunk("tIME", new Uint8Array([7, 208, 1, 1, 0, 0, 0])));
  parts.push(pngChunk("IDAT", new Uint8Array([1, 2, 3])), pngChunk("IEND", new Uint8Array()));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
const file = (b: Uint8Array, name = "x.jpg") => ({ name, size: b.length, type: "", lastModified: 0 });
const buf = (b: Uint8Array) => b.slice().buffer;

describe("metadata removal", () => {
  it("removes EXIF (camera, dates, GPS), XMP, and IPTC from JPEG and verifies by re-parsing", async () => {
    const original = jpeg({ exif: true, xmp: true, iptc: true, trailer: true });
    const before = await inspectImage(buf(original), file(original));
    expect(before.rows.some(r => r.tag === "ifd0.Make")).toBe(true);
    expect(before.rows.some(r => r.tag.startsWith("gps."))).toBe(true);
    const r = await createCleanCopy(buf(original), file(original), { mode: "all", remove: [], keepOrientation: false });
    expect(r.report.verified).toBe(true);
    const after = await inspectImage(r.output.slice(0), file(new Uint8Array(r.output)));
    expect(after.rows.filter(x => /^(ifd0|exif|gps|xmp|iptc)\./.test(x.tag))).toEqual([]);
    const text = new TextDecoder("latin1").decode(new Uint8Array(r.output));
    for (const s of ["Synthetic Cam", "2000:01:01", "ns.adobe.com", "Photoshop", "synthetic comment", "TRAILER"]) expect(text).not.toContain(s);
    expect(text).toContain("ICC_PROFILE");
    expect(r.report.imageDataIdentical && r.report.dimensionsMatch).toBe(true);
    expect(r.report.blocks.find(b => b.kind === "exif")?.status).toBe("Removed");
    expect(r.report.blocks.find(b => b.kind === "text")?.status).toBe("Not applicable");
  });
  it("keeps orientation as the only EXIF tag when requested", async () => {
    const original = jpeg({ exif: true });
    const r = await createCleanCopy(buf(original), file(original), { mode: "all", remove: [], keepOrientation: true });
    expect(r.report.verified).toBe(true);
    expect(r.report.orientationKept).toBe(true);
    const after = (await inspectImage(r.output.slice(0), file(new Uint8Array(r.output)))).rows.filter(x => x.tag.startsWith("ifd0."));
    expect(after.map(x => x.tag)).toEqual(["ifd0.Orientation"]);
  });
  it("selective removal removes only the chosen blocks and preserves the rest", async () => {
    const original = jpeg({ exif: true, xmp: true, iptc: true });
    const r = await createCleanCopy(buf(original), file(original), { mode: "selective", remove: ["exif"], keepOrientation: false });
    expect(r.report.verified).toBe(true);
    expect(r.report.blocks.find(b => b.kind === "xmp")?.status).toBe("Preserved");
    expect(r.report.blocks.find(b => b.kind === "iptc")?.status).toBe("Preserved");
    expect(r.report.blocks.find(b => b.kind === "comment")?.status).toBe("Preserved");
    expect(r.report.fields.filter(f => f.tag.startsWith("gps.")).every(f => f.status === "Removed")).toBe(true);
  });
  it("reports failure when a block meant to be removed is still present", async () => {
    const original = jpeg({ exif: true });
    const s = scanStructure(original);
    const rows = (await inspectImage(buf(original), file(original))).rows;
    const report = verifyClean({ format: "JPEG", remove: ["exif"], mode: "selective", orientationKept: false, original: { bytes: original, structure: s, rows }, cleaned: { bytes: original, structure: s, rows } });
    expect(report.verified).toBe(false);
    expect(report.blocks.find(b => b.kind === "exif")?.status).toBe("Still present");
    const failed = verifyClean({ format: "JPEG", remove: ["exif"], mode: "all", orientationKept: false, original: { bytes: original, structure: s, rows }, cleaned: { bytes: original, error: "boom" } });
    expect(failed.verified).toBe(false);
  });
  it("cleans PNG text, XMP, eXIf, and tIME while preserving alpha, animation, ICC, and dimensions", async () => {
    const original = png();
    const r = await createCleanCopy(buf(original), file(original, "a.png"), { mode: "all", remove: [], keepOrientation: true });
    expect(r.report.verified).toBe(true);
    expect(r.format).toBe("PNG");
    const s = scanStructure(new Uint8Array(r.output));
    expect(s.segments.map(x => x.name)).toEqual(["Signature", "IHDR", "acTL", "iCCP", "IDAT", "IEND"]);
    expect([s.width, s.height, s.hasAlpha, s.animated, s.hasIcc]).toEqual([4, 2, true, true, true]);
    const v = new DataView(r.output); // every chunk CRC valid
    expect(crc32(new Uint8Array(r.output, 12, 17))).toBe(v.getUint32(29));
  });
  it("handles images with no metadata", async () => {
    const original = png(false);
    const r = await createCleanCopy(buf(original), file(original), { mode: "all", remove: [], keepOrientation: true });
    expect(r.report.verified).toBe(true);
    expect(r.report.blocks.every(b => b.status === "Not applicable")).toBe(true);
    expect(new Uint8Array(r.output)).toEqual(original);
  });
  it("rejects corrupt and unsupported files without output", () => {
    expect(() => cleanBytes(jpeg().slice(0, 40), { mode: "all", remove: [], keepOrientation: true })).toThrow(/truncated|corrupted/);
    const bad = png(); bad[bad.length - 19] ^= 0xff;
    expect(() => cleanBytes(bad, { mode: "all", remove: [], keepOrientation: true })).toThrow(/checksum/);
    expect(() => cleanBytes(new Uint8Array([73, 73, 42, 0, 8, 0, 0, 0]), { mode: "all", remove: [], keepOrientation: true })).toThrow(/TIFF/);
  });
  it("never modifies the original bytes", () => {
    const original = jpeg(); const copy = original.slice();
    cleanBytes(original, { mode: "all", remove: [], keepOrientation: true });
    expect(original).toEqual(copy);
  });
  it("generates safe filenames and correct MIME types", () => {
    expect(cleanedFilename("../evil name.png.exe", "JPEG")).toBe("evil-name-png-cleaned.jpg");
    expect(cleanedFilename("....", "PNG")).toBe("image-cleaned.png");
    expect(mimeFor("PNG")).toBe("image/png");
  });
  it("discards stale clean results and terminates workers", () => {
    const workers: CleanWorkerPort[] = [];
    const states: string[] = [];
    const session = new CleanSession(() => { const w: CleanWorkerPort = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() }; workers.push(w); return w; }, s => states.push(s.status));
    const f = new File([jpeg()], "a.jpg");
    session.run(f, { mode: "all", remove: [], keepOrientation: true });
    session.run(f, { mode: "all", remove: [], keepOrientation: true });
    expect(workers[0].terminate).toHaveBeenCalled();
    workers[0].onmessage?.({ data: { error: "stale" } } as MessageEvent);
    expect(states.at(-1)).toBe("loading");
    session.clear();
    expect(workers[1].terminate).toHaveBeenCalled();
    expect(states.at(-1)).toBe("idle");
  });
});
