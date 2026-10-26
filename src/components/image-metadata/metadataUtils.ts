import { parse, thumbnail } from "exifr";

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const CATEGORIES = ["Overview", "Camera", "Location", "Dates", "IPTC/XMP", "Other"] as const;
export type Category = typeof CATEGORIES[number];
export interface MetadataRow { tag: string; label: string; category: Category; value: string }
export interface PrivacyFinding { title: string; reason: string; tags: string[] }
export interface Inspection { format: string; mime: string; rows: MetadataRow[]; findings: PrivacyFinding[]; metadataCount: number; thumbnailStatus: string }

const labels: Record<string, string> = {
  Make: "Camera make", Model: "Camera model", LensMake: "Lens make", LensModel: "Lens model",
  DateTimeOriginal: "Capture date and time", ExposureTime: "Exposure time", FNumber: "Aperture",
  ISO: "ISO", FocalLength: "Focal length", GPSAltitude: "Altitude", GPSImgDirection: "Image direction",
  latitude: "Latitude", longitude: "Longitude", ImageWidth: "Image width", ImageHeight: "Image height",
};
export function detectFormat(bytes: Uint8Array): { format: string; mime: string } {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { format: "JPEG", mime: "image/jpeg" };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return { format: "PNG", mime: "image/png" };
  if ((bytes[0] === 73 && bytes[1] === 73 && bytes[2] === 42 && bytes[3] === 0) || (bytes[0] === 77 && bytes[1] === 77 && bytes[2] === 0 && bytes[3] === 42)) return { format: "TIFF", mime: "image/tiff" };
  throw new Error("Unsupported file format. Select a JPEG, PNG, or TIFF image; file contents determine support, not its extension.");
}
export function validateSize(size: number) {
  if (!size) throw new Error("This file is empty.");
  if (size > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 25 MiB processing limit.");
}
export function formatValue(value: unknown, tag = ""): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (value instanceof Uint8Array) return `[Binary data: ${value.byteLength} bytes]`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (tag === "ExposureTime") return value > 0 && value < 1 ? `1/${Math.round(1 / value)} s` : `${value} s`;
    if (tag === "FNumber") return `f/${value}`;
    if (tag === "FocalLength") return `${value} mm`;
    if (tag === "GPSAltitude") return `${value} m`;
    return String(value);
  }
  if (Array.isArray(value)) return value.map(v => formatValue(v)).filter(Boolean).join(", ");
  return value === undefined || value === null ? "" : String(value);
}
function categoryFor(tag: string, group: string): Category {
  if (/gps|latitude|longitude/i.test(tag)) return "Location";
  if (/date|timestamp|offsettime|^timecreated$|^modifytime$/i.test(tag)) return "Dates";
  if (/iptc|xmp|dc|photoshop|iptcCore/i.test(group)) return "IPTC/XMP";
  if (/make|model|lens|exposure|aperture|fnumber|iso|focal|flash|orientation|balance|metering|serial|software/i.test(tag)) return "Camera";
  return "Other";
}
export function normalizeMetadata(raw: unknown): MetadataRow[] {
  const rows: MetadataRow[] = [];
  function walk(value: unknown, path: string[], depth: number) {
    if (depth > 12 || rows.length >= 5000) throw new Error("Metadata exceeds the safe complexity limit.");
    if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value) && !(value instanceof Uint8Array)) {
      for (const [key, item] of Object.entries(value)) walk(item, [...path, key], depth + 1);
      return;
    }
    const tag = path[path.length - 1] ?? "";
    const formatted = formatValue(value, tag);
    if (!formatted) return;
    if (formatted.length > 100000) throw new Error("A metadata value exceeds the safe text limit.");
    rows.push({ tag: path.join("."), label: labels[tag] ?? tag.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "), category: categoryFor(tag, path.slice(0, -1).join(".")), value: formatted });
  }
  walk(raw, [], 0);
  return rows;
}
export function gpsCoordinates(rows: MetadataRow[]): string | undefined {
  const read = (tag: string) => rows.find(r => r.tag.split(".").pop() === tag)?.value;
  const latText = read("latitude"), lonText = read("longitude");
  if (latText === undefined || lonText === undefined) return;
  const lat = Number(latText), lon = Number(lonText);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}
export function analyzePrivacy(rows: MetadataRow[], hasThumbnail: boolean): PrivacyFinding[] {
  const rules = [
    { title: "GPS location", test: /gpslatitude|gpslongitude|\.latitude$|\.longitude$|^latitude$|^longitude$/i, reason: "Coordinates can reveal where a photo was taken, including a home or workplace." },
    { title: "Capture timestamps", test: /datetimeoriginal|createdate|gpsdate|gpstime|datecreated|timecreated/i, reason: "Precise capture times can reveal routines or link a photo to a particular event. EXIF dates may lack a timezone." },
    { title: "Device identifiers", test: /serial|uniqueid/i, reason: "Serial numbers and unique identifiers can link images to the same camera or device." },
    { title: "Creator or owner", test: /artist|creator|owner|author|copyright|byline/i, reason: "Names and ownership fields can identify the photographer or rights holder." },
    { title: "Location descriptions", test: /location|city|province|state|country|sublocation/i, reason: "Place names and addresses can reveal a location even without GPS coordinates." },
  ];
  const findings = rules.flatMap(rule => {
    const tags = rows.filter(r => rule.test.test(r.tag)).map(r => r.tag);
    return tags.length ? [{ title: rule.title, reason: rule.reason, tags }] : [];
  });
  if (hasThumbnail) findings.push({ title: "Embedded thumbnail", reason: "A thumbnail may retain a smaller version of an image, including content changed in later edits.", tags: ["Embedded thumbnail"] });
  return findings;
}
export async function inspectImage(buffer: ArrayBuffer, file: { name: string; size: number; type: string; lastModified: number }): Promise<Inspection> {
  validateSize(file.size);
  const bytes = new Uint8Array(buffer);
  const format = detectFormat(bytes);
  if (bytes.length < 16) throw new Error("Image is truncated or corrupted.");
  const options = { tiff: true, xmp: true, iptc: true, icc: true, jfif: true, ihdr: true, ifd1: false, interop: true, userComment: true, mergeOutput: false, translateKeys: true, translateValues: true, reviveValues: false, silentErrors: false };
  let raw: unknown;
  try { raw = await parse(buffer, options); } catch { throw new Error("Metadata parsing failed. The image or its metadata may be corrupted; absence of metadata has not been verified."); }
  const metadata = normalizeMetadata(raw);
  let hasThumbnail = false;
  let thumbnailStatus = "No embedded EXIF thumbnail detected; other thumbnail formats are not verified.";
  try { hasThumbnail = Boolean((await thumbnail(buffer))?.length); } catch { thumbnailStatus = "Embedded thumbnail detection unavailable for this file."; }
  if (hasThumbnail) thumbnailStatus = "Embedded EXIF thumbnail detected.";
  const overview = [
    ["Filename", file.name], ["FileSize", `${file.size} bytes`], ["Format", format.format], ["MIMEType", format.mime],
    ...(file.type ? [["DeclaredMIMEType", file.type]] : []),
    ["LastModified", new Date(file.lastModified).toISOString()],
  ].map(([tag, value]) => ({ tag, label: tag.replace(/([a-z])([A-Z])/g, "$1 $2"), category: "Overview" as const, value }));
  const embedded = metadata.filter(row => !/^(jfif|ihdr)\./i.test(row.tag));
  return { ...format, rows: [...overview, ...metadata], metadataCount: embedded.length, findings: analyzePrivacy(embedded, hasThumbnail), thumbnailStatus };
}
export function jsonExport(result: Inspection): string { return JSON.stringify(result, null, 2); }
export function csvCell(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function csvExport(rows: MetadataRow[]): string {
  return [["Category", "Label", "Tag", "Value"], ...rows.map(r => [r.category, r.label, r.tag, r.value])].map(row => row.map(csvCell).join(",")).join("\r\n");
}