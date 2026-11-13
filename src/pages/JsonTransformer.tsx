import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { CopyButton } from "@/components/CopyButton";
import { AboutTool } from "@/components/AboutTool";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Braces } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { runTransform } from "@/lib/jsonTransform";

// ─── Cheat-sheet snippets ─────────────────────────────────────────────────────
const SNIPPETS = [
  { label: "Identity",        filter: "."                              },
  { label: "Pretty",          filter: "."                              },
  { label: "Keys",            filter: "keys"                           },
  { label: "Values",          filter: "values"                         },
  { label: "Length",          filter: "length"                         },
  { label: "Type",            filter: "type"                           },
  { label: ".[0]",            filter: ".[0]"                           },
  { label: ".[]",             filter: ".[]"                            },
  { label: "map(.field)",     filter: "map(.id)"                       },
  { label: "select",          filter: ".[] | select(.active == true)"  },
  { label: "sort_by",         filter: "sort_by(.name)"                 },
  { label: "group_by",        filter: "group_by(.type)"                },
  { label: "unique_by",       filter: "unique_by(.id)"                 },
  { label: "to_entries",      filter: "to_entries"                     },
  { label: "from_entries",    filter: "from_entries"                   },
  { label: "with_entries",    filter: 'with_entries(.value |= tostring)' },
  { label: "keys + values",   filter: "[to_entries[] | {(.key): .value}]" },
  { label: "add",             filter: "[.[] | .score] | add"           },
  { label: "flatten",         filter: "flatten"                        },
  { label: "reverse",         filter: "reverse"                        },
  { label: "unique",          filter: "unique"                         },
  { label: "min / max",       filter: "min, max"                       },
];

const SAMPLE_JSON = JSON.stringify([
  { id: 1, name: "Alice", role: "admin",  active: true,  score: 92 },
  { id: 2, name: "Bob",   role: "user",   active: false, score: 74 },
  { id: 3, name: "Carol", role: "admin",  active: true,  score: 88 },
  { id: 4, name: "Dave",  role: "user",   active: true,  score: 61 },
], null, 2);

const JsonTransformer = () => {
  const [json,          setJson]          = useState(SAMPLE_JSON);
  const [filter,        setFilter]        = useState(".");
  const [indent,        setIndent]        = useState(2);
  const [filterHistory, setFilterHistory] = useState<string[]>([]);
  const lastSavedFilter = useRef<string>("");

  const debouncedJson   = useDebouncedValue(json, 300);
  const debouncedFilter = useDebouncedValue(filter, 300);

  const result = useMemo(
    () => runTransform(debouncedJson, debouncedFilter, indent),
    [debouncedJson, debouncedFilter, indent]
  );

  // JSON validity for input indicator
  const jsonValid = useMemo(() => {
    try { JSON.parse(debouncedJson); return true; } catch { return false; }
  }, [debouncedJson]);

  // Track successful filters in history (deduplicated, most recent first, max 10)
  useEffect(() => {
    const f = debouncedFilter.trim();
    if (!result.error && result.output && f && f !== "." && f !== lastSavedFilter.current) {
      lastSavedFilter.current = f;
      setFilterHistory((prev) => {
        const without = prev.filter((h) => h !== f);
        return [f, ...without].slice(0, 10);
      });
    }
  }, [result, debouncedFilter]);

  const lineCount = (s: string) => s ? s.split("\n").length : 0;

  return (
    <ToolPageLayout
      title="JSON Transformer"
      icon={Braces}
      description="Filter and transform JSON with jq-compatible expressions — all in your browser."
    >
      <ToolSEO
        title="JSON Transformer — jq-style Filter & Transform"
        description="Apply jq-compatible filters to JSON: map, select, sort_by, group_by, to_entries, flatten and more. Live output, no server required."
        canonicalPath="/json-transform"
        keywords={["json transformer", "jq online", "json filter", "json query", "json map", "json select", "jq playground"]}
        faq={[
          { question: "Is this real jq?", answer: "It implements a large compatible subset of jq — path access, pipes, map/select/sort_by/group_by/to_entries/from_entries and many more built-ins. A few advanced features (try-catch, $ENV, recursive descent with ..) are not yet supported." },
          { question: "Does my data leave the browser?", answer: "No. All filtering runs in JavaScript in your browser tab." },
          { question: "How do I filter an array?", answer: ".[] | select(.active == true) iterates the array and keeps only objects where active is true." },
        ]}
        howToSteps={["Paste or edit JSON in the left panel", "Type a jq filter in the filter bar", "View transformed output on the right", "Adjust indent and copy the result"]}
      />

      {/* Filter bar */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs text-muted-foreground font-mono shrink-0">filter</span>
        <Input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 min-w-[200px] font-mono text-sm bg-card border-border"
          placeholder=". | keys"
          spellCheck={false}
        />
        <div className="flex gap-1 items-center shrink-0">
          <span className="text-xs text-muted-foreground">indent</span>
          {[0, 2, 4].map(n => (
            <Button key={n} variant={indent === n ? "selected" : "outline"} size="sm"
              className="h-7 w-8 font-mono text-xs" onClick={() => setIndent(n)}>
              {n === 0 ? "0" : n}
            </Button>
          ))}
        </div>
      </div>

      {/* Snippet chips */}
      <div className="flex flex-wrap gap-1.5">
        {SNIPPETS.map(s => (
          <button
            key={s.label}
            className="px-2 py-0.5 rounded border border-border bg-secondary text-xs font-mono hover:bg-primary/10 hover:border-primary/40 transition-colors"
            onClick={() => setFilter(s.filter)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filter history */}
      {filterHistory.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">History</span>
          {filterHistory.map((h) => (
            <button
              key={h}
              className="px-2 py-0.5 rounded border border-border bg-card text-xs font-mono text-muted-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-foreground transition-colors max-w-[220px] truncate"
              title={h}
              onClick={() => setFilter(h)}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {/* Editor panes */}
      <ResizablePanelGroup direction="horizontal" className="min-h-[400px] rounded-lg border border-border">
        {/* Input */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full">
            <div className={`flex items-center justify-between px-3 py-1.5 border-b border-border text-xs ${jsonValid ? "text-muted-foreground" : "text-destructive bg-destructive/5"}`}>
              <span>Input JSON</span>
              <span>{lineCount(json)} lines</span>
            </div>
            <Textarea
              value={json}
              onChange={e => setJson(e.target.value)}
              className="flex-1 font-mono text-xs resize-none rounded-none border-0 focus-visible:ring-0 bg-card"
              spellCheck={false}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Output */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full">
            <div className={`flex items-center justify-between px-3 py-1.5 border-b border-border text-xs ${result.error ? "text-destructive bg-destructive/5" : "text-muted-foreground"}`}>
              <span>{result.error ? "Error" : "Output"}</span>
              <div className="flex items-center gap-2">
                {!result.error && result.output && (
                  <>
                    <span>{lineCount(result.output)} lines</span>
                    <CopyButton value={result.output} label="" variant="ghost" />
                  </>
                )}
              </div>
            </div>
            <pre className="flex-1 font-mono text-xs p-3 overflow-auto bg-card whitespace-pre-wrap break-all">
              {result.error
                ? <span className="text-destructive">{result.error}</span>
                : result.output || <span className="text-muted-foreground italic">— empty result —</span>
              }
            </pre>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <AboutTool>
        <p>This tool implements a large compatible subset of <a href="https://jqlang.github.io/jq/" target="_blank" rel="noopener" className="underline">jq</a>, the lightweight command-line JSON processor, running entirely in your browser.</p>
        <p className="mt-2">Supported: path access (<code>.foo.bar</code>, <code>.[0]</code>, <code>.[]</code>, slices), pipes (<code>|</code>), comma outputs, comparison and arithmetic operators, <code>map</code>, <code>select</code>, <code>sort_by</code>, <code>group_by</code>, <code>unique_by</code>, <code>to_entries</code> / <code>from_entries</code> / <code>with_entries</code>, <code>add</code>, <code>flatten</code>, <code>has</code>, <code>contains</code>, <code>split</code> / <code>join</code>, <code>test</code>, string functions, and more.</p>
        <p className="mt-2">Not yet supported: <code>try-catch</code>, <code>$ENV</code>, <code>label-break</code>, <code>..</code> recursive descent, and <code>path()</code> expressions.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default JsonTransformer;
