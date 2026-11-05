import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Bold, Italic, Strikethrough, Underline, Code, Heading1, Heading2, Heading3, Heading4, List, ListOrdered, Braces, Quote, AlignLeft, AlignCenter, AlignRight, RemoveFormatting, Undo2, Redo2, Link, Unlink, Table, ImagePlus, Minus, Copy, Download, FileCode2, MoreHorizontal, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { WELCOME_HTML, formatHTML, htmlDocument, safeLink, sanitizeHTML } from "@/components/html-editor/htmlUtils";
import "@/components/html-editor/html-editor.css";

const faq = [
  { question: "Is my content uploaded?", answer: "No. Editing, HTML generation, imports, copying, and downloads happen in your browser. Documents are not automatically saved; download a copy before leaving." },
  { question: "Can I edit existing HTML?", answer: "Yes. Import HTML source or open a local HTML file. Supported rich-text formatting is retained; scripts, remote images, embedded frames, and unsupported styles are removed." },
  { question: "What can I export?", answer: "Copy an HTML fragment for your website or download a standalone HTML document. Local raster images are embedded as data URLs." },
];

export default function HtmlEditor() {
  const [html, setHtml] = useState(WELCOME_HTML);
  const [dialog, setDialog] = useState<"import" | "link" | "clear" | null>(null);
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState("");
  const filePicker = useRef<HTMLInputElement>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const mobile = useIsMobile();
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: "noopener noreferrer" } } }), TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: false } }), Image.configure({ allowBase64: true })],
    content: WELCOME_HTML,
    editorProps: {
      attributes: { "aria-label": "Rich text editor", role: "textbox", "aria-multiline": "true" },
      transformPastedHTML: sanitizeHTML,
      handleDrop: () => true,
    },
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
  });
  const active = useEditorState({ editor, selector: ({ editor: current }) => current ? {
    bold: current.isActive("bold"), italic: current.isActive("italic"), strike: current.isActive("strike"), underline: current.isActive("underline"), code: current.isActive("code"),
    h1: current.isActive("heading", { level: 1 }), h2: current.isActive("heading", { level: 2 }), h3: current.isActive("heading", { level: 3 }), h4: current.isActive("heading", { level: 4 }),
    bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"), block: current.isActive("codeBlock"), quote: current.isActive("blockquote"), link: current.isActive("link"),
    left: current.isActive({ textAlign: "left" }), center: current.isActive({ textAlign: "center" }), right: current.isActive({ textAlign: "right" }),
    undo: current.can().undo(), redo: current.can().redo(), table: current.isActive("table"),
  } : null });
  const commands = [
    { label: "Bold (Ctrl/Cmd+B)", icon: Bold, active: active?.bold, run: (e: Editor) => e.chain().focus().toggleBold().run() },
    { label: "Italic (Ctrl/Cmd+I)", icon: Italic, active: active?.italic, run: (e: Editor) => e.chain().focus().toggleItalic().run() },
    { label: "Strikethrough", icon: Strikethrough, active: active?.strike, run: (e: Editor) => e.chain().focus().toggleStrike().run() },
    { label: "Underline", icon: Underline, active: active?.underline, run: (e: Editor) => e.chain().focus().toggleUnderline().run() },
    { label: "Inline code", icon: Code, active: active?.code, run: (e: Editor) => e.chain().focus().toggleCode().run() },
    { label: "Heading 1", icon: Heading1, active: active?.h1, run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "Heading 2", icon: Heading2, active: active?.h2, run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Heading 3", icon: Heading3, active: active?.h3, run: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Heading 4", icon: Heading4, active: active?.h4, run: (e: Editor) => e.chain().focus().toggleHeading({ level: 4 }).run() },
    { label: "Bullet list", icon: List, active: active?.bullet, run: (e: Editor) => e.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: active?.ordered, run: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
    { label: "Code block", icon: Braces, active: active?.block, run: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
    { label: "Blockquote", icon: Quote, active: active?.quote, run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
    { label: "Align left", icon: AlignLeft, active: active?.left, run: (e: Editor) => e.chain().focus().setTextAlign("left").run() },
    { label: "Align center", icon: AlignCenter, active: active?.center, run: (e: Editor) => e.chain().focus().setTextAlign("center").run() },
    { label: "Align right", icon: AlignRight, active: active?.right, run: (e: Editor) => e.chain().focus().setTextAlign("right").run() },
    { label: "Clear formatting", icon: RemoveFormatting, run: (e: Editor) => e.chain().focus().unsetAllMarks().clearNodes().run() },
    { label: "Undo", icon: Undo2, disabled: !active?.undo, run: (e: Editor) => e.chain().focus().undo().run() },
    { label: "Redo", icon: Redo2, disabled: !active?.redo, run: (e: Editor) => e.chain().focus().redo().run() },
  ];
  const copy = async () => { try { await navigator.clipboard.writeText(formatHTML(sanitizeHTML(html))); toast.success("HTML copied"); } catch { toast.error("Clipboard access failed"); } };
  const download = () => {
    const objectUrl = URL.createObjectURL(new Blob([htmlDocument(html)], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = "document.html"; anchor.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };
  const applyHTML = (value: string) => { if (!editor) return; editor.commands.setContent(sanitizeHTML(value)); setHtml(editor.getHTML()); };
  const openFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(html?|txt)$/i.test(file.name) || file.size > 5 * 1024 * 1024) { toast.error("Choose an HTML or text file under 5 MiB"); return; }
    try { applyHTML(await file.text()); toast.success("HTML opened locally"); } catch { toast.error("Unable to read this file"); }
  };
  const insertImage = (file?: File) => {
    if (!file || !editor) return;
    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, GIF, or WebP under 5 MiB"); return; }
    const reader = new FileReader(); reader.onerror = () => toast.error("Unable to read this image");
    reader.onload = () => { if (typeof reader.result === "string") editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run(); }; reader.readAsDataURL(file);
  };
  const visualPane = <section className="min-w-0 rounded-lg border border-border bg-card overflow-hidden h-full flex flex-col" aria-labelledby="visual-heading">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2"><h2 id="visual-heading" className="font-mono text-xs text-muted-foreground">VISUAL EDITOR</h2><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" />Live</span></header>
    <div role="toolbar" aria-label="HTML formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
      {commands.map(item => <Tooltip key={item.label}><TooltipTrigger asChild><Button aria-label={item.label} aria-pressed={item.active ?? false} disabled={!editor || item.disabled} variant="ghost" size="icon" className={`h-8 w-8 shrink-0 ${item.active ? "bg-secondary text-primary" : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => { if (editor) item.run(editor); }}><item.icon className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>{item.label}</TooltipContent></Tooltip>)}
      <Tooltip><TooltipTrigger asChild><Button aria-label="Insert or edit link" aria-pressed={active?.link ?? false} variant="ghost" size="icon" className="h-8 w-8" onMouseDown={event => event.preventDefault()} onClick={() => { const href: unknown = editor?.getAttributes("link").href; setUrl(typeof href === "string" ? href : ""); setDialog("link"); }}><Link className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Insert or edit link</TooltipContent></Tooltip>
      <DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="More formatting" variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent>
        <DropdownMenuItem onSelect={() => editor?.chain().focus().unsetLink().run()} disabled={!active?.link}><Unlink className="mr-2 h-4 w-4" />Remove link</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table className="mr-2 h-4 w-4" />Insert table</DropdownMenuItem>
        {active?.table && <>{[{ label: "Add row", run: () => editor?.chain().focus().addRowAfter().run() }, { label: "Add column", run: () => editor?.chain().focus().addColumnAfter().run() }, { label: "Delete row", run: () => editor?.chain().focus().deleteRow().run() }, { label: "Delete column", run: () => editor?.chain().focus().deleteColumn().run() }, { label: "Delete table", run: () => editor?.chain().focus().deleteTable().run() }].map(item => <DropdownMenuItem key={item.label} onSelect={item.run}>{item.label}</DropdownMenuItem>)}</>}
        <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => imagePicker.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Insert local image</DropdownMenuItem><DropdownMenuItem onSelect={() => editor?.chain().focus().setHorizontalRule().run()}><Minus className="mr-2 h-4 w-4" />Horizontal rule</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>
    <EditorContent editor={editor} className="html-rich-text flex-1 min-h-0 overflow-auto p-5 text-sm text-foreground" />
  </section>;
  const sourcePane = <section className="rounded-lg border border-border bg-card overflow-hidden h-full flex flex-col min-w-0" aria-labelledby="source-heading"><header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2"><h2 id="source-heading" className="font-mono text-xs text-muted-foreground">HTML SOURCE</h2><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Copy HTML source" onClick={() => void copy()}><Copy className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Copy HTML source</TooltipContent></Tooltip></header><Textarea readOnly aria-label="Generated HTML source" value={formatHTML(html)} spellCheck={false} className="flex-1 min-h-[340px] resize-none rounded-none border-0 bg-transparent p-5 font-mono text-xs leading-relaxed focus-visible:ring-inset" /><footer className="border-t border-border px-3 py-2 text-[10px] font-mono text-muted-foreground">{html.length.toLocaleString()} characters · HTML fragment</footer></section>;

  return <ToolPageLayout title="HTML WYSIWYG Editor" maxWidth="7xl">
    <ToolSEO title="HTML WYSIWYG Editor" canonicalPath="/html-editor" description="Free browser-only rich-text HTML editor with instant source code, headings, lists, links, tables, local images, and HTML download." keywords={["HTML WYSIWYG editor", "rich text editor", "online HTML editor", "visual HTML editor"]} faq={faq} howToSteps={["Write or import content into the visual editor.", "Apply formatting and inspect the instantly generated HTML.", "Copy the HTML fragment or download a standalone document."]} />
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4 mt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><FileCode2 className="h-4 w-4 text-primary" />Rich text / HTML</div><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => { setDraft(html); setDialog("import"); }}><Upload className="h-3.5 w-3.5 mr-2" />Import HTML</Button><Button size="sm" variant="outline" onClick={() => filePicker.current?.click()}><FileCode2 className="h-3.5 w-3.5 mr-2" />Open file</Button><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Clear document" onClick={() => setDialog("clear")}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Clear document</TooltipContent></Tooltip><Button size="sm" onClick={download}><Download className="h-3.5 w-3.5 mr-2" />Download HTML</Button></div></div>
    <input ref={filePicker} type="file" accept=".html,.htm,.txt" className="sr-only" aria-label="Open HTML file" onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ""; }} />
    <input ref={imagePicker} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" aria-label="Open local image" onChange={event => { insertImage(event.target.files?.[0]); event.target.value = ""; }} />
    {mobile ? <div className="grid gap-4">{visualPane}{sourcePane}</div> : <div className="h-[560px]"><ResizablePanelGroup direction="horizontal"><ResizablePanel defaultSize={50} minSize={25}>{visualPane}</ResizablePanel><ResizableHandle withHandle className="mx-2 bg-transparent" /><ResizablePanel defaultSize={50} minSize={25}>{sourcePane}</ResizablePanel></ResizablePanelGroup></div>}
    <section className="mt-8 border-t border-border pt-5 space-y-4">{faq.map(item => <div key={item.question}><h2 className="text-sm font-mono font-semibold mb-1">{item.question}</h2><p className="text-xs leading-relaxed text-muted-foreground">{item.answer}</p></div>)}</section>
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === "import" ? "Import HTML source" : dialog === "link" ? "Insert or edit link" : "Clear document?"}</DialogTitle><DialogDescription>{dialog === "import" ? "Replace the document with supported HTML. Scripts, remote images, and unsupported styles are removed." : dialog === "link" ? "Use an HTTPS, HTTP, mailto, telephone, or heading-anchor URL." : "This removes the current content. You can undo it while this page remains open."}</DialogDescription></DialogHeader>
      {dialog === "import" && <Textarea aria-label="HTML to import" className="h-64 font-mono text-xs" value={draft} onChange={event => setDraft(event.target.value)} />}
      {dialog === "link" && <Input aria-label="Link URL" placeholder="https://example.com" value={url} onChange={event => setUrl(event.target.value)} />}
      <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={() => {
        if (dialog === "import") { if (draft.length > 5 * 1024 * 1024) { toast.error("HTML must be under 5 MiB"); return; } applyHTML(draft); }
        else if (dialog === "link") { if (!safeLink(url)) { toast.error("Enter a valid, safe link URL"); return; } editor?.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run(); }
        else applyHTML("<p></p>");
        setDialog(null);
      }}>{dialog === "import" ? "Import" : dialog === "link" ? "Apply link" : "Clear document"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </ToolPageLayout>;
}