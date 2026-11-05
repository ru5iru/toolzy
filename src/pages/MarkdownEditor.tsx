import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { openSearchPanel, search } from "@codemirror/search";
import { diffLines } from "diff";
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Link, MoreHorizontal, FileText, Download, ChevronDown, Search, Sun, Moon, PanelLeft, Columns2, Eye, GitCompare, Maximize, FolderOpen, Save, Keyboard, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ToolSEO } from "@/components/ToolSEO";
import { useIsMobile } from "@/hooks/use-mobile";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { STORAGE_KEY, WELCOME, documentStats, safeFilename, standaloneHTML } from "@/components/markdown/documentUtils";
import { markdownExtensions, wrapSelection, insertLink, snippets } from "@/components/markdown/editorExtensions";
import "@/components/markdown/markdown.css";

type Mode = "editor" | "split" | "preview" | "compare";
const editorSetup = { foldGutter: false, highlightActiveLine: true, lineNumbers: true, closeBrackets: false, autocompletion: false };
function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={label} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
function initialDocument() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && typeof stored === "object" && "text" in stored && typeof stored.text === "string") {
      return { text: stored.text, snapshot: "snapshot" in stored && typeof stored.snapshot === "string" ? stored.snapshot : stored.text, name: "name" in stored && typeof stored.name === "string" ? safeFilename(stored.name) : "document.md" };
    }
  } catch { /* Corrupt or disabled local storage must not stop editing. */ }
  return { text: WELCOME, snapshot: WELCOME, name: "document.md" };
}
export default function MarkdownEditor() {
  const [initial] = useState(initialDocument);
  const [text, setText] = useState(initial.text);
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [name, setName] = useState(initial.name);
  const [mode, setMode] = useState<Mode>("split");
  const [focus, setFocus] = useState(false);
  const [sync, setSync] = useState(true);
  const [light, setLight] = useState(false);
  const [saved, setSaved] = useState("Auto-saved");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [dialog, setDialog] = useState<"shortcuts" | "about" | null>(null);
  const [dragging, setDragging] = useState(false);
  const mobile = useIsMobile();
  const deferred = useDeferredValue(text);
  const stats = useMemo(() => documentStats(text), [text]);
  const changes = useMemo(() => mode === "compare" ? diffLines(snapshot, deferred) : [], [mode, snapshot, deferred]);
  const view = useRef<EditorView>();
  const preview = useRef<HTMLDivElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const scrollLock = useRef(false);
  const pendingSearch = useRef(false);
  const effectiveMode = focus ? "editor" : mobile && mode === "split" ? "editor" : mode;

  useEffect(() => {
    setSaved("Saving...");
    const timeout = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ text, snapshot, name })); setSaved("Auto-saved"); }
      catch { setSaved("Not saved · download a copy"); }
    }, 500);
    return () => clearTimeout(timeout);
  }, [text, snapshot, name]);

  const download = useCallback((content: string, extension: "md" | "html") => {
    const url = URL.createObjectURL(new Blob([content], { type: extension === "md" ? "text/markdown;charset=utf-8" : "text/html;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = extension === "md" ? safeFilename(name) : safeFilename(name).replace(/\.md$/, ".html"); anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [name]);
  const save = useCallback(() => { download(text, "md"); setSnapshot(text); toast.success("Markdown downloaded; comparison snapshot updated"); }, [text, download]);
  const getHTML = useCallback(() => {
    const markup = renderToStaticMarkup(<MarkdownPreview text={text} />);
    const doc = new DOMParser().parseFromString(markup, "text/html");
    doc.querySelectorAll("button").forEach(button => button.remove());
    return standaloneHTML(doc.body.innerHTML, name);
  }, [text, name]);
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard"); } catch { toast.error("Clipboard access failed"); } };
  const print = () => {
    const frame = document.createElement("iframe"); frame.className = "sr-only"; frame.title = "Print Markdown";
    frame.srcdoc = getHTML(); frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => frame.remove(), 1000); }; document.body.appendChild(frame);
  };
  const openFile = async (file: File) => {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) { toast.error("Open a .md, .markdown, or .txt file"); return; }
    try { const value = await file.text(); setText(value); setSnapshot(value); setName(safeFilename(file.name)); toast.success("Document opened locally"); }
    catch { toast.error("This file could not be read"); }
  };
  const find = useCallback(() => {
    pendingSearch.current = true;
    setFocus(false); setMode(mobile ? "editor" : "split");
    setTimeout(() => { const dom = document.querySelector(".markdown-editor .cm-editor"); const editor = dom ? EditorView.findFromDOM(dom as HTMLElement) : undefined; if (editor && pendingSearch.current) { view.current = editor; openSearchPanel(editor); pendingSearch.current = false; } }, 50);
  }, [mobile]);
  const format = useCallback((kind: string) => {
    const editor = view.current; if (!editor) return;
    if (kind === "link") { insertLink(editor); return; }
    const wrappers: Record<string, string> = { bold: "**", italic: "*", strike: "~~", code: "`" };
    if (wrappers[kind]) { wrapSelection(editor, wrappers[kind]); return; }
    const prefixes: Record<string, string> = { h1: "# ", h2: "## ", h3: "### ", bullet: "- ", numbered: "1. ", task: "- [ ] " };
    const { from, to } = editor.state.selection.main;
    if (prefixes[kind]) {
      const start = editor.state.doc.lineAt(from).from;
      const selected = editor.state.sliceDoc(start, to);
      editor.dispatch({ changes: { from: start, to, insert: selected.split("\n").map(line => prefixes[kind] + line).join("\n") } }); editor.focus();
    }
  }, []);
  const insertSnippet = (label: string) => {
    const editor = view.current; const snippet = snippets.find(s => s.label === label); if (!editor || !snippet) return;
    const { from, to } = editor.state.selection.main;
    editor.dispatch({ changes: { from, to, insert: snippet.text }, selection: { anchor: from + snippet.text.length } }); editor.focus();
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "s") { event.preventDefault(); save(); }
      else if (mod && key === "o") { event.preventDefault(); filePicker.current?.click(); }
      else if (mod && key === "f") { event.preventDefault(); event.stopPropagation(); find(); }
      else if (mod && ["b", "i", "k", "e"].includes(key)) { event.preventDefault(); format(({ b: "bold", i: "italic", k: "link", e: "code" } as Record<string, string>)[key]); }
      else if (mod && event.shiftKey && key === "x") { event.preventDefault(); format("strike"); }
      else if (event.altKey && ["1", "2", "3", "4"].includes(key)) { event.preventDefault(); setFocus(false); setMode((["editor", "split", "preview", "compare"] as Mode[])[Number(key) - 1]); }
      else if (event.altKey && key === "f") { event.preventDefault(); setFocus(value => !value); }
      else if (key === "Escape" && focus) { setFocus(false); }
      else if (key === "?" && !(event.target instanceof HTMLElement && (event.target.isContentEditable || /input|textarea/i.test(event.target.tagName)))) { event.preventDefault(); setDialog("shortcuts"); }
    };
    window.addEventListener("keydown", handler, true); return () => window.removeEventListener("keydown", handler, true);
  }, [save, find, format, focus]);
  const synchronize = useCallback((source: HTMLElement, target?: HTMLElement | null) => {
    if (!sync || !target || scrollLock.current) return;
    scrollLock.current = true;
    target.scrollTop = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight) * (target.scrollHeight - target.clientHeight);
    requestAnimationFrame(() => { scrollLock.current = false; });
  }, [sync]);
  const extensions = useMemo(() => [markdown(), ...markdownExtensions(), EditorView.lineWrapping, EditorView.contentAttributes.of({ "aria-label": "Markdown source", spellcheck: "false" }), EditorView.domEventHandlers({ scroll: (_event, editor) => { synchronize(editor.scrollDOM, preview.current); return false; } })], [synchronize]);
  const updateCursor = useCallback((update: ViewUpdate) => {
    if (!update.selectionSet && !update.docChanged) return;
    const pos = update.state.selection.main.head; const line = update.state.doc.lineAt(pos); const col = pos - line.from + 1;
    setCursor(previous => previous.line === line.number && previous.col === col ? previous : { line: line.number, col });
  }, []);
  const searchExtension = useMemo(() => search({ top: true }), []);
  const editorExtensions = useMemo(() => [...extensions, searchExtension], [extensions, searchExtension]);

  const editorPane = <section className="flex h-full min-h-0 min-w-0 flex-col markdown-editor" aria-label="Markdown editor pane">
    <header className="shrink-0 border-b border-border bg-card px-3 py-2 flex flex-wrap items-center gap-1">
      <span className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mr-2"><span className="h-1.5 w-1.5 rounded-full bg-success" />Markdown source</span>
      <div className="flex flex-wrap gap-0.5" role="toolbar" aria-label="Markdown formatting">
        {([{ key: "bold", label: "Bold (Ctrl/Cmd+B)", icon: Bold }, { key: "italic", label: "Italic (Ctrl/Cmd+I)", icon: Italic }, { key: "strike", label: "Strikethrough (Ctrl/Cmd+Shift+X)", icon: Strikethrough }, { key: "code", label: "Inline code (Ctrl/Cmd+E)", icon: Code }, { key: "h1", label: "Heading 1", icon: Heading1 }, { key: "h2", label: "Heading 2", icon: Heading2 }, { key: "h3", label: "Heading 3", icon: Heading3 }, { key: "bullet", label: "Bullet list", icon: List }, { key: "numbered", label: "Numbered list", icon: ListOrdered }, { key: "task", label: "Task list", icon: ListTodo }, { key: "link", label: "Link (Ctrl/Cmd+K)", icon: Link }]).map(item => <IconButton key={item.key} label={item.label} onClick={() => format(item.key)}><item.icon className="h-3.5 w-3.5" /></IconButton>)}
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More formatting"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent>{["Quote", "Code block", "Table", "Horizontal rule", "Image", "Details", "Footnote"].map(label => <DropdownMenuItem key={label} onSelect={() => insertSnippet(label)}>{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      </div><Badge variant="outline" className="ml-auto text-[9px] font-mono">MARKDOWN</Badge>
    </header>
    <CodeMirror value={text} height="100%" className="flex-1 min-h-0 overflow-hidden" theme="none" extensions={editorExtensions} onCreateEditor={editor => { view.current = editor; if (pendingSearch.current) { openSearchPanel(editor); pendingSearch.current = false; } }} onChange={setText} onUpdate={updateCursor} basicSetup={editorSetup} />
  </section>;
  const previewPane = <section className="flex h-full min-h-0 min-w-0 flex-col" aria-label="Markdown preview pane"><header className="h-12 shrink-0 border-b border-border bg-card px-4 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Live preview</h2><Badge variant="outline" className="ml-auto text-[9px] font-mono">{stats.minutes} MIN</Badge></header><div ref={preview} onScroll={event => synchronize(event.currentTarget, view.current?.scrollDOM)} className="markdown-preview flex-1 min-h-0 overflow-auto p-6"><MarkdownPreview text={deferred} /></div></section>;

  return <div data-theme={light ? "light" : "dark"} className={`markdown-workspace flex flex-col min-h-0 h-full ${focus ? "fixed inset-0 z-50" : ""} ${dragging ? "ring-2 ring-inset ring-primary" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void openFile(file); }}>
    <ToolSEO title="Markdown Editor" description="Write Markdown with a safe live preview, slash suggestions, local autosave, side-by-side comparison, and Markdown or HTML exports. Entirely in your browser." canonicalPath="/markdown" keywords={["markdown editor", "GFM preview", "local markdown editor", "markdown to HTML"]} howToSteps={["Write or open a local Markdown file.", "Use the toolbar or slash menu to format your document.", "Preview or compare, then export Markdown or HTML."]} />
    <input ref={filePicker} type="file" className="sr-only" accept=".md,.markdown,.txt" aria-label="Open Markdown file" onChange={event => { const file = event.target.files?.[0]; if (file) void openFile(file); event.target.value = ""; }} />
    {!focus && <header className="markdown-chrome shrink-0 border-b border-border px-3 py-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h1 className="text-sm font-mono font-bold">Markdown Editor</h1></div>
      <Tabs value={mobile && mode === "split" ? "editor" : mode} onValueChange={value => setMode(value as Mode)}><TabsList className="h-9 bg-secondary">{[{ value: "editor", label: "Editor", icon: PanelLeft }, ...(!mobile ? [{ value: "split", label: "Split", icon: Columns2 }] : []), { value: "preview", label: "Preview", icon: Eye }, { value: "compare", label: "Compare", icon: GitCompare }].map(item => <Tooltip key={item.value}><TooltipTrigger asChild><TabsTrigger className="text-xs px-2 gap-1.5" value={item.value}><item.icon className="h-3.5 w-3.5" /><span>{item.label}</span></TabsTrigger></TooltipTrigger><TooltipContent>{item.label} view (Alt+{["editor", "split", "preview", "compare"].indexOf(item.value) + 1})</TooltipContent></Tooltip>)}</TabsList></Tabs>
      <div className="flex items-center gap-1">
        <label className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground mr-2">Sync<Switch checked={sync} onCheckedChange={setSync} aria-label="Synchronized scrolling" /></label>
        <div className="hidden lg:flex"><IconButton label="Find (Ctrl/Cmd+F)" onClick={find}><Search className="h-4 w-4" /></IconButton><IconButton label="Toggle editor theme" onClick={() => setLight(v => !v)}>{light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</IconButton></div>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More editor actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => filePicker.current?.click()}><FolderOpen className="h-4 w-4 mr-2" />Open file</DropdownMenuItem><DropdownMenuItem onSelect={save}><Save className="h-4 w-4 mr-2" />Save Markdown</DropdownMenuItem><DropdownMenuItem onSelect={find}><Search className="h-4 w-4 mr-2" />Find and replace</DropdownMenuItem><DropdownMenuItem onSelect={() => setLight(v => !v)}><Sun className="h-4 w-4 mr-2" />{light ? "Dark" : "Light"} editor theme</DropdownMenuItem><DropdownMenuItem onSelect={() => setSync(v => !v)}>Sync scrolling: {sync ? "on" : "off"}</DropdownMenuItem><DropdownMenuItem onSelect={() => setFocus(true)}><Maximize className="h-4 w-4 mr-2" />Focus mode</DropdownMenuItem><DropdownMenuItem onSelect={() => { setSnapshot(text); toast.success("Comparison snapshot updated"); }}><RotateCcw className="h-4 w-4 mr-2" />Set comparison snapshot</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setDialog("shortcuts")}><Keyboard className="h-4 w-4 mr-2" />Keyboard shortcuts</DropdownMenuItem><DropdownMenuItem onSelect={() => setDialog("about")}><Info className="h-4 w-4 mr-2" />About & privacy</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" className="h-8 text-xs gap-1.5"><Download className="h-3.5 w-3.5" />Export<ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={save}>Download .md</DropdownMenuItem><DropdownMenuItem onSelect={() => download(getHTML(), "html")}>Download .html</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void copy(text)}>Copy Markdown</DropdownMenuItem><DropdownMenuItem onSelect={() => void copy(getHTML())}>Copy HTML</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={print}>Print / Save as PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </header>}
    {focus && <Button variant="outline" size="sm" className="fixed right-4 bottom-4 z-50" onClick={() => setFocus(false)}>Exit focus (Alt+F)</Button>}
    <div className="flex-1 min-h-0 overflow-hidden">
      {effectiveMode === "split" ? <ResizablePanelGroup direction="horizontal"><ResizablePanel defaultSize={50} minSize={25}>{editorPane}</ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={50} minSize={25}>{previewPane}</ResizablePanel></ResizablePanelGroup> : effectiveMode === "editor" ? editorPane : effectiveMode === "preview" ? previewPane : <section className="flex flex-col h-full min-h-0" aria-label="Document comparison"><div className="grid grid-cols-2 shrink-0 border-b border-border bg-card text-xs font-mono text-muted-foreground"><h2 className="p-3">SAVED / OPENED SNAPSHOT</h2><h2 className="p-3 border-l border-border">CURRENT DOCUMENT</h2></div><div className="grid grid-cols-2 flex-1 min-h-0 overflow-auto font-mono text-xs whitespace-pre-wrap break-all"><div className="border-r border-border p-3">{changes.filter(c => !c.added).map((c, i) => <div key={i} className={c.removed ? "bg-destructive/10 text-destructive" : "text-muted-foreground"}>{c.value}</div>)}</div><div className="p-3">{changes.filter(c => !c.removed).map((c, i) => <div key={i} className={c.added ? "bg-success/10 text-success" : "text-muted-foreground"}>{c.value}</div>)}</div></div></section>}
    </div>
    {!focus && <footer className="markdown-chrome border-t border-border bg-card shrink-0 px-3 py-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground font-mono"><div className="flex flex-wrap gap-3"><span role="status" className={saved === "Auto-saved" ? "text-success" : ""}>{saved}</span><span>{stats.words} Words</span><span>{stats.chars} Chars</span><span>{stats.lines} Lines</span><span>Ln {cursor.line}, Col {cursor.col}</span></div><div className="hidden xl:flex gap-3"><span>⌘/Ctrl S Save</span><span>⌘/Ctrl O Open</span><span>⌘/Ctrl F Find</span><span>Alt 1/2/3 Views</span><span>Alt F Focus</span><Button className="h-auto p-0 text-xs" variant="link" onClick={() => setDialog("shortcuts")}>? Shortcuts</Button></div></footer>}
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === "shortcuts" ? "Keyboard shortcuts" : "Markdown Editor · About & privacy"}</DialogTitle><DialogDescription>{dialog === "shortcuts" ? "Use Ctrl on Windows/Linux or Cmd on macOS." : "A browser-only Markdown workspace for notes, READMEs, and documentation."}</DialogDescription></DialogHeader>{dialog === "shortcuts" ? <dl className="grid grid-cols-2 gap-3 text-sm">{[["Save / Open / Find", "Ctrl/Cmd + S / O / F"], ["Bold / Italic / Link", "Ctrl/Cmd + B / I / K"], ["Inline code", "Ctrl/Cmd + E"], ["Strikethrough", "Ctrl/Cmd + Shift + X"], ["Editor / Split / Preview / Compare", "Alt + 1 / 2 / 3 / 4"], ["Focus mode", "Alt + F (Esc to exit)"], ["Slash menu", "/ then ↑ ↓ Enter / Tab"], ["Indent / Outdent", "Tab / Shift + Tab"], ["Shortcuts (outside editor)", "?"]].map(([label, value]) => <div className="contents" key={label}><dt>{label}</dt><dd className="font-mono text-xs text-muted-foreground">{value}</dd></div>)}</dl> : <div className="space-y-4 text-sm"><h2 className="font-semibold">Is my text uploaded?</h2><p className="text-muted-foreground">No. Editing, rendering, comparison, and exports happen in this browser. Your document is auto-saved on this device after 500 ms. No document text is sent in requests or analytics.</p><h2 className="font-semibold">What Markdown is supported?</h2><p className="text-muted-foreground">GitHub-flavored tables, tasks, strikethrough, links, footnotes, code highlighting, and sanitized HTML. Remote images are blocked to keep content from leaving your browser. The website still loads its own libraries and assets.</p><h2 className="font-semibold">What does Compare use?</h2><p className="text-muted-foreground">The last opened or downloaded document, or the snapshot you explicitly set. Autosave does not replace this snapshot.</p></div>}</DialogContent></Dialog>
  </div>;
}