import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { AboutTool } from "@/components/AboutTool";
import { Download, AlignLeft, Columns2 } from "lucide-react";
import * as Diff from "diff";

type ViewMode = "split" | "unified";

interface DiffLine {
  type: "added" | "removed" | "equal";
  content: string;
  leftNum?: number;
  rightNum?: number;
}

function computeLineDiff(original: string, modified: string, ignoreWhitespace: boolean): DiffLine[] {
  const a = ignoreWhitespace
    ? original.split("\n").map((l) => l.trim())
    : original.split("\n");
  const b = ignoreWhitespace
    ? modified.split("\n").map((l) => l.trim())
    : modified.split("\n");

  const changes = Diff.diffArrays(a, b);
  const lines: DiffLine[] = [];
  let leftNum = 1;
  let rightNum = 1;

  for (const change of changes) {
    for (const val of change.value) {
      if (change.added) {
        lines.push({ type: "added", content: val, rightNum: rightNum++ });
      } else if (change.removed) {
        lines.push({ type: "removed", content: val, leftNum: leftNum++ });
      } else {
        lines.push({ type: "equal", content: val, leftNum: leftNum++, rightNum: rightNum++ });
      }
    }
  }
  return lines;
}

function buildUnified(lines: DiffLine[]): string {
  return lines.map((l) => {
    if (l.type === "added") return `+ ${l.content}`;
    if (l.type === "removed") return `- ${l.content}`;
    return `  ${l.content}`;
  }).join("\n");
}

/** Compute word-level inline diff for a removed↔added line pair. */
interface InlinePart { text: string; hl: boolean }
function inlineDiff(a: string, b: string): { left: InlinePart[]; right: InlinePart[] } {
  const changes = Diff.diffWordsWithSpace(a, b);
  const left: InlinePart[] = [];
  const right: InlinePart[] = [];
  for (const ch of changes) {
    if (ch.removed) {
      left.push({ text: ch.value, hl: true });
    } else if (ch.added) {
      right.push({ text: ch.value, hl: true });
    } else {
      left.push({ text: ch.value, hl: false });
      right.push({ text: ch.value, hl: false });
    }
  }
  return { left, right };
}

function InlineText({ parts, side }: { parts: InlinePart[]; side: "left" | "right" }) {
  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <mark
            key={i}
            className={
              side === "left"
                ? "bg-destructive/40 text-destructive rounded-sm"
                : "bg-green-500/40 text-green-400 rounded-sm"
            }
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

const SAMPLE_A = `function greet(name) {
  console.log("Hello, " + name);
  return name;
}

const user = "world";
greet(user);`;

const SAMPLE_B = `function greet(name, greeting = "Hello") {
  console.log(greeting + ", " + name + "!");
  return { name, greeting };
}

const user = "Rusiru";
greet(user, "Hi");`;

const TextDiff = () => {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [showInline, setShowInline] = useState(true);

  const diffLines = useMemo(() => {
    if (!left && !right) return [];
    return computeLineDiff(left, right, ignoreWhitespace);
  }, [left, right, ignoreWhitespace]);

  const stats = useMemo(() => {
    const added = diffLines.filter((l) => l.type === "added").length;
    const removed = diffLines.filter((l) => l.type === "removed").length;
    return { added, removed };
  }, [diffLines]);

  const hasChanges = stats.added > 0 || stats.removed > 0;

  const handleLoadSample = () => {
    setLeft(SAMPLE_A);
    setRight(SAMPLE_B);
  };

  const handleSwap = () => {
    setLeft(right);
    setRight(left);
  };

  const handleDownload = () => {
    const unified = buildUnified(diffLines);
    const blob = new Blob([unified], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diff.patch";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded diff.patch");
  };

  const toolbar = (
    <>
      <Button
        variant={viewMode === "split" ? "selected" : "outline"}
        size="sm" className="h-8 text-xs"
        onClick={() => setViewMode("split")}
      >
        <Columns2 className="mr-1.5 h-3.5 w-3.5" />
        Side by side
      </Button>
      <Button
        variant={viewMode === "unified" ? "selected" : "outline"}
        size="sm" className="h-8 text-xs"
        onClick={() => setViewMode("unified")}
      >
        <AlignLeft className="mr-1.5 h-3.5 w-3.5" />
        Unified
      </Button>

      <Button
        variant={ignoreWhitespace ? "selected" : "outline"}
        size="sm" className="h-8 text-xs"
        onClick={() => setIgnoreWhitespace((v) => !v)}
      >
        Ignore whitespace
      </Button>

      <Button
        variant={showInline ? "selected" : "outline"}
        size="sm" className="h-8 text-xs"
        onClick={() => setShowInline((v) => !v)}
        title="Highlight changed words within modified lines"
      >
        Inline highlights
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        {hasChanges && (
          <span className="text-xs">
            <span className="text-green-500 font-medium">+{stats.added}</span>
            <span className="mx-1 text-muted-foreground">/</span>
            <span className="text-destructive font-medium">−{stats.removed}</span>
          </span>
        )}
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleLoadSample}>
          Sample
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSwap} disabled={!left && !right}>
          Swap
        </Button>
        {diffLines.length > 0 && (
          <>
            <CopyButton value={buildUnified(diffLines)} size="sm" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleDownload} aria-label="Download patch">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </>
  );

  return (
    <ToolPageLayout
      title="Text & Code Diff"
      description="Compare two texts or code snippets and highlight the differences — runs in your browser"
      toolbar={toolbar}
    >
      <ToolSEO
        title="Text & Code Diff — Free Online Diff Tool"
        description="Compare two texts or code snippets side-by-side or in unified view. Inline word-level highlights on changed lines. Free, browser-only, nothing uploaded."
        canonicalPath="/text-diff"
        keywords={["text diff", "code diff", "online diff tool", "compare text", "file diff", "diff viewer", "side by side diff", "inline diff"]}
      />

      <div className="h-[clamp(400px,calc(100dvh-200px),900px)] flex flex-col gap-3">
        {/* Input area */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 flex-shrink-0" style={{ height: "38%" }}>
          <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Original</span>
              <span className="text-xs text-muted-foreground">{left.split("\n").length} lines</span>
            </div>
            <textarea
              className="flex-1 resize-none bg-card p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              placeholder={"Paste the original text here…"}
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Modified</span>
              <span className="text-xs text-muted-foreground">{right.split("\n").length} lines</span>
            </div>
            <textarea
              className="flex-1 resize-none bg-card p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              value={right}
              onChange={(e) => setRight(e.target.value)}
              placeholder={"Paste the modified text here…"}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Diff output */}
        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {viewMode === "split" ? "Side-by-side diff" : "Unified diff"}
            </span>
            {!left && !right && (
              <span className="text-xs text-muted-foreground">Paste text above to see the diff</span>
            )}
            {left && right && !hasChanges && (
              <span className="text-xs text-green-500 font-medium">No differences</span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {diffLines.length > 0 && viewMode === "unified" && (
              <UnifiedView lines={diffLines} showInline={showInline} />
            )}
            {diffLines.length > 0 && viewMode === "split" && (
              <SplitView lines={diffLines} showInline={showInline} />
            )}
          </div>
        </div>
      </div>

      <AboutTool>
        <p>Compares two pieces of text line by line using the Myers diff algorithm. Added lines are highlighted in green, removed lines in red, and unchanged lines are shown normally.</p>
        <p className="mt-2">Side-by-side view places original and modified text in adjacent columns. When "Inline highlights" is on, changed lines also show word-level highlights — the specific words that differ are marked within each line, making it easy to spot small edits. Unified view shows changes in a single column with <code>+</code> / <code>−</code> prefixes (like <code>git diff</code>). The "Ignore whitespace" option trims leading and trailing spaces before comparison. Everything runs in your browser — text is never uploaded.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

function lineClass(type: DiffLine["type"]): string {
  if (type === "added") return "bg-green-500/10 text-green-400";
  if (type === "removed") return "bg-destructive/10 text-destructive";
  return "text-foreground";
}

function linePrefix(type: DiffLine["type"]): string {
  if (type === "added") return "+";
  if (type === "removed") return "−";
  return " ";
}

function UnifiedView({ lines, showInline }: { lines: DiffLine[]; showInline: boolean }) {
  // Collect pairs for inline diff: a removed line immediately followed by its added counterpart
  const inlineMap = useMemo(() => {
    if (!showInline) return new Map<number, { left: InlinePart[]; right: InlinePart[] }>();
    const map = new Map<number, { left: InlinePart[]; right: InlinePart[] }>();
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].type === "removed" && lines[i + 1].type === "added") {
        const { left, right } = inlineDiff(lines[i].content, lines[i + 1].content);
        map.set(i, { left, right });
        map.set(i + 1, { left: right, right: left }); // store right inline parts at added index
      }
    }
    return map;
  }, [lines, showInline]);

  return (
    <table className="w-full text-xs font-mono border-collapse">
      <tbody>
        {lines.map((line, i) => {
          const inlineParts = inlineMap.get(i);
          return (
            <tr key={i} className={`${lineClass(line.type)}`}>
              <td className="select-none w-8 text-right pr-2 pl-2 text-muted-foreground/60 border-r border-border/20 tabular-nums">
                {line.leftNum ?? ""}
              </td>
              <td className="select-none w-8 text-right pr-2 pl-2 text-muted-foreground/60 border-r border-border/20 tabular-nums">
                {line.rightNum ?? ""}
              </td>
              <td className="select-none w-5 text-center pr-1 font-semibold">
                {linePrefix(line.type)}
              </td>
              <td className="py-0.5 pr-3 pl-1 whitespace-pre-wrap break-all">
                {showInline && inlineParts ? (
                  <InlineText
                    parts={line.type === "removed" ? inlineParts.left : inlineParts.right}
                    side={line.type === "removed" ? "left" : "right"}
                  />
                ) : (
                  line.content
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SplitView({ lines, showInline }: { lines: DiffLine[]; showInline: boolean }) {
  // Build paired rows: match removed with added where possible
  const rows: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i];
    if (cur.type === "equal") {
      rows.push({ left: cur, right: cur });
      i++;
    } else if (cur.type === "removed") {
      let j = i + 1;
      while (j < lines.length && lines[j].type === "removed") j++;
      const addedStart = j;
      let k = j;
      while (k < lines.length && lines[k].type === "added") k++;
      const removedBlock = lines.slice(i, j);
      const addedBlock = lines.slice(addedStart, k);
      const len = Math.max(removedBlock.length, addedBlock.length);
      for (let m = 0; m < len; m++) {
        rows.push({ left: removedBlock[m] ?? null, right: addedBlock[m] ?? null });
      }
      i = k;
    } else {
      rows.push({ left: null, right: cur });
      i++;
    }
  }

  return (
    <table className="w-full text-xs font-mono border-collapse">
      <colgroup>
        <col style={{ width: "32px" }} />
        <col style={{ width: "50%" }} />
        <col style={{ width: "32px" }} />
        <col style={{ width: "50%" }} />
      </colgroup>
      <tbody>
        {rows.map((row, i) => {
          // Compute inline diff when both sides exist and differ
          const canInline = showInline && row.left?.type === "removed" && row.right?.type === "added";
          const { left: leftParts, right: rightParts } = canInline
            ? inlineDiff(row.left!.content, row.right!.content)
            : { left: null, right: null };

          return (
            <tr key={i}>
              <td className={`select-none text-right pr-2 pl-2 text-muted-foreground/60 border-r border-border/20 tabular-nums ${row.left?.type === "removed" ? "bg-destructive/10" : ""}`}>
                {row.left?.leftNum ?? ""}
              </td>
              <td className={`py-0.5 pr-3 pl-1 whitespace-pre-wrap break-all border-r border-border/30 ${row.left ? lineClass(row.left.type) : "bg-card"}`}>
                {row.left ? (
                  canInline && leftParts ? (
                    <InlineText parts={leftParts} side="left" />
                  ) : (
                    row.left.content
                  )
                ) : ""}
              </td>
              <td className={`select-none text-right pr-2 pl-2 text-muted-foreground/60 border-r border-border/20 tabular-nums ${row.right?.type === "added" ? "bg-green-500/10" : ""}`}>
                {row.right?.rightNum ?? ""}
              </td>
              <td className={`py-0.5 pr-3 pl-1 whitespace-pre-wrap break-all ${row.right ? lineClass(row.right.type) : "bg-card"}`}>
                {row.right ? (
                  canInline && rightParts ? (
                    <InlineText parts={rightParts} side="right" />
                  ) : (
                    row.right.content
                  )
                ) : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default TextDiff;
