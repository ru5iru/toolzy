import { useMemo, useState } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { ToolSEO } from "@/components/ToolSEO";
import {
  convertCase, dedupeLines, numberLines, reverseLines, slugify, sortLines, textStats, trimLines, type CaseKind,
} from "@/lib/text/textUtils";

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
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const stats = useMemo(() => textStats(text), [text]);

  const apply = (fn: (s: string) => string) => {
    setHistory((h) => [...h.slice(-19), text]);
    setText(fn(text));
  };
  const undo = () => setHistory((h) => { if (!h.length) return h; setText(h[h.length - 1]); return h.slice(0, -1); });

  return (
    <ToolPageLayout title="Text Utilities" icon={Type} description="Change case, clean up lines and count text.">
      <ToolSEO title="Text Utilities" description="Free online text tools: convert case (camelCase, snake_case, kebab-case), slugify, sort and dedupe lines, and count words and characters in your browser." canonicalPath="/text" keywords={["case converter", "slugify", "sort lines", "remove duplicate lines", "word counter"]} />
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
          className="code-surface h-[clamp(240px,calc(100dvh-380px),800px)] resize-y bg-card" />
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={text} label="Copy" variant="default" disabled={!text} />
          <Button variant="outline" size="sm" onClick={undo} disabled={!history.length}>Undo</Button>
          <Button variant="ghost" size="sm" onClick={() => { setHistory((h) => [...h, text]); setText(""); }} disabled={!text}>Clear</Button>
          <p role="status" className="ml-auto font-mono text-xs text-muted-foreground">
            {stats.characters.toLocaleString()} chars · {stats.words.toLocaleString()} words · {stats.lines.toLocaleString()} lines · {stats.bytes.toLocaleString()} bytes · ~{stats.readingMinutes} min read
          </p>
        </div>
      </div>
    </ToolPageLayout>
  );
};

export default TextUtilities;
