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
      <ToolSEO
        title="Text Utilities — Case Converter, Slugify & Line Tools"
        description="Free browser-based text tools: convert case (camelCase, PascalCase, snake_case, kebab-case), slugify, sort and deduplicate lines, count words and characters. No data is uploaded."
        canonicalPath="/text"
        keywords={["case converter", "camelCase converter", "snake_case converter", "kebab-case converter", "slugify", "sort lines online", "remove duplicate lines", "word counter", "text transformation"]}
        faq={[
          { question: "How do I convert text to camelCase?", answer: "Paste or type your text in the box, then click the camelCase button. Each word or line is treated as a separate identifier token and joined in camelCase." },
          { question: "What is the difference between snake_case and kebab-case?", answer: "snake_case separates words with underscores (e.g. my_variable_name) and is common in Python and database column names. kebab-case separates words with hyphens (e.g. my-class-name) and is common in CSS class names and URL slugs." },
          { question: "How does slugify work?", answer: "Slugify converts text to a URL-friendly slug: it lowercases everything, replaces spaces and special characters with hyphens, and strips leading and trailing hyphens. For example, 'Hello World!' becomes 'hello-world'." },
          { question: "Can I sort lines alphabetically?", answer: "Yes. Click Sort A–Z for ascending order or Sort Z–A for descending. Numeric sort orders lines by their numeric value where present." },
          { question: "How do I remove duplicate lines?", answer: "Click Deduplicate lines. The tool keeps the first occurrence of each line and removes any later duplicates, preserving the original order." },
          { question: "Is my text sent to a server?", answer: "No. All transformations run entirely in your browser using JavaScript. Your text never leaves your machine." },
        ]}
        howToSteps={[
          "Paste or type text into the input area",
          "Click a case button (e.g. camelCase, snake_case) or a line operation (Sort, Deduplicate, Trim)",
          "Use Undo to revert the last change",
          "Copy the result with the Copy button",
        ]}
      />
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
