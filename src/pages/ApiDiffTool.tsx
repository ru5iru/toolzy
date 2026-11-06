import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import {
  deepDiff, getDiffSummary, detectFormat, prettify,
  exportAsMarkdown, exportAsJson, loadDiffHistory, saveDiffHistory,
  type DiffEntry, type DiffSummary
} from "@/components/api-diff/diffUtils";
import { ArrowDown, ArrowUp, Copy, Download, History, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";

const colorMap: Record<string, string> = {
  added: "text-[hsl(var(--success-foreground))]", removed: "text-destructive",
  changed: "text-[hsl(var(--warning-foreground))]", type_changed: "text-[hsl(var(--warning-foreground))]"
};
const bgMap: Record<string, string> = {
  added: "bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/20",
  removed: "bg-destructive/10 border-destructive/20",
  changed: "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/20",
  type_changed: "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/20"
};
const labelMap: Record<string, string> = {
  added: "ADDED", removed: "REMOVED", changed: "CHANGED", type_changed: "TYPE CHANGED"
};

const ApiDiffTool = () => {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [summary, setSummary] = useState<DiffSummary | null>(null);
  const [compared, setCompared] = useState(false);
  const [ignoreOrder, setIgnoreOrder] = useState(true);
  const [ignoreRules, setIgnoreRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState("");
  const [viewMode, setViewMode] = useState<"structured" | "inline">("structured");
  const [leftFormat, setLeftFormat] = useState("text");
  const [rightFormat, setRightFormat] = useState("text");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(loadDiffHistory);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");
  const leftRef = useRef<HTMLTextAreaElement>(null);
  const rightRef = useRef<HTMLTextAreaElement>(null);

  // Auto-detect format
  useEffect(() => { setLeftFormat(detectFormat(left)); }, [left]);
  useEffect(() => { setRightFormat(detectFormat(right)); }, [right]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); compare(); }
      if (e.ctrlKey && e.shiftKey && e.key === "F") { e.preventDefault(); handleFormat(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [left, right, ignoreOrder, ignoreRules]);

  const compare = useCallback(() => {
    try {
      const a = JSON.parse(left);
      const b = JSON.parse(right);
      const d = deepDiff(a, b, "", { ignoreOrder, ignoreRules });
      setDiffs(d);
      setSummary(getDiffSummary(d));
      setCompared(true);
      setExpandedPaths(new Set());
      toast.success(d.length === 0 ? "No differences" : `${d.length} difference(s) found`);

      const entry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        leftPreview: left.slice(0, 60),
        rightPreview: right.slice(0, 60),
        diffCount: d.length
      };
      saveDiffHistory(entry);
      setHistory(loadDiffHistory());
    } catch (e: any) {
      toast.error("Invalid JSON: " + e.message);
    }
  }, [left, right, ignoreOrder, ignoreRules]);

  const handleFormat = () => {
    setLeft(prettify(left, leftFormat));
    setRight(prettify(right, rightFormat));
    toast.success("Formatted");
  };

  const handleDrop = (side: "left" | "right") => (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (side === "left") setLeft(text);
      else setRight(text);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handlePaste = (side: "left" | "right") => (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    try {
      const formatted = JSON.stringify(JSON.parse(text), null, 2);
      e.preventDefault();
      if (side === "left") setLeft(formatted);
      else setRight(formatted);
    } catch { /* let default paste happen */ }
  };

  const addIgnoreRule = () => {
    if (newRule.trim() && !ignoreRules.includes(newRule.trim())) {
      setIgnoreRules([...ignoreRules, newRule.trim()]);
      setNewRule("");
    }
  };

  const exportDiff = (format: "json" | "markdown") => {
    const content = format === "json" ? exportAsJson(diffs) : exportAsMarkdown(diffs);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diff-report.${format === "json" ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  const filteredDiffs = searchFilter
    ? diffs.filter(d => d.path.toLowerCase().includes(searchFilter.toLowerCase()))
    : diffs;

  const toggleExpand = (path: string) => {
    const next = new Set(expandedPaths);
    next.has(path) ? next.delete(path) : next.add(path);
    setExpandedPaths(next);
  };

  return (
    <div className="space-y-6">
      <ToolSEO
        title="API Response Diff Tool"
        description="Compare two JSON API responses side-by-side with structural diff, ignore rules, type change detection, and export. Free, browser-only developer tool."
        canonicalPath="/diff"
        keywords={["JSON diff", "API response compare", "JSON compare online", "diff tool", "compare JSON objects", "API testing", "structural diff"]}
        faq={[
          { question: "How to compare two API responses?", answer: "Paste both JSON responses into the left and right panels and click Compare. The tool highlights added, removed, changed, and type-changed fields with color coding." },
          { question: "How to detect breaking API changes?", answer: "Use the structural diff mode to compare JSON schemas. Type changes (e.g., string → number) and removed fields are flagged as potential breaking changes." },
          { question: "Can I ignore specific fields?", answer: "Yes. Add ignore rules like 'timestamp', 'id', or JSON paths like 'data.items[].createdAt' to exclude fields from comparison." },
          { question: "Does this tool send data to a server?", answer: "No. Everything runs 100% in your browser. No data is transmitted anywhere." }
        ]}
        howToSteps={[
          "Paste the first API response in the left panel",
          "Paste the second API response in the right panel",
          "Optionally add ignore rules for fields to skip",
          "Click Compare or press Ctrl+Enter",
          "Review differences in the results panel"
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">API Response Diff</h1>
          <p className="text-sm text-muted-foreground mt-1">Compare JSON responses structurally • Ctrl+Enter to compare</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="h-4 w-4 mr-1" /> History
          </Button>
          <Button variant="ghost" size="sm" onClick={handleFormat}>Format</Button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Recent Comparisons</span>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}><X className="h-3 w-3" /></Button>
          </div>
          {history.map(h => (
            <div key={h.id} className="text-xs text-muted-foreground flex justify-between border-b border-border pb-1">
              <span className="truncate max-w-[200px]">{h.leftPreview}...</span>
              <Badge variant="outline" className="text-[10px]">{h.diffCount} diffs</Badge>
              <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ignore rules */}
      <div className="border border-border rounded-lg p-3 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase">Ignore Rules</span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <input type="checkbox" checked={ignoreOrder} onChange={e => setIgnoreOrder(e.target.checked)} className="accent-primary" />
            Ignore array order
          </label>
        </div>
        <div className="flex gap-2 mb-2">
          <Input
            value={newRule}
            onChange={e => setNewRule(e.target.value)}
            placeholder="e.g. timestamp, data.items[].id, /regex/"
            className="text-xs h-8 font-mono bg-background"
            onKeyDown={e => e.key === "Enter" && addIgnoreRule()}
          />
          <Button size="sm" variant="outline" onClick={addIgnoreRule} className="h-8"><Plus className="h-3 w-3" /></Button>
        </div>
        {ignoreRules.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ignoreRules.map((rule, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] font-mono gap-1">
                {rule}
                <button onClick={() => setIgnoreRules(ignoreRules.filter((_, j) => j !== i))}><X className="h-2.5 w-2.5" /></button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Input panels */}
      <ResizablePanelGroup direction="horizontal" className="border border-border rounded-lg min-h-[350px]">
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
              <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Response A
                <Badge variant="outline" className="text-[10px]">{leftFormat.toUpperCase()}</Badge>
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setLeft("")}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <Textarea
              ref={leftRef}
              value={left}
              onChange={e => setLeft(e.target.value)}
              onPaste={handlePaste("left")}
              onDrop={handleDrop("left")}
              onDragOver={e => e.preventDefault()}
              placeholder='Paste JSON, drag & drop a file, or type here...'
              className="flex-1 font-mono text-sm bg-background border-0 resize-none rounded-none focus-visible:ring-0 min-h-[300px]"
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
              <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Response B
                <Badge variant="outline" className="text-[10px]">{rightFormat.toUpperCase()}</Badge>
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setRight("")}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <Textarea
              ref={rightRef}
              value={right}
              onChange={e => setRight(e.target.value)}
              onPaste={handlePaste("right")}
              onDrop={handleDrop("right")}
              onDragOver={e => e.preventDefault()}
              placeholder='Paste JSON, drag & drop a file, or type here...'
              className="flex-1 font-mono text-sm bg-background border-0 resize-none rounded-none focus-visible:ring-0 min-h-[300px]"
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={compare}>Compare</Button>
        <Button variant="outline" onClick={() => { setLeft(""); setRight(""); setDiffs([]); setSummary(null); setCompared(false); }}>
          <RotateCcw className="h-4 w-4 mr-1" /> Clear
        </Button>
        {compared && diffs.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={() => exportDiff("json")}>
              <Download className="h-3 w-3 mr-1" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportDiff("markdown")}>
              <Download className="h-3 w-3 mr-1" /> Markdown
            </Button>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(exportAsJson(diffs)); toast.success("Copied"); }}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </>
        )}
      </div>

      {/* Summary */}
      {summary && compared && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-[hsl(var(--success-foreground))] font-mono">{summary.added}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Added</div>
          </div>
          <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-destructive font-mono">{summary.removed}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Removed</div>
          </div>
          <div className="border border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-[hsl(var(--warning-foreground))] font-mono">{summary.changed}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Changed</div>
          </div>
          <div className="border border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-[hsl(var(--warning-foreground))] font-mono">{summary.typeChanged}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Type Changed</div>
          </div>
        </div>
      )}

      {/* Results */}
      {compared && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="structured" className="text-xs h-6">Structured</TabsTrigger>
                <TabsTrigger value="inline" className="text-xs h-6">Inline</TabsTrigger>
              </TabsList>
            </Tabs>
            {diffs.length > 0 && (
              <Input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Filter by path..."
                className="h-8 text-xs font-mono max-w-[250px] bg-background"
              />
            )}
          </div>

          {diffs.length === 0 ? (
            <div className="border border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5 rounded-lg p-6 text-center">
              <p className="text-[hsl(var(--success-foreground))] font-mono text-sm">✓ Responses are identical</p>
            </div>
          ) : viewMode === "structured" ? (
            <div className="space-y-2">
              {filteredDiffs.map((d, i) => (
                <div key={i} className={`border rounded-lg p-3 font-mono text-sm ${bgMap[d.type]}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${colorMap[d.type]} border-current`}>
                      {labelMap[d.type]}
                    </Badge>
                    <span className="text-foreground font-medium">{d.path}</span>
                    {d.leftType && d.rightType && (
                      <span className="text-[10px] text-muted-foreground">
                        {d.leftType} → {d.rightType}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {d.left !== undefined && (
                      <div className="text-destructive text-xs flex items-start gap-1">
                        <span className="shrink-0">−</span>
                        <code className="break-all">{d.left}</code>
                      </div>
                    )}
                    {d.right !== undefined && (
                      <div className="text-[hsl(var(--success-foreground))] text-xs flex items-start gap-1">
                        <span className="shrink-0">+</span>
                        <code className="break-all">{d.right}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-auto max-h-[500px]">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-muted-foreground">Path</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Response A</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Response B</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiffs.map((d, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2 text-foreground">{d.path}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${colorMap[d.type]}`}>{labelMap[d.type]}</Badge></td>
                      <td className="px-3 py-2 text-destructive max-w-[200px] truncate">{d.left ?? "—"}</td>
                      <td className="px-3 py-2 text-[hsl(var(--success-foreground))] max-w-[200px] truncate">{d.right ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SEO Content */}
      <section className="mt-12 space-y-8 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">What is an API Response Diff?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            An API Response Diff tool compares two JSON API responses to find structural and value differences.
            It's essential for debugging API changes, detecting breaking changes in REST APIs, and validating
            that API responses match expected formats during development and testing.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Use Cases</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Compare API responses before and after code changes</li>
            <li>Detect breaking changes in third-party APIs</li>
            <li>Validate staging vs production API responses</li>
            <li>Debug unexpected data transformations</li>
            <li>Verify API migration correctness</li>
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Features</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Structural JSON comparison — not just text diff</li>
            <li>Type change detection (string → number, null → missing)</li>
            <li>Customizable ignore rules (field names, JSON paths, regex)</li>
            <li>Export results as JSON or Markdown reports</li>
            <li>Drag & drop file support, auto-format on paste</li>
            <li>100% browser-based — no data leaves your machine</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">FAQ</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">How to compare API responses?</h3>
              <p className="text-sm text-muted-foreground">Paste both JSON responses into the left and right panels and click Compare. Differences are highlighted with color-coded badges showing added, removed, changed, and type-changed fields.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">How to detect breaking API changes?</h3>
              <p className="text-sm text-muted-foreground">Look for "REMOVED" and "TYPE CHANGED" entries in the diff results. Removed fields and type changes typically indicate breaking changes that could affect API consumers.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Can I ignore dynamic fields like timestamps?</h3>
              <p className="text-sm text-muted-foreground">Yes. Add ignore rules like "timestamp", "updatedAt", or use JSON path patterns like "data.items[].createdAt" to exclude specific fields from comparison.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ApiDiffTool;
