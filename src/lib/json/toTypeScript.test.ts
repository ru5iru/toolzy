import { describe, expect, it } from "vitest";
import { jsonToTypeScript } from "./toTypeScript";

describe("jsonToTypeScript", () => {
  it("infers primitives, nesting and null", () => {
    const ts = jsonToTypeScript({ id: 1, name: "a", ok: true, tag: null, address: { city: "x" } });
    expect(ts).toContain("export interface Root {");
    expect(ts).toContain("id: number;");
    expect(ts).toContain("tag: null;");
    expect(ts).toContain("address: Address;");
    expect(ts).toContain("export interface Address {\n  city: string;");
  });
  it("merges array items and marks missing keys optional", () => {
    const ts = jsonToTypeScript({ users: [{ id: 1, nick: "a" }, { id: 2 }] });
    expect(ts).toContain("users: User[];");
    expect(ts).toContain("nick?: string;");
    expect(ts).toContain("  id: number;");
  });
  it("quotes odd keys and handles empty and mixed arrays", () => {
    const ts = jsonToTypeScript({ "my-key": [], mix: [1, "a"] });
    expect(ts).toContain('"my-key": unknown[];');
    expect(ts).toContain("mix: (number | string)[];");
  });
  it("supports non-object roots", () => {
    expect(jsonToTypeScript([1, 2], "List")).toBe("export type List = number[];");
  });
});
