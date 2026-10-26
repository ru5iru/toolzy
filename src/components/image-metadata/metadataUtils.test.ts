import { describe, expect, it } from "vitest";
import { analyzePrivacy, csvCell, csvExport, detectFormat, formatValue, gpsCoordinates, inspectImage, jsonExport, MAX_IMAGE_BYTES, normalizeMetadata, validateSize } from "./metadataUtils";

// Synthetic classic TIFF: camera make and capture date, no personal source images.
function taggedTiff() {
  const make = "Synthetic Camera\0", date = "2000:01:01 12:00:00\0";
  const buffer = new ArrayBuffer(38 + make.length + date.length);
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  bytes.set([73, 73, 42, 0, 8, 0, 0, 0]);
  view.setUint16(8, 2, true);
  for (const [index, tag, value, offset] of [[0, 271, make, 38], [1, 306, date, 38 + make.length]] as const) {
    const start = 10 + index * 12;
    view.setUint16(start, tag, true); view.setUint16(start + 2, 2, true);
    view.setUint32(start + 4, value.length, true); view.setUint32(start + 8, offset, true);
    bytes.set(Array.from(value, c => c.charCodeAt(0)), offset);
  }
  return buffer;
}
const descriptor = (buffer: ArrayBuffer) => ({ name: "synthetic.wrong", type: "application/octet-stream", size: buffer.byteLength, lastModified: 0 });
describe("image metadata", () => {
  it("parses actual TIFF bytes regardless of extension or declared MIME", async () => {
    const buffer = taggedTiff(); const result = await inspectImage(buffer, descriptor(buffer));
    expect(result.format).toBe("TIFF");
    expect(result.rows.find(row => row.tag === "ifd0.Make")?.value).toBe("Synthetic Camera");
    expect(result.rows.find(row => row.tag === "ifd0.ModifyDate")?.value).toBe("2000:01:01 12:00:00");
  });
  it("normalizes absent metadata without inventing values", () => {
    expect(normalizeMetadata(undefined)).toEqual([]);
    expect(normalizeMetadata({ exif: { ISO: 0, LensModel: null } })).toEqual([{ tag: "exif.ISO", label: "ISO", category: "Camera", value: "0" }]);
  });
  it("keeps exposure time in Camera and formats units", () => {
    const rows = normalizeMetadata({ exif: { ExposureTime: 0.008, FNumber: 2.8 } });
    expect(rows[0]).toMatchObject({ value: "1/125 s", category: "Camera" });
    expect(rows[1].value).toBe("f/2.8");
    expect(formatValue(new Uint8Array(2))).toBe("[Binary data: 2 bytes]");
  });
  it("formats synthetic GPS coordinates including zero and rejects invalid ranges", () => {
    expect(gpsCoordinates(normalizeMetadata({ gps: { latitude: 0, longitude: 1.25 } }))).toBe("0.000000, 1.250000");
    expect(gpsCoordinates(normalizeMetadata({ latitude: 91, longitude: 0 }))).toBeUndefined();
    expect(gpsCoordinates([])).toBeUndefined();
  });
  it("detects only evidenced sensitive fields", () => {
    const rows = normalizeMetadata({ gps: { latitude: 0, longitude: 0 }, exif: { DateTimeOriginal: "2000:01:01 00:00:00", BodySerialNumber: "SYNTHETIC" }, xmp: { creator: "Test", City: "Fictional" } });
    expect(analyzePrivacy(rows, true).map(f => f.title)).toEqual(["GPS location", "Capture timestamps", "Device identifiers", "Creator or owner", "Location descriptions", "Embedded thumbnail"]);
    expect(analyzePrivacy([], false)).toEqual([]);
  });
  it("rejects unsupported, empty, oversized and truncated files", async () => {
    expect(() => detectFormat(new Uint8Array([82, 73, 70, 70]))).toThrow("Unsupported");
    expect(() => validateSize(0)).toThrow("empty");
    expect(() => validateSize(MAX_IMAGE_BYTES + 1)).toThrow("25 MiB");
    expect(() => validateSize(MAX_IMAGE_BYTES)).not.toThrow();
    const truncated = new Uint8Array([255, 216, 255]).buffer;
    await expect(inspectImage(truncated, descriptor(truncated))).rejects.toThrow("truncated");
    const broken = new Uint8Array(30); broken.set([73, 73, 42, 0, 255, 255, 255, 127]);
    await expect(inspectImage(broken.buffer, descriptor(broken.buffer))).rejects.toThrow("parsing failed");
  });
  it("recognizes valid metadata-free TIFF", async () => {
    const buffer = new ArrayBuffer(16); new Uint8Array(buffer).set([73, 73, 42, 0, 8, 0, 0, 0]);
    const result = await inspectImage(buffer, descriptor(buffer));
    expect(result.metadataCount).toBe(0); expect(result.findings).toEqual([]);
  });
  it("exports parseable JSON and escaped CSV without spreadsheet formulas", async () => {
    const buffer = taggedTiff(); const result = await inspectImage(buffer, descriptor(buffer));
    expect(JSON.parse(jsonExport(result))).toEqual(result);
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    for (const value of ["=SUM(1,2)", "+cmd", "-1", "@formula", " \t=2", "\tplain"]) expect(csvCell(value).startsWith('"\'')).toBe(true);
    expect(csvExport(normalizeMetadata({ Artist: "=danger" }))).toContain('"\'=danger"');
  });
});