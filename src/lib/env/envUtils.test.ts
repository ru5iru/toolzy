import { describe, expect, it } from "vitest";
import { envToJson, jsonToEnv, parseEnv, toExample } from "./envUtils";

const sample = `# app
PORT=3000
JWT_SECRET=abc
DATABASE_URL="postgres://u:p@h/db"
NAME='My App' # note
PORT=4000
bad line`;

describe("parseEnv", () => {
  it("parses, unquotes and reports issues", () => {
    const { entries, issues } = parseEnv(sample);
    expect(entries.find((e) => e.key === "NAME")?.value).toBe("My App");
    expect(entries.find((e) => e.key === "DATABASE_URL")?.value).toBe("postgres://u:p@h/db");
    expect(issues.some((i) => i.includes('"PORT" repeats line 2'))).toBe(true);
    expect(issues.some((i) => i.includes("Line 7"))).toBe(true);
  });
});
describe("toExample", () => {
  it("blanks secrets and credential URLs, keeps the rest", () => {
    const out = toExample(sample);
    expect(out).toContain("# app");
    expect(out).toContain("PORT=3000");
    expect(out).toMatch(/^JWT_SECRET=$/m);
    expect(out).toMatch(/^DATABASE_URL=$/m);
    expect(toExample("A=1", true)).toBe("A=");
  });
});
describe("conversion", () => {
  it("env to json and back", () => {
    const json = envToJson("A=1\nB=two words");
    expect(JSON.parse(json)).toEqual({ A: "1", B: "two words" });
    expect(jsonToEnv(json)).toBe('A=1\nB="two words"');
  });
  it("rejects non-objects", () => { expect(() => jsonToEnv("[1]")).toThrow(); });
});
