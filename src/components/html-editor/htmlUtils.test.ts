import { describe, expect, it } from "vitest";
import { htmlDocument, safeLink, sanitizeHTML } from "./htmlUtils";

describe("local HTML safety", () => {
  it("removes executable HTML and remote resources", () => {
    const result = sanitizeHTML('<script>alert(1)</script><iframe src="https://example.com"></iframe><img src="https://example.com/track"><p onclick="alert(1)" style="background:url(https://example.com/track);text-align:center">Keep</p>');
    expect(result).toBe('<p style="text-align: center">Keep</p>');
  });
  it("keeps local raster images but rejects SVG data", () => {
    expect(sanitizeHTML('<img src="data:image/png;base64,YWJj" alt="Local">')).toContain('src="data:image/png;base64,YWJj"');
    expect(sanitizeHTML('<img src="data:image/svg+xml;base64,YWJj">')).toBe("");
  });
  it("rejects script links and preserves safe formatting and tables", () => {
    expect(safeLink("javascript:alert(1)")).toBe(false);
    expect(safeLink("https://example.com")).toBe(true);
    const result = sanitizeHTML('<p><strong>Hello</strong><a href="javascript:alert(1)">link</a></p><table><tr><td>cell</td></tr></table>');
    expect(result).not.toContain("javascript");
    expect(result).toContain("<strong>Hello</strong>");
    expect(result).toContain("<td>cell</td>");
  });
  it("exports a complete sanitized document", () => {
    const result = htmlDocument('<p>Document content</p><script>bad()</script>');
    expect(result).toContain("<!doctype html>");
    expect(result).toContain("<p>Document content</p>");
    expect(result).not.toContain("bad()");
  });
});