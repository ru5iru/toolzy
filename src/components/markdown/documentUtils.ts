export const STORAGE_KEY = "toolzy-markdown-document-v1";
export const WELCOME = `# Welcome to Markdown Editor

A local workspace for your next README, note, or idea.

## A little of everything

- Write in **Markdown**
- Preview as you go
- Keep your words in this browser

1. Start with a heading
2. Make it your own

- [x] Open the editor
- [ ] Write something great

| Feature | Status | Notes |
| --- | --- | --- |
| Live preview | Ready | GitHub-flavored Markdown |
| Local autosave | Ready | On this device |

\`\`\`js
const greeting = "Hello, Markdown!";
console.log(greeting);
\`\`\`

> Type / at the start of a line to choose a heading, table, or template.

Your text stays in this browser. Remote images are not loaded.
`;

export function documentStats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  return { words, chars: text.length, lines: text.split("\n").length, minutes: Math.max(1, Math.ceil(words / 200)) };
}
export function headingAnchors(text: string) {
  const seen = new Map<string, number>();
  let fence = "";
  return text.split("\n").flatMap(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) { fence = fence ? "" : marker[1][0]; return []; }
    if (fence) return [];
    const heading = line.match(/^#{1,6}\s+(.+?)(?:\s+#+)?$/)?.[1];
    if (!heading) return [];
    const base = heading.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N}_\-\s]/gu, "").trim().replace(/\s/g, "-");
    const count = seen.get(base) ?? 0; seen.set(base, count + 1);
    return [{ title: heading, slug: count ? `${base}-${count}` : base }];
  });
}
export function safeFilename(name: string) {
  return (name.replace(/\.(md|markdown|txt)$/i, "").replace(/[^\p{L}\p{N}_.-]/gu, "-").replace(/^\.+/, "").slice(0, 100) || "document") + ".md";
}
export function standaloneHTML(body: string, title: string) {
  const escaped = title.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaped}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 24px}h1,h2{border-bottom:1px solid; padding-bottom:.3em}pre{overflow:auto;padding:16px;border:1px solid;border-radius:6px}code{font-family:monospace}table{border-collapse:collapse}td,th{border:1px solid;padding:8px}blockquote{border-left:3px solid;padding-left:16px}img{max-width:100%}@media print{body{margin:0}}</style></head><body>${body}</body></html>`;
}
export function alignTables(text: string) {
  return text.replace(/(?:^\|.*\|[ \t]*(?:\n|$)){2,}/gm, block => {
    const lines = block.trimEnd().split("\n");
    if (!lines.some(line => /^\|\s*:?-{3,}/.test(line))) return block;
    const cells = lines.map(line => line.trim().slice(1, -1).split(/(?<!\\)\|/).map(c => c.trim()));
    const widths = Array.from({ length: Math.max(...cells.map(row => row.length)) }, (_, i) => Math.max(3, ...cells.map(row => row[i]?.length ?? 0)));
    return cells.map(row => "| " + widths.map((width, i) => {
      const cell = row[i] ?? "";
      return /^:?-{3,}:?$/.test(cell) ? (cell.startsWith(":") ? ":" : "-") + "-".repeat(width - 2) + (cell.endsWith(":") ? ":" : "-") : cell.padEnd(width);
    }).join(" | ") + " |").join("\n") + (block.endsWith("\n") ? "\n" : "");
  });
}