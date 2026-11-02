import { describe, expect, it } from "vitest";
import { searchMetadata } from "./searchUtils";
import type { MetadataRow } from "./metadataUtils";

const rows: MetadataRow[] = [
  { tag: "exif.Model", label: "Camera model", category: "Camera", value: "Synthetic Camera" },
  { tag: "gps.latitude", label: "Latitude", category: "Location", value: "6.123456" },
  { tag: "Filename", label: "Filename", category: "Overview", value: "photo.jpg" },
];
describe("metadata search", () => {
  it("finds values outside the overview and counts matches by category", () => {
    const result = searchMetadata(rows, "latitude", "All");
    expect(result.rows).toEqual([rows[1]]);
    expect(result.counts.Location).toBe(1);
    expect(result.counts.Overview).toBe(0);
  });
  it("matches case-insensitive terms across raw tags, categories and values", () => {
    expect(searchMetadata(rows, " CAMERA synthetic ", "All").rows).toEqual([rows[0]]);
    expect(searchMetadata(rows, "gps.latitude", "Location").total).toBe(1);
    expect(searchMetadata(rows, "latitude", "Camera").rows).toEqual([]);
  });
  it("returns all rows for whitespace without mutating source data", () => {
    expect(searchMetadata(rows, "  ", "All").rows).toEqual(rows);
    expect(rows).toHaveLength(3);
  });
});