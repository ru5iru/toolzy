import { autocompletion, acceptCompletion, completionStatus, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { EditorSelection, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, type Command } from "@codemirror/view";
import { indentLess, indentMore } from "@codemirror/commands";
import { headingAnchors, alignTables } from "./documentUtils";

const table = "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |";
export const snippets = [
  { label: "Heading 1", detail: "# Title", text: "# " }, { label: "Heading 2", detail: "## Title", text: "## " }, { label: "Heading 3", detail: "### Title", text: "### " },
  { label: "Bullet list", detail: "- item", text: "- " }, { label: "Numbered list", detail: "1. item", text: "1. " }, { label: "Task list", detail: "- [ ] task", text: "- [ ] " },
  { label: "Quote", detail: "> text", text: "> " }, { label: "Code block", detail: "```language", text: "```js\n\n```" }, { label: "Table", detail: "3 × 3 cells", text: table },
  { label: "Horizontal rule", detail: "---", text: "---\n" }, { label: "Link", detail: "[text](url)", text: "[text](https://example.com)" }, { label: "Image", detail: "![alt](url)", text: "![alt text](image.png)" },
  { label: "Details", detail: "collapsible section", text: "<details>\n<summary>Details</summary>\n\nContent\n\n</details>" },
  { label: "Footnote", detail: "[^1]", text: "[^1]\n\n[^1]: Footnote text" },
  { label: "README skeleton", detail: "project, setup, usage", text: "# Project\n\n## Overview\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\n## License\n" },
  { label: "Changelog entry", detail: "version and changes", text: "## Unreleased\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- " },
  { label: "Meeting notes", detail: "agenda and actions", text: "# Meeting notes\n\n## Attendees\n- \n\n## Agenda\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] " },
];
const languages = ["js", "ts", "tsx", "json", "bash", "python", "php", "sql", "html", "css", "yaml", "diff", "md", "rust", "go", "java", "text"];
const emoji = { rocket: "🚀", smile: "😊", heart: "❤️", tada: "🎉", warning: "⚠️", check: "✅", fire: "🔥", bug: "🐛", sparkles: "✨", thumbsup: "👍", memo: "📝", wave: "👋" };
function inFence(context: CompletionContext) {
  const lines = context.state.doc.sliceString(0, context.pos).split("\n");
  let open = "";
  for (const line of lines.slice(0, -1)) {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) { if (!open) open = match[1][0]; else if (open === match[1][0]) open = ""; }
  }
  return Boolean(open);
}
export function markdownCompletions(context: CompletionContext): CompletionResult | null {
  const fence = context.matchBefore(/^\s*```\w*$/);
  if (fence && !inFence(context)) return { from: fence.from + fence.text.indexOf("```") + 3, options: languages.map(label => ({ label, type: "keyword" })) };
  if (inFence(context)) return null;
  const slash = context.matchBefore(/(?:^|\s)\/[^/\n]*$/);
  if (slash) return { from: slash.from + slash.text.indexOf("/"), filter: false, options: [...snippets, { label: "Date", detail: "today · YYYY-MM-DD", text: new Date().toLocaleDateString("en-CA") }].filter(s => s.label.toLowerCase().includes(slash.text.slice(slash.text.indexOf("/") + 1).toLowerCase())).map(s => ({ label: s.label, detail: s.detail, apply: s.text, type: "text" })) };
  const anchor = context.matchBefore(/\]\(#[-\p{L}\p{N}]*$/u);
  if (anchor) return { from: anchor.from + 3, options: headingAnchors(context.state.doc.toString()).map(h => ({ label: h.slug, detail: h.title, type: "text" })) };
  const short = context.matchBefore(/:[a-z]{2,}:?$/);
  if (short) return { from: short.from, options: Object.entries(emoji).map(([name, value]) => ({ label: `:${name}:`, detail: value, apply: value, type: "text" })) };
  const link = context.matchBefore(/!?\[$/);
  if (link) return { from: link.from, options: [{ label: "Link", detail: "[text](url)", apply: "[text](https://example.com)" }, { label: "Image", detail: "![alt](url)", apply: "![alt text](image.png)" }] };
  return null;
}
export function wrapSelection(view: EditorView, before: string, after = before, placeholder = "text") {
  const { from, to } = view.state.selection.main;
  const content = view.state.sliceDoc(from, to) || placeholder;
  view.dispatch({ changes: { from, to, insert: before + content + after }, selection: EditorSelection.range(from + before.length, from + before.length + content.length) });
  view.focus();
}
export function insertLink(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to) || "text";
  const insert = `[${selected}](url)`;
  const start = from + selected.length + 3;
  view.dispatch({ changes: { from, to, insert }, selection: EditorSelection.range(start, start + 3) }); view.focus();
}
export const listEnter: Command = view => {
  const { from, to } = view.state.selection.main;
  if (from !== to) return false;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.match(/^(\s*)([-+*]|\d+\.)(\s+)(\[[ xX]\]\s+)?(.*)$/);
  if (!prefix) return false;
  if (!prefix[5].trim()) { view.dispatch({ changes: { from: line.from, to: line.to, insert: "" } }); return true; }
  const marker = /^\d/.test(prefix[2]) ? `${Number.parseInt(prefix[2]) + 1}.` : prefix[2];
  const insert = `\n${prefix[1]}${marker} ${prefix[4] ? "[ ] " : ""}`;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } }); return true;
};
export const tableTab = (reverse: boolean): Command => view => {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  if (!line.text.trim().startsWith("|")) return false;
  const pipes = [...line.text.matchAll(/(?<!\\)\|/g)].map(m => line.from + (m.index ?? 0));
  const index = pipes.findIndex((p, i) => p < pos && (pipes[i + 1] ?? Infinity) >= pos);
  const target = reverse ? index - 1 : index + 1;
  if (target >= 0 && target < pipes.length - 1) { view.dispatch({ selection: { anchor: pipes[target] + 2 } }); return true; }
  const nextNumber = line.number + (reverse ? -1 : 1);
  if (nextNumber > 0 && nextNumber <= view.state.doc.lines) {
    const next = view.state.doc.line(nextNumber);
    if (next.text.trim().startsWith("|")) { view.dispatch({ selection: { anchor: next.from + 2 } }); return true; }
  }
  return false;
};
export function markdownExtensions(): Extension[] {
  const openingPairs = new WeakMap<EditorView, { position: number; char: string }>();
  return [
    autocompletion({ override: [markdownCompletions], icons: true, activateOnTyping: true, interactionDelay: 0 }),
    Prec.highest(keymap.of([{ key: "Tab", run: view => completionStatus(view.state) === "active" ? acceptCompletion(view) : false }, { key: "Enter", run: view => completionStatus(view.state) === "active" ? acceptCompletion(view) : listEnter(view) }, { key: "Tab", run: tableTab(false) }, { key: "Shift-Tab", run: tableTab(true) }, { key: "Tab", run: indentMore }, { key: "Shift-Tab", run: indentLess }])),
    EditorView.inputHandler.of((view, from, to, text) => {
      if (!['*', '_', '~', '`', '[', '(', '"', ']', ')'].includes(text)) return false;
      const pairs: Record<string, string> = { '*': '*', '_': '_', '~': '~', '`': '`', '[': ']', '(': ')', '"': '"' };
      const next = view.state.sliceDoc(to, to + 1);
      const armed = openingPairs.get(view);
      if (from === to && next === text && (text === '*' || text === '~') && armed?.position === from && armed.char === text) {
        openingPairs.delete(view);
        view.dispatch({ changes: { from, insert: text + text }, selection: { anchor: from + 1 }, userEvent: "input.type" }); return true;
      }
      openingPairs.delete(view);
      if (text === '`' && from === to && /^\s*``$/.test(view.state.sliceDoc(view.state.doc.lineAt(from).from, from))) {
        view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + 1 }, userEvent: "input.type" }); return true;
      }
      if (from === to && next === text) { view.dispatch({ selection: { anchor: to + 1 } }); return true; }
      const close = pairs[text]; if (!close) return false;
      const selected = view.state.sliceDoc(from, to);
      if (!selected) openingPairs.set(view, { position: from + 1, char: text });
      view.dispatch({ changes: { from, to, insert: text + selected + close }, selection: selected ? EditorSelection.range(from + 1, to + 1) : { anchor: from + 1 }, userEvent: "input.type" }); return true;
    }),
    EditorView.domEventHandlers({
      paste(event, view) {
        const value = event.clipboardData?.getData("text/plain").trim();
        const { from, to } = view.state.selection.main;
        if (from === to || !value || !/^https?:\/\/\S+$/i.test(value)) return false;
        event.preventDefault(); const selected = view.state.sliceDoc(from, to);
        view.dispatch({ changes: { from, to, insert: `[${selected}](${value})` } }); return true;
      },
      blur(_event, view) {
        const original = view.state.doc.toString(), aligned = alignTables(original);
        if (aligned !== original) view.dispatch({ changes: { from: 0, to: original.length, insert: aligned } });
        return false;
      },
    }),
  ];
}