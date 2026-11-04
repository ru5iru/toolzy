import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";
describe("Markdown privacy and sanitization", () => {
  it("removes scripts, event handlers, remote assets, and executable URLs", () => {
    const html = renderToStaticMarkup(<MarkdownPreview text={'<script>alert(1)</script>\n<img src="https://example.com/private-text" onerror="alert(1)">\n\n[unsafe](javascript:alert%281%29)\n\n<iframe src="https://example.com/private-text"></iframe>'} />);
    expect(html).not.toContain("<script"); expect(html).not.toContain("<img"); expect(html).not.toContain("<iframe");
    expect(html).not.toContain("onerror"); expect(html).not.toContain("javascript:"); expect(html).not.toContain("private-text");
  });
  it("preserves sanitized details, GFM tasks, tables, and footnotes", () => {
    const html = renderToStaticMarkup(<MarkdownPreview text={'<details><summary>Open</summary>Safe</details>\n\n- [ ] Task\n\n| A | B |\n| --- | --- |\n| one | two |\n\nNote[^1]\n\n[^1]: Footnote'} />);
    expect(html).toContain("<details>"); expect(html).toContain('type="checkbox"'); expect(html).toContain("<table>"); expect(html).toContain("Footnote");
  });
});