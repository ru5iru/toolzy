import { afterEach, describe, expect, it } from "vitest";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { insertLink, listEnter, markdownCompletions, tableTab, wrapSelection } from "./editorExtensions";

const views: EditorView[] = [];
function editor(text: string, from = text.length, to = from) {
  const view = new EditorView({ state: EditorState.create({ doc: text, selection: EditorSelection.range(from, to) }), parent: document.body });
  views.push(view); return view;
}
function complete(text: string) { return markdownCompletions(new CompletionContext(EditorState.create({ doc: text }), text.length, false)); }
afterEach(() => { views.splice(0).forEach(view => view.destroy()); });
describe("Markdown suggestions and commands", () => {
  it("filters slash snippets without replacing preceding whitespace", () => {
    const result = complete("hello /tabl");
    expect(result?.from).toBe(6);
    expect(result?.options.map(option => option.label)).toEqual(["Table"]);
    expect(complete("word/tabl")).toBeNull();
  });
  it("does not suggest inside fenced code except the opening language", () => {
    expect(complete("```js\n/hea")).toBeNull();
    expect(complete("~~~md\n:ro")).toBeNull();
    expect(complete("```py")?.options.some(option => option.label === "python")).toBe(true);
  });
  it("offers local emoji, links, and heading anchors", () => {
    expect(complete(":ro")?.options.find(option => option.label === ":rocket:")?.apply).toBe("🚀");
    expect(complete(":r")).toBeNull();
    expect(complete("[")?.options.some(option => option.label === "Link")).toBe(true);
    expect(complete("# My Heading\n[go](#")?.options.map(option => option.label)).toEqual(["my-heading"]);
  });
  it("increments numbers and resets continued task checkboxes", () => {
    const numbered = editor("9. first"); listEnter(numbered); expect(numbered.state.doc.toString()).toBe("9. first\n10. ");
    const task = editor("- [x] done"); listEnter(task); expect(task.state.doc.toString()).toBe("- [x] done\n- [ ] ");
    const empty = editor("- [ ] "); listEnter(empty); expect(empty.state.doc.toString()).toBe("");
  });
  it("wraps selected text and selects the link URL", () => {
    const bold = editor("Hello", 0, 5); wrapSelection(bold, "**"); expect(bold.state.doc.toString()).toBe("**Hello**");
    const link = editor("Hello", 0, 5); insertLink(link); expect(link.state.doc.toString()).toBe("[Hello](url)");
    expect(link.state.sliceDoc(link.state.selection.main.from, link.state.selection.main.to)).toBe("url");
  });
  it("moves forward and backward between table cells", () => {
    const view = editor("| a | b | c |", 2);
    expect(tableTab(false)(view)).toBe(true); expect(view.state.selection.main.head).toBe(6);
    tableTab(true)(view); expect(view.state.selection.main.head).toBe(2);
  });
});