import { useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CopyButton } from "@/components/CopyButton";
import { AboutTool } from "@/components/AboutTool";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Table2, Upload, Download, ArrowUpDown, X } from "lucide-react";

// ─── CSV parsing ─────────────────────────────────────────────────────────────
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0, "|": 0 };
  const sample = text.slice(0, 2000);
  for (const ch of sample) if (ch in counts) counts[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCsv(text: string, delimiter: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if ((c === "\n" || c === "\r") && !inQ) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      lines.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  if (cur) lines.push(cur);

  const splitLine = (line: string) => {
    const cells: string[] = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { cell += '"'; i++; }
        else q = !q;
      } else if (c === delimiter && !q) {
        cells.push(cell); cell = "";
      } else {
        cell += c;
      }
    }
    cells.push(cell);
    return cells;
  };

  const nonEmpty = lines.filter(l => l.trim());
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = splitLine(nonEmpty[0]);
  const rows = nonEmpty.slice(1).map(splitLine);
  return { headers, rows };
}

function toCsv(headers: string[], rows: string[][], delimiter: string): string {
  const esc = (v: string) => v.includes('"') || v.includes(delimiter) || v.includes("\n")
    ? `"${v.replace(/"/g, '""')}"` : v;
  return [headers, ...rows].map(row => row.map(esc).join(delimiter)).join("\n");
}

function toJson(headers: string[], rows: string[][]): string {
  return JSON.stringify(rows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))
  ), null, 2);
}

// ─── Component ───────────────────────────────────────────────────────────────
const CsvTool = () => {
  const [input, setInput] = useState("");
  const [delimOverride, setDelimOverride] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileRef = useRef<HTMLInputElement>(null);

  const detectedDelim = useMemo(() => input ? detectDelimiter(input) : ",", [input]);
  const delimiter = delimOverride ?? detectedDelim;

  const { headers, rows } = useMemo(() => parseCsv(input, delimiter), [input, delimiter]);

  const filtered = useMemo(() => {
    if (!filterText) return rows;
    const q = filterText.toLowerCase();
    return rows.filter(r => r.some(cell => cell.toLowerCase().includes(q)));
  }, [rows, filterText]);

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? ""; const bv = b[sortCol] ?? "";
      const an = parseFloat(av); const bn = parseFloat(bv);
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col: number) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const handleFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setInput(text);
      setDelimOverride(null);
      setFilterText("");
      setSortCol(null);
    };
    reader.readAsText(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const downloadFile = (content: string, name: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  // Column stats
  const colStats = useMemo(() => headers.map((_, ci) => {
    const vals = rows.map(r => r[ci] ?? "").filter(Boolean);
    const nums = vals.map(Number).filter(v => !isNaN(v));
    const unique = new Set(vals).size;
    return { count: vals.length, unique, numericPct: vals.length ? Math.round(nums.length / vals.length * 100) : 0 };
  }), [headers, rows]);

  const csvOut = useMemo(() => headers.length ? toCsv(headers, sorted, delimiter) : "", [headers, sorted, delimiter]);
  const jsonOut = useMemo(() => headers.length ? toJson(headers, sorted) : "", [headers, sorted]);

  return (
    <ToolPageLayout title="CSV Tool" icon={Table2} description="Parse, preview, filter, sort, and export CSV, TSV, and delimited data.">
      <ToolSEO
        title="CSV Tool — Parse, Filter & Export CSV/TSV"
        description="Parse CSV, TSV, and delimited text in your browser. Preview data as a table, filter rows, sort columns, view column stats, and export as CSV or JSON."
        canonicalPath="/csv"
        keywords={["csv viewer", "csv parser", "csv to json", "tsv parser", "csv filter", "csv online tool"]}
        faq={[
          { question: "What delimiters are supported?", answer: "Comma, tab (TSV), semicolon, and pipe. The delimiter is auto-detected from the input, but you can override it." },
          { question: "Can I upload a file?", answer: "Yes. Click the upload area or drag and drop a .csv, .tsv, or .txt file." },
          { question: "Does this send data to a server?", answer: "No. All parsing and processing happens entirely in your browser." },
        ]}
        howToSteps={["Paste CSV text or upload a file", "Preview the table with sorting and filtering", "Export the result as CSV or JSON"]}
      />

      {/* Input area */}
      {!input ? (
        <div
          className="rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors p-8 text-center cursor-pointer space-y-3"
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drop a CSV/TSV file here, or click to browse</p>
          <p className="text-xs text-muted-foreground">or</p>
          <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); }}>Browse file</Button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-muted-foreground">
            {rows.length} rows × {headers.length} cols · detected delimiter:
            <code className="ml-1 font-mono text-foreground">{delimOverride ?? detectedDelim === "\t" ? "tab" : delimOverride ?? detectedDelim}</code>
          </span>
          <div className="flex gap-1 ml-auto flex-wrap">
            {[",", "\t", ";", "|"].map(d => (
              <Button key={d} variant={(delimOverride ?? detectedDelim) === d ? "selected" : "outline"} size="sm"
                className="font-mono h-7 px-2 text-xs"
                onClick={() => setDelimOverride(d)}>
                {d === "\t" ? "tab" : d === "," ? "comma" : d === ";" ? "semi" : "pipe"}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setInput(""); setFilterText(""); setSortCol(null); setDelimOverride(null); }}>
              <X className="w-3 h-3" /> Clear
            </Button>
          </div>
        </div>
      )}

      {!input && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Or paste CSV text</label>
          <textarea
            className="w-full min-h-[160px] rounded-md border border-border bg-card px-3 py-2 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={"name,age,city\nAlice,30,London\nBob,25,Paris"}
            onBlur={e => { if (e.target.value) { setInput(e.target.value); e.target.value = ""; } }}
          />
        </div>
      )}

      {headers.length > 0 && (
        <Tabs defaultValue="table">
          <div className="flex items-center gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="stats">Column Stats</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            <div className="flex gap-2 ml-auto items-center flex-wrap">
              <div className="relative">
                <Input
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder="Filter rows…"
                  className="h-7 text-xs pl-2 w-40 bg-card"
                />
                {filterText && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setFilterText("")}><X className="w-3 h-3" /></button>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => downloadFile(csvOut, "export.csv", "text/csv")}>
                <Download className="w-3 h-3" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => downloadFile(jsonOut, "export.json", "application/json")}>
                <Download className="w-3 h-3" /> JSON
              </Button>
            </div>
          </div>

          {/* Table tab */}
          <TabsContent value="table" className="mt-3">
            {filterText && (
              <p className="text-xs text-muted-foreground mb-2">{sorted.length} of {rows.length} rows match</p>
            )}
            <div className="overflow-auto max-h-[500px] rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-border w-10">#</th>
                    {headers.map((h, ci) => (
                      <th key={ci} className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap">
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(ci)}>
                          {h || <span className="text-muted-foreground/50 italic">col {ci + 1}</span>}
                          <ArrowUpDown className={`w-3 h-3 ${sortCol === ci ? "text-primary" : "opacity-30"}`} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 500).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/40 hover:bg-secondary/40 transition-colors">
                      <td className="px-2 py-1 font-mono text-muted-foreground/60 select-none">{ri + 1}</td>
                      {headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1 font-mono max-w-[200px] truncate" title={row[ci]}>
                          {row[ci] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {sorted.length > 500 && (
                    <tr><td colSpan={headers.length + 1} className="px-2 py-2 text-center text-muted-foreground text-xs italic">
                      Showing first 500 of {sorted.length} rows
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Stats tab */}
          <TabsContent value="stats" className="mt-3">
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-card">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border">Column</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground border-b border-border">Non-empty</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground border-b border-border">Empty</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground border-b border-border">Unique</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground border-b border-border">Numeric %</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, ci) => {
                    const s = colStats[ci];
                    return (
                      <tr key={ci} className="border-b border-border/40 hover:bg-secondary/40">
                        <td className="px-3 py-1.5 font-semibold">{h || <span className="text-muted-foreground italic">col {ci + 1}</span>}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{s.count}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{rows.length - s.count}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{s.unique}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${s.numericPct}%` }} />
                            </div>
                            {s.numericPct}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* JSON tab */}
          <TabsContent value="json" className="mt-3">
            <div className="flex justify-end mb-2 gap-2">
              <CopyButton value={jsonOut} label="Copy JSON" variant="outline" />
              <Button variant="outline" size="sm" className="gap-1 text-xs"
                onClick={() => downloadFile(jsonOut, "export.json", "application/json")}>
                <Download className="w-3 h-3" /> Download
              </Button>
            </div>
            <pre className="rounded-lg border border-border bg-card p-4 font-mono text-xs overflow-auto max-h-[500px] whitespace-pre">
              {jsonOut.slice(0, 100000)}
              {jsonOut.length > 100000 && "\n… (truncated for display)"}
            </pre>
          </TabsContent>
        </Tabs>
      )}

      <AboutTool>
        <p>Paste or upload delimited text — CSV, TSV, semicolon, or pipe-separated — and this tool parses it instantly in your browser. The delimiter is auto-detected but can be overridden.</p>
        <p className="mt-2">Click any column header to sort. Use the filter box to search all columns. The Stats tab shows non-empty counts, unique value counts, and what percentage of values are numeric for each column.</p>
        <p className="mt-2">Export the current view (filtered and sorted) as CSV or JSON. Nothing is sent to any server.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default CsvTool;
