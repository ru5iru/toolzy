import { useMemo, useState, useCallback } from "react";
import { Type, Search, Replace, RefreshCw, Clock, Hash, AlignCenter, AlignLeft, AlignRight, Plus, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { ToolSEO } from "@/components/ToolSEO";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  convertCase, dedupeLines, numberLines, reverseLines, slugify, sortLines, textStats, trimLines, type CaseKind,
} from "@/lib/text/textUtils";

// ─── Lorem ipsum ─────────────────────────────────────────────────────────────
const LOREM_POOL = [
  "lorem","ipsum","dolor","sit","amet","consectetur","adipiscing","elit","sed","do","eiusmod",
  "tempor","incididunt","ut","labore","et","dolore","magna","aliqua","enim","ad","minim","veniam",
  "quis","nostrud","exercitation","ullamco","laboris","nisi","aliquip","ex","ea","commodo",
  "consequat","duis","aute","irure","in","reprehenderit","voluptate","velit","esse","cillum","eu",
  "fugiat","nulla","pariatur","excepteur","sint","occaecat","cupidatat","non","proident","sunt",
  "culpa","qui","officia","deserunt","mollit","anim","id","est","laborum","perspiciatis","unde",
  "omnis","iste","natus","error","accusantium","doloremque","laudantium","totam","rem","aperiam",
  "eaque","ipsa","quae","inventore","veritatis","quasi","architecto","beatae","vitae","dicta",
  "explicabo","nemo","ipsam","quia","voluptas","aspernatur","aut","odit","fugit","magni","dolores",
  "ratione","sequi","nesciunt","neque","porro","quisquam","adipisci","numquam","eius","modi",
  "tempora","incidunt","quaerat","reiciendis","voluptatibus","maiores","alias","consequatur",
  "perferendis","doloribus","asperiores","repellat","rerum","facilis",
];

function loremWord() { return LOREM_POOL[Math.floor(Math.random() * LOREM_POOL.length)]; }
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function loremSentence(): string {
  const len = 8 + Math.floor(Math.random() * 10);
  const words = Array.from({ length: len }, (_, i) => i === 0 ? capitalize(loremWord()) : loremWord());
  // random comma
  if (len > 6 && Math.random() > 0.5) {
    const mid = 3 + Math.floor(Math.random() * (len - 5));
    words[mid] = words[mid] + ",";
  }
  return words.join(" ") + ".";
}

function loremParagraph(): string {
  const count = 4 + Math.floor(Math.random() * 3);
  const sents = Array.from({ length: count }, loremSentence);
  return sents.join(" ");
}

function generateLorem(type: "words" | "sentences" | "paragraphs", count: number, startClassic: boolean): string {
  const classic = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
  if (type === "words") {
    const pool = startClassic
      ? ["Lorem","ipsum","dolor","sit","amet","consectetur","adipiscing","elit","sed","do","eiusmod","tempor"]
      : [];
    while (pool.length < count) pool.push(capitalize(loremWord()));
    return pool.slice(0, count).join(" ") + ".";
  }
  if (type === "sentences") {
    const sents = startClassic
      ? [classic.split(". ")[0] + ".", ...Array.from({ length: count - 1 }, loremSentence)]
      : Array.from({ length: count }, loremSentence);
    return sents.slice(0, count).join(" ");
  }
  // paragraphs
  const paras = startClassic
    ? [classic, ...Array.from({ length: count - 1 }, loremParagraph)]
    : Array.from({ length: count }, loremParagraph);
  return paras.slice(0, count).join("\n\n");
}

// ─── Slug ────────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","has","have","had","be","been","being","it","its","this","that","these","those"]);

function advancedSlug(text: string, sep: string, stripStop: boolean): string {
  let words = text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (stripStop) words = words.filter((w) => !STOP_WORDS.has(w));
  if (!words.length) return "";
  const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return words.join(sep).replace(new RegExp(`${escapedSep}+`, "g"), sep);
}

// ─── Markdown table ───────────────────────────────────────────────────────────
type ColAlign = "left" | "center" | "right";
interface MdCol { id: string; header: string; align: ColAlign; }
interface MdRow { id: string; cells: Record<string, string>; }

function buildMarkdownTable(cols: MdCol[], rows: MdRow[]): string {
  if (!cols.length) return "";
  const alignSep = (a: ColAlign) => a === "center" ? ":---:" : a === "right" ? "---:" : ":---";
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  const header = "| " + cols.map((c) => cell(c.header || "Column")).join(" | ") + " |";
  const sep = "| " + cols.map((c) => alignSep(c.align)).join(" | ") + " |";
  const bodyRows = rows.map((r) => "| " + cols.map((c) => cell(r.cells[c.id] ?? "")).join(" | ") + " |");
  return [header, sep, ...bodyRows].join("\n");
}

// ─── Main constants ───────────────────────────────────────────────────────────
const cases: [CaseKind, string][] = [
  ["upper", "UPPER"], ["lower", "lower"], ["title", "Title Case"], ["sentence", "Sentence case"],
  ["camel", "camelCase"], ["pascal", "PascalCase"], ["snake", "snake_case"], ["kebab", "kebab-case"], ["constant", "CONSTANT_CASE"], ["dot", "dot.case"],
];

const lineOps: [string, (s: string) => string][] = [
  ["Sort A–Z", (s) => sortLines(s)],
  ["Sort Z–A", (s) => sortLines(s, { descending: true })],
  ["Sort numeric", (s) => sortLines(s, { numeric: true })],
  ["Reverse", reverseLines],
  ["Remove duplicates", (s) => dedupeLines(s)],
  ["Trim lines", (s) => trimLines(s)],
  ["Remove empty lines", (s) => trimLines(s, true)],
  ["Number lines", numberLines],
  ["Slugify", slugify],
];

const TextUtilities = () => {
  // ── Transform tab ──
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findRegex, setFindRegex] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const stats = useMemo(() => textStats(text), [text]);

  const apply = (fn: (s: string) => string) => { setHistory((h) => [...h.slice(-19), text]); setText(fn(text)); };
  const undo = () => setHistory((h) => { if (!h.length) return h; setText(h[h.length - 1]); return h.slice(0, -1); });

  const findCount = useMemo(() => {
    if (!findText || !text) return 0;
    try {
      const pattern = findRegex ? new RegExp(findText, "g") : new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      return (text.match(pattern) || []).length;
    } catch { return 0; }
  }, [text, findText, findRegex]);

  const applyReplace = () => {
    if (!findText) return;
    apply((s) => {
      try {
        const pattern = findRegex ? new RegExp(findText, "g") : new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        return s.replace(pattern, replaceText);
      } catch { return s; }
    });
  };

  // ── Lorem ipsum tab ──
  const [loremType, setLoremType] = useState<"words" | "sentences" | "paragraphs">("paragraphs");
  const [loremCount, setLoremCount] = useState("3");
  const [loremClassic, setLoremClassic] = useState(true);
  const [loremOutput, setLoremOutput] = useState("");

  const runLorem = useCallback(() => {
    const count = Math.min(Math.max(1, parseInt(loremCount) || 1), loremType === "words" ? 500 : loremType === "sentences" ? 50 : 20);
    setLoremOutput(generateLorem(loremType, count, loremClassic));
  }, [loremType, loremCount, loremClassic]);

  // ── Slug tab ──
  const [slugInput, setSlugInput] = useState("");
  const [slugSep, setSlugSep] = useState("-");
  const [slugStrip, setSlugStrip] = useState(false);
  const slugOutput = useMemo(() => advancedSlug(slugInput, slugSep, slugStrip), [slugInput, slugSep, slugStrip]);

  // ── Reading time tab ──
  const [rtText, setRtText] = useState("");
  const rtStats = useMemo(() => {
    const s = textStats(rtText);
    const wpm200 = Math.max(1, Math.round(s.words / 200));
    const wpm238 = s.words > 0 ? (s.words / 238).toFixed(1) : "0";
    const speakMin = s.words > 0 ? Math.max(1, Math.round(s.words / 130)) : 0;
    // Rough Flesch-Kincaid reading ease: letters/words and syllables
    const sentences = (rtText.match(/[.!?]+/g) || []).length || 1;
    const syllables = rtText.toLowerCase().replace(/[^a-z]/g, " ").split(/\s+/).filter(Boolean)
      .reduce((acc, w) => acc + Math.max(1, w.replace(/[^aeiouy]/g, "").length), 0);
    const fk = s.words > 0 ? Math.min(100, Math.max(0, Math.round(206.835 - 1.015 * (s.words / sentences) - 84.6 * (syllables / s.words)))) : 0;
    const fkLabel = fk >= 70 ? "Easy" : fk >= 60 ? "Standard" : fk >= 50 ? "Fairly difficult" : fk >= 30 ? "Difficult" : "Very difficult";
    const fkColor = fk >= 70 ? "bg-[hsl(var(--success))]" : fk >= 50 ? "bg-[hsl(var(--warning))]" : "bg-destructive";
    return { ...s, wpm200, wpm238, speakMin, fk, fkLabel, fkColor, sentences };
  }, [rtText]);

  // ── Markdown table tab ──
  const newColId = () => crypto.randomUUID();
  const newRowId = () => crypto.randomUUID();
  const [mdCols, setMdCols] = useState<MdCol[]>([
    { id: newColId(), header: "Column 1", align: "left" },
    { id: newColId(), header: "Column 2", align: "left" },
    { id: newColId(), header: "Column 3", align: "left" },
  ]);
  const [mdRows, setMdRows] = useState<MdRow[]>([
    { id: newRowId(), cells: {} },
    { id: newRowId(), cells: {} },
    { id: newRowId(), cells: {} },
  ]);
  const mdOutput = useMemo(() => buildMarkdownTable(mdCols, mdRows), [mdCols, mdRows]);

  const addMdCol = () => {
    const id = newColId();
    setMdCols((c) => [...c, { id, header: `Column ${c.length + 1}`, align: "left" }]);
  };
  const removeMdCol = (id: string) => setMdCols((c) => c.filter((x) => x.id !== id));
  const updateMdCol = (id: string, field: keyof MdCol, value: string) =>
    setMdCols((c) => c.map((x) => x.id === id ? { ...x, [field]: value } : x));

  const addMdRow = () => setMdRows((r) => [...r, { id: newRowId(), cells: {} }]);
  const removeMdRow = (id: string) => setMdRows((r) => r.filter((x) => x.id !== id));
  const updateMdCell = (rowId: string, colId: string, value: string) =>
    setMdRows((r) => r.map((row) => row.id === rowId ? { ...row, cells: { ...row.cells, [colId]: value } } : row));

  return (
    <ToolPageLayout title="Text Utilities" icon={Type} description="Transform text, generate lorem ipsum, build slugs, estimate reading time and create markdown tables.">
      <ToolSEO
        title="Text Utilities — Case Converter, Lorem Ipsum, Slug & More"
        description="Free browser-based text tools: convert case, slugify, sort lines, lorem ipsum generator, reading time estimator, and markdown table builder. No data is uploaded."
        canonicalPath="/text"
        keywords={["case converter", "camelCase converter", "snake_case converter", "kebab-case converter", "slugify", "lorem ipsum generator", "reading time estimator", "markdown table generator", "word counter"]}
        faq={[
          { question: "How do I convert text to camelCase?", answer: "Paste text, then click the camelCase button." },
          { question: "What is Lorem ipsum?", answer: "Placeholder text derived from a Latin work by Cicero, used as filler text in design and publishing." },
          { question: "How is reading time calculated?", answer: "Using the standard average of 200 words per minute for silent reading." },
          { question: "Is my text sent to a server?", answer: "No. All transformations run entirely in your browser." },
        ]}
        howToSteps={[
          "Pick a tab — Transform, Lorem Ipsum, Slug, Reading Time, or Markdown Table",
          "Paste or type your text",
          "Use the available options and copy the result",
        ]}
      />

      <Tabs defaultValue="transform">
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="transform" className="text-xs">Transform</TabsTrigger>
          <TabsTrigger value="lorem" className="text-xs">Lorem Ipsum</TabsTrigger>
          <TabsTrigger value="slug" className="text-xs">Slug Generator</TabsTrigger>
          <TabsTrigger value="reading" className="text-xs">Reading Time</TabsTrigger>
          <TabsTrigger value="mdtable" className="text-xs">Markdown Table</TabsTrigger>
        </TabsList>

        {/* ── TRANSFORM ── */}
        <TabsContent value="transform" className="space-y-4 mt-4">
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg bg-card border border-border font-mono text-xs text-muted-foreground">
            <span><span className="text-foreground font-medium">{stats.characters.toLocaleString()}</span> chars</span>
            <span><span className="text-foreground font-medium">{stats.words.toLocaleString()}</span> words</span>
            <span><span className="text-foreground font-medium">{stats.lines.toLocaleString()}</span> lines</span>
            <span><span className="text-foreground font-medium">{stats.bytes.toLocaleString()}</span> bytes</span>
            {stats.readingMinutes > 0 && <span>~{stats.readingMinutes} min read</span>}
            <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setShowFindReplace((v) => !v)} aria-expanded={showFindReplace}>
              <Search className="w-3 h-3" /> Find &amp; Replace
            </Button>
          </div>

          {/* Find & Replace */}
          {showFindReplace && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                  <Replace className="w-3 h-3" /> Find &amp; Replace
                </span>
                <div className="flex items-center gap-1.5">
                  <Switch id="fr-regex" checked={findRegex} onCheckedChange={setFindRegex} className="scale-75" />
                  <Label htmlFor="fr-regex" className="text-xs text-muted-foreground cursor-pointer">Regex</Label>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Find…" className="font-mono text-sm h-8 pr-16" />
                  {findText && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">{findCount} match{findCount !== 1 ? "es" : ""}</span>}
                </div>
                <Input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace with…" className="font-mono text-sm h-8 flex-1" />
                <Button size="sm" className="h-8 shrink-0" onClick={applyReplace} disabled={!findText || !text}>Replace all</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Case</h2>
            <div className="flex flex-wrap gap-2">
              {cases.map(([k, label]) => <Button key={k} variant="secondary" size="sm" disabled={!text} onClick={() => apply((s) => convertCase(s, k))}>{label}</Button>)}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Lines</h2>
            <div className="flex flex-wrap gap-2">
              {lineOps.map(([label, fn]) => <Button key={label} variant="outline" size="sm" disabled={!text} onClick={() => apply(fn)}>{label}</Button>)}
            </div>
          </div>
          <div className="space-y-2">
            <Textarea aria-label="Text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
              placeholder="Paste or type text. Buttons transform it in place; Undo restores the previous version."
              className="code-surface h-[clamp(240px,calc(100dvh-420px),800px)] resize-y bg-card" />
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={text} label="Copy" variant="default" disabled={!text} />
              <Button variant="outline" size="sm" onClick={undo} disabled={!history.length}>Undo ({history.length})</Button>
              <Button variant="ghost" size="sm" onClick={() => { setHistory((h) => [...h, text]); setText(""); }} disabled={!text}>Clear</Button>
            </div>
          </div>
        </TabsContent>

        {/* ── LOREM IPSUM ── */}
        <TabsContent value="lorem" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-card border border-border">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={loremType} onValueChange={(v) => setLoremType(v as typeof loremType)}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paragraphs">Paragraphs</SelectItem>
                  <SelectItem value="sentences">Sentences</SelectItem>
                  <SelectItem value="words">Words</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Count</Label>
              <Input
                type="number" value={loremCount} min={1}
                max={loremType === "words" ? 500 : loremType === "sentences" ? 50 : 20}
                onChange={(e) => setLoremCount(e.target.value)}
                className="h-8 w-24 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Start with classic</Label>
              <div className="flex items-center gap-2 h-8">
                <Switch id="lorem-classic" checked={loremClassic} onCheckedChange={setLoremClassic} />
                <Label htmlFor="lorem-classic" className="text-xs cursor-pointer text-muted-foreground">"Lorem ipsum…"</Label>
              </div>
            </div>
            <Button onClick={runLorem} className="h-8 gap-1.5 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Generate
            </Button>
          </div>

          {loremOutput ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  {loremOutput.split(/\s+/).filter(Boolean).length} words · {loremOutput.length} chars
                </span>
                <CopyButton value={loremOutput} label="Copy" size="sm" variant="outline" />
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {loremOutput}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              Click Generate to produce lorem ipsum text
            </div>
          )}
        </TabsContent>

        {/* ── SLUG GENERATOR ── */}
        <TabsContent value="slug" className="space-y-4 mt-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="slug-input" className="text-xs text-muted-foreground">Input text (title, heading, phrase…)</Label>
              <Textarea
                id="slug-input"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder="e.g. My Awesome Blog Post!"
                className="font-mono text-sm bg-card resize-none min-h-[80px]"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-card border border-border">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Separator</Label>
                <Select value={slugSep} onValueChange={setSlugSep}>
                  <SelectTrigger className="h-8 w-32 text-xs font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-">Hyphen (-)</SelectItem>
                    <SelectItem value="_">Underscore (_)</SelectItem>
                    <SelectItem value=".">Dot (.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Stop words</Label>
                <div className="flex items-center gap-2 h-8">
                  <Switch id="slug-stop" checked={slugStrip} onCheckedChange={setSlugStrip} />
                  <Label htmlFor="slug-stop" className="text-xs cursor-pointer text-muted-foreground">Remove common words</Label>
                </div>
              </div>
            </div>

            {slugOutput ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Slug</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm bg-card border border-border rounded-md px-3 py-2 break-all">{slugOutput}</code>
                  <CopyButton value={slugOutput} label="Copy" size="sm" variant="outline" className="shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground">{slugOutput.length} chars · {slugOutput.split(slugSep).length} parts</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Type above to generate a slug
              </div>
            )}

            {slugInput && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Variants</p>
                <div className="flex flex-wrap gap-2">
                  {(["-","_","."] as const).map((sep) => (
                    <div key={sep} className="flex items-center gap-1.5 bg-muted/40 border border-border rounded px-2 py-1">
                      <code className="text-xs font-mono text-muted-foreground">{advancedSlug(slugInput, sep, slugStrip) || "—"}</code>
                      <CopyButton value={advancedSlug(slugInput, sep, slugStrip)} variant="ghost" size="icon" className="h-5 w-5" ariaLabel={`Copy with ${sep}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── READING TIME ── */}
        <TabsContent value="reading" className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="rt-text" className="text-xs text-muted-foreground">Paste your text</Label>
            <Textarea
              id="rt-text"
              value={rtText}
              onChange={(e) => setRtText(e.target.value)}
              placeholder="Paste an article, blog post, or any text to get reading time and stats…"
              className="font-mono text-sm bg-card resize-y min-h-[200px] h-[clamp(200px,calc(100dvh-500px),500px)]"
            />
          </div>

          {rtText.trim() ? (
            <div className="space-y-3">
              {/* Main stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Words", value: rtStats.words.toLocaleString(), icon: <Hash className="w-3.5 h-3.5" /> },
                  { label: "Characters", value: rtStats.characters.toLocaleString(), icon: <Type className="w-3.5 h-3.5" /> },
                  { label: "Sentences", value: rtStats.sentences.toLocaleString(), icon: <AlignLeft className="w-3.5 h-3.5" /> },
                  { label: "Paragraphs", value: (rtText.split(/\n{2,}/).filter((p) => p.trim()).length || 1).toLocaleString(), icon: <AlignCenter className="w-3.5 h-3.5" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="rounded-lg bg-card border border-border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
                    <p className="font-mono font-semibold text-lg">{value}</p>
                  </div>
                ))}
              </div>

              {/* Time estimates */}
              <div className="rounded-lg bg-card border border-border p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Time Estimates</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Silent reading</p>
                    <p className="font-mono font-semibold text-base">{rtStats.wpm200} min</p>
                    <p className="text-[11px] text-muted-foreground">@ 200 wpm (avg)</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fast reading</p>
                    <p className="font-mono font-semibold text-base">{rtStats.wpm238} min</p>
                    <p className="text-[11px] text-muted-foreground">@ 238 wpm (above avg)</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Speaking aloud</p>
                    <p className="font-mono font-semibold text-base">{rtStats.speakMin} min</p>
                    <p className="text-[11px] text-muted-foreground">@ 130 wpm (speech)</p>
                  </div>
                </div>
              </div>

              {/* Flesch-Kincaid */}
              <div className="rounded-lg bg-card border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flesch Reading Ease</p>
                  <Badge variant="secondary" className="text-xs">{rtStats.fkLabel}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${rtStats.fkColor}`} style={{ width: `${rtStats.fk}%` }} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-12 text-right">{rtStats.fk} / 100</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Score 0–100; higher = easier. 60–70 is plain English aimed at 13–15 year olds.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              Paste text above to see reading time estimates and stats
            </div>
          )}
        </TabsContent>

        {/* ── MARKDOWN TABLE ── */}
        <TabsContent value="mdtable" className="space-y-4 mt-4">
          {/* Column editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Columns</h2>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addMdCol} disabled={mdCols.length >= 10}>
                <Plus className="w-3 h-3" /> Add column
              </Button>
            </div>
            <div className="space-y-1.5">
              {mdCols.map((col) => (
                <div key={col.id} className="flex items-center gap-2">
                  <Input
                    value={col.header}
                    onChange={(e) => updateMdCol(col.id, "header", e.target.value)}
                    placeholder="Column header"
                    className="h-8 text-xs font-mono flex-1"
                  />
                  <div className="flex items-center border border-border rounded-md overflow-hidden shrink-0">
                    {(["left","center","right"] as ColAlign[]).map((a) => (
                      <button
                        key={a}
                        onClick={() => updateMdCol(col.id, "align", a)}
                        className={`h-8 w-8 flex items-center justify-center text-xs transition-colors ${col.align === a ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
                        title={`Align ${a}`}
                      >
                        {a === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => removeMdCol(col.id)} disabled={mdCols.length <= 1}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Row editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rows</h2>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addMdRow} disabled={mdRows.length >= 30}>
                <Plus className="w-3 h-3" /> Add row
              </Button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {mdRows.map((row, ri) => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-right">{ri + 1}</span>
                  {mdCols.map((col) => (
                    <Input
                      key={col.id}
                      value={row.cells[col.id] ?? ""}
                      onChange={(e) => updateMdCell(row.id, col.id, e.target.value)}
                      placeholder={col.header}
                      className="h-8 text-xs font-mono flex-1 min-w-0"
                    />
                  ))}
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => removeMdRow(row.id)} disabled={mdRows.length <= 1}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Output */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Markdown</h2>
              <CopyButton value={mdOutput} label="Copy table" size="sm" variant="outline" disabled={!mdOutput} />
            </div>
            <Textarea
              value={mdOutput}
              readOnly
              className="font-mono text-xs bg-card resize-none min-h-[120px]"
            />
          </div>
        </TabsContent>
      </Tabs>
    </ToolPageLayout>
  );
};

export default TextUtilities;
