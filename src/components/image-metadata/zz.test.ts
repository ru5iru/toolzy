import { it } from "vitest";
import { parse } from "exifr";
import { pngChunk } from "./cleanUtils";
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
  bytes.push(...seg(0xe2, [...enc("ICC_PROFILE\0"), 1, 1, 9, 9]));
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
it("d", async () => {
  for (const o of [{exif:true},{xmp:true},{iptc:true},{}]) {
    try { const r = await parse(jpeg(o).buffer, { tiff: true, xmp: true, iptc: true, icc: true, jfif: true, mergeOutput: false, silentErrors: false }); console.log(JSON.stringify(o), JSON.stringify(r)); } catch (e) { console.log(JSON.stringify(o), "ERR", String(e)); }
  }
  console.log(JSON.stringify(await parse(png().buffer, { tiff: true, xmp: true, iptc: true, icc: true, ihdr: true, mergeOutput: false, silentErrors: false }).catch(e=>String(e))));
});
