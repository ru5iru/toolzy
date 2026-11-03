import { describe, expect, it } from "vitest";
import { documentStats, headingAnchors, alignTables, safeFilename, standaloneHTML } from "./documentUtils";
describe("Markdown document utilities", () => {
  it("calculates reading time at 200 words per minute", () => {
    expect(documentStats(Array(201).fill("word").join(" ")).minutes).toBe(2);
    expect(documentStats("one two\nthree")).toEqual({ words: 3, chars: 13, lines: 2, minutes: 1 });
  });
  it("creates duplicate-safe heading anchors and excludes code fences", () => {
    expect(headingAnchors("# Hello World\n## Hello World\n```md\n# Not a heading\n```\n# Café").map(h => h.slug)).toEqual(["hello-world", "hello-world-1", "café"]);
  });
  it("escapes the exported document title", () => {
    expect(standaloneHTML("<p>Safe</p>", "<script>bad</script>")).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(safeFilename("../../note.markdown")).toBe("-..-note.md");
  });
  it("aligns Markdown tables without changing non-table text", () => {
    const text = "| a | longer |\n| --- | --- |\n| test | b |\n";
    const aligned = alignTables(text);
    expect(aligned.split("\n")[0]).toBe("| a    | longer | ".trimEnd());
    expect(alignTables("ordinary text")).toBe("ordinary text");
    expect(alignTables(aligned)).toBe(aligned);
  });
});