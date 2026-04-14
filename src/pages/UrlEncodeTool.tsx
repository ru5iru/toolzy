import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Copy, Trash2, ArrowLeftRight, Upload, Clock, Shield, AlertTriangle, Plus, X, Link2, Zap, Code2,
  ChevronDown, BarChart3, FileText, Search, ArrowDown, Keyboard
} from "lucide-react";
import {
  encode, decode, doubleEncode, doubleDecode, detectEncoding, parseQueryParams, buildUrl,
  normalizeUrl, batchProcess, formatBatchOutput, getUnicodeBreakdown, computeDiff,
  validateEncoding, securityScan, getHistory, addToHistory, clearUrlHistory, generateSnippets,
  type EncodingMode, type QueryParam, type HistoryItem, type DetectionResult
} from "@/components/url-encode/urlEncodeUtils";

const UrlEncodeTool = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [encodingMode, setEncodingMode] = useState<EncodingMode>("encodeURIComponent");
  const [liveMode, setLiveMode] = useState(true);
  const [activeTab, setActiveTab] = useState("encode");
  const [batchFormat, setBatchFormat] = useState<"text" | "json" | "csv">("text");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [queryParams, setQueryParams] = useState<QueryParam[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [snippetLang, setSnippetLang] = useState("JavaScript");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null);

  // Load history + URL state
  useEffect(() => {
    setHistory(getHistory());
    const params = new URLSearchParams(window.location.search);
    const inp = params.get("input");
    const mode = params.get("mode");
    if (inp) {
      setInput(inp);
      if (mode === "decode") setActiveTab("decode");
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) handleDecode();
        else handleEncode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, encodingMode]);

  // Live mode processing
  useEffect(() => {
    if (!liveMode || !input.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const det = detectEncoding(input);
      setDetection(det);
      if (activeTab === "encode") {
        setOutput(encode(input, encodingMode));
      } else if (activeTab === "decode") {
        const { result, error } = decode(input);
        setOutput(error ? `Error: ${error}` : result);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, liveMode, activeTab, encodingMode]);

  // Detect on input change
  useEffect(() => {
    if (input.trim()) setDetection(detectEncoding(input));
    else setDetection(null);
  }, [input]);

  const saveHistory = useCallback((inp: string, out: string, mode: "encode" | "decode") => {
    addToHistory({ input: inp.substring(0, 200), output: out.substring(0, 200), mode, encodingMode });
    setHistory(getHistory());
  }, [encodingMode]);

  const handleEncode = useCallback(() => {
    const result = encode(input, encodingMode);
    setOutput(result);
    saveHistory(input, result, "encode");
    toast.success("Encoded");
  }, [input, encodingMode, saveHistory]);

  const handleDecode = useCallback(() => {
    const { result, error } = decode(input);
    if (error) { toast.error(error); setOutput(`Error: ${error}`); return; }
    setOutput(result);
    saveHistory(input, result, "decode");
    toast.success("Decoded");
  }, [input, saveHistory]);

  const handleDoubleEncode = () => {
    const result = doubleEncode(input, encodingMode);
    setOutput(result);
    toast.success("Double encoded");
  };

  const handleDoubleDecode = () => {
    const { result, steps, error } = doubleDecode(input);
    if (error) { toast.error(error); return; }
    setOutput(steps.map((s, i) => `Step ${i}: ${s}`).join("\n"));
    toast.success(`Decoded in ${steps.length - 1} step(s)`);
  };

  const handleNormalize = () => {
    const result = normalizeUrl(input);
    setOutput(result);
    toast.success("URL normalized");
  };

  const handleParseParams = () => {
    const { baseUrl: bu, params } = parseQueryParams(input);
    setBaseUrl(bu);
    setQueryParams(params);
  };

  const handleBuildUrl = () => {
    const url = buildUrl(baseUrl, queryParams);
    setOutput(url);
    setInput(url);
    toast.success("URL rebuilt");
  };

  const addParam = () => setQueryParams([...queryParams, { id: crypto.randomUUID(), key: "", value: "" }]);
  const removeParam = (id: string) => setQueryParams(queryParams.filter((p) => p.id !== id));
  const updateParam = (id: string, field: "key" | "value", val: string) => {
    setQueryParams(queryParams.map((p) => p.id === id ? { ...p, [field]: val } : p));
  };

  const copy = (text: string, label = "Copied") => { navigator.clipboard.writeText(text); toast.success(label); };
  const swap = () => { const tmp = input; setInput(output); setOutput(tmp); };

  const validation = useMemo(() => input.trim() ? validateEncoding(input) : null, [input]);
  const securityWarnings = useMemo(() => input.trim() ? securityScan(input) : [], [input]);
  const unicodeData = useMemo(() => {
    if (!input.trim() || input.length > 200) return [];
    return getUnicodeBreakdown(input);
  }, [input]);
  const diff = useMemo(() => {
    if (!input.trim() || !output.trim() || output.startsWith("Error")) return [];
    return computeDiff(input, output);
  }, [input, output]);

  const snippets = useMemo(() => generateSnippets(input, activeTab === "encode" ? "encode" : "decode"), [input, activeTab]);

  // Batch processing
  const handleBatch = (mode: "encode" | "decode") => {
    const results = batchProcess(input, mode, encodingMode);
    setOutput(formatBatchOutput(results, batchFormat));
    toast.success(`Batch ${mode}d ${results.length} lines`);
  };

  // File drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => { setInput(ev.target?.result as string); toast.success(`Loaded ${file.name}`); };
    reader.readAsText(file);
  };

  // Share URL
  const shareState = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("input", input.substring(0, 2000));
    url.searchParams.set("mode", activeTab);
    navigator.clipboard.writeText(url.toString());
    window.history.replaceState(null, "", url.toString());
    toast.success("Shareable link copied");
  };

  // Copy helpers
  const copyQueryString = () => {
    try {
      const u = new URL(input.startsWith("http") ? input : `https://example.com${input}`);
      copy(u.search, "Query string copied");
    } catch { toast.error("Invalid URL"); }
  };

  const copyPath = () => {
    try {
      const u = new URL(input.startsWith("http") ? input : `https://example.com${input}`);
      copy(u.pathname, "Path copied");
    } catch { toast.error("Invalid URL"); }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <ToolSEO
        title="URL Encoder & Decoder"
        description="Free online URL encoder and decoder with smart detection, query parameter parser, batch processing, Unicode breakdown, diff viewer, and more. Runs 100% in your browser."
        canonicalPath="/url-encode"
        keywords={["URL encoder", "URL decoder", "percent encoding", "encodeURIComponent", "encodeURI", "URL encode online", "query parameter parser", "URL normalization", "RFC 3986"]}
        faq={[
          { question: "What is URL encoding?", answer: "URL encoding (percent-encoding) replaces special characters with a % sign followed by two hex digits, making strings safe for use in URLs per RFC 3986." },
          { question: "Why is space encoded as %20?", answer: "In URLs, spaces are not allowed. The %20 encoding represents a space character using its hexadecimal ASCII value (0x20 = 32 decimal)." },
          { question: "What is the difference between encodeURI and encodeURIComponent?", answer: "encodeURI encodes a full URI, preserving special URL characters like :, /, ?, &, and #. encodeURIComponent encodes everything except letters, digits, and - _ . ~ making it ideal for query parameter values." },
          { question: "What is double encoding and when does it happen?", answer: "Double encoding occurs when an already-encoded string is encoded again, turning %20 into %2520. This commonly happens when encoding is applied twice by mistake in web frameworks." },
          { question: "When should I URL encode?", answer: "Encode query parameters, form data, and any user input included in URLs to prevent parsing errors and injection attacks." },
          { question: "Why does URL decoding fail?", answer: "Decoding fails when the input contains malformed percent-encoded sequences, such as a % not followed by two valid hex digits." },
        ]}
        howToSteps={[
          "Enter text or a URL in the input field",
          "Select the encoding mode (encodeURIComponent, encodeURI, form, or RFC 3986)",
          "Click Encode or Decode, or enable live mode for real-time conversion",
          "Use advanced features like query parser, batch mode, or diff viewer",
          "Click Copy to copy the result to your clipboard",
        ]}
      />

      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-mono font-bold text-foreground">URL Encode / Decode</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Keyboard className="w-3 h-3" />
          <span>Ctrl+Enter: Encode | Ctrl+Shift+Enter: Decode</span>
        </div>
      </div>

      {/* Detection Banner */}
      {detection && input.trim() && (
        <div className="mb-2 p-2 rounded-lg bg-card border border-border flex items-center gap-2 text-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Detected:</span>
          {detection.isDoubleEncoded && <Badge variant="destructive" className="text-[10px] h-5">Double Encoded</Badge>}
          {detection.isPartiallyEncoded && <Badge variant="secondary" className="text-[10px] h-5">Partially Encoded</Badge>}
          {detection.isEncoded && !detection.isDoubleEncoded && !detection.isPartiallyEncoded && <Badge variant="secondary" className="text-[10px] h-5">Encoded</Badge>}
          {!detection.isEncoded && !detection.isPartiallyEncoded && <Badge variant="outline" className="text-[10px] h-5">Plain Text</Badge>}
          <span className="text-muted-foreground">→ {detection.suggestion}</span>
          <span className="text-muted-foreground ml-auto">Confidence: {detection.confidence}%</span>
        </div>
      )}

      {/* Validation / Security Warnings */}
      {((validation && !validation.valid) || securityWarnings.length > 0) && (
        <div className="mb-2 space-y-1">
          {validation && !validation.valid && validation.errors.map((err, i) => (
            <div key={i} className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {err.message}: <code className="font-mono bg-destructive/10 px-1 rounded">{err.char}</code>
            </div>
          ))}
          {securityWarnings.map((w, i) => (
            <div key={i} className="p-2 rounded-lg bg-accent/20 border border-accent/30 flex items-center gap-2 text-xs text-accent-foreground">
              <Shield className="w-3.5 h-3.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 p-2 rounded-lg bg-card border border-border text-xs">
        <Select value={encodingMode} onValueChange={(v) => setEncodingMode(v as EncodingMode)}>
          <SelectTrigger className="w-[180px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="encodeURIComponent">encodeURIComponent</SelectItem>
            <SelectItem value="encodeURI">encodeURI</SelectItem>
            <SelectItem value="form">Form (space → +)</SelectItem>
            <SelectItem value="rfc3986">RFC 3986 Strict</SelectItem>
          </SelectContent>
        </Select>

        <div className="border-l border-border h-5 mx-0.5" />

        <Button size="sm" className="h-7 px-3 text-xs" onClick={handleEncode}>Encode</Button>
        <Button variant="secondary" size="sm" className="h-7 px-3 text-xs" onClick={handleDecode}>Decode</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleDoubleEncode}>2× Encode</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleDoubleDecode}>2× Decode</Button>

        <div className="border-l border-border h-5 mx-0.5" />

        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleNormalize}><Link2 className="w-3 h-3 mr-1" />Normalize</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={swap}><ArrowLeftRight className="w-3 h-3 mr-1" />Swap</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => copy(output)} disabled={!output}><Copy className="w-3 h-3 mr-1" />Copy</Button>

        <div className="border-l border-border h-5 mx-0.5" />

        <div className="flex items-center gap-1">
          <Switch id="live-mode" checked={liveMode} onCheckedChange={setLiveMode} className="scale-75" />
          <Label htmlFor="live-mode" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"><Zap className="w-3 h-3" />Live</Label>
        </div>

        <div className="border-l border-border h-5 mx-0.5" />

        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={shareState} disabled={!input}><Link2 className="w-3 h-3 mr-1" />Share</Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowHistory(!showHistory)}><Clock className="w-3 h-3 mr-1" />History</Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowSnippets(!showSnippets)}><Code2 className="w-3 h-3 mr-1" />Code</Button>

        <div className="ml-auto flex gap-1">
          <input ref={fileRef} type="file" accept=".txt,.csv,.url" onChange={(e) => { if (e.target.files?.[0]) readFile(e.target.files[0]); }} className="hidden" />
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fileRef.current?.click()}><Upload className="w-3 h-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setInput(""); setOutput(""); }}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>

      {/* Copy options bar */}
      {input.trim() && (
        <div className="flex items-center gap-1.5 mb-2 text-xs">
          <span className="text-muted-foreground">Copy:</span>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => copy(output)}>Full Output</Button>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={copyQueryString}>Query String</Button>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={copyPath}>Path Only</Button>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="mb-2 p-3 rounded-lg bg-card border border-border max-h-48 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">History</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => { clearUrlHistory(); setHistory([]); }}>Clear</Button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No history yet</p>
          ) : (
            <div className="space-y-1">
              {history.map((h) => (
                <button key={h.id} onClick={() => { setInput(h.input); setOutput(h.output); }} className="w-full text-left p-1.5 rounded hover:bg-accent/50 text-xs font-mono truncate text-muted-foreground">
                  <Badge variant="outline" className="text-[9px] h-4 mr-1">{h.mode}</Badge>
                  {h.input.substring(0, 60)}…
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Code Snippets */}
      {showSnippets && (
        <div className="mb-2 p-3 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-foreground">Code Snippets</span>
            <div className="flex gap-1">
              {Object.keys(snippets).map((lang) => (
                <Button key={lang} variant={snippetLang === lang ? "default" : "outline"} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setSnippetLang(lang)}>{lang}</Button>
              ))}
            </div>
          </div>
          <div className="relative">
            <pre className="p-2 rounded bg-muted text-xs font-mono overflow-x-auto">{snippets[snippetLang]}</pre>
            <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => copy(snippets[snippetLang], "Snippet copied")}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Panels */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
      <ResizablePanelGroup
        direction="horizontal"
        className="rounded-lg border border-border min-h-[400px]"
      >
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 border-b border-border">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Input</label>
              {dragOver && <Badge variant="secondary" className="text-[10px]">Drop file here</Badge>}
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter text, URL, or encoded string…"
              className="flex-1 min-h-0 font-mono text-sm bg-transparent border-0 resize-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="URL encode/decode input"
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 border-b border-border">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Output</label>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => copy(output)} disabled={!output}><Copy className="w-3 h-3" /></Button>
            </div>
            <Textarea
              value={output}
              readOnly
              className="flex-1 min-h-0 font-mono text-sm bg-transparent border-0 resize-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="URL encode/decode output"
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      </div>

      {/* Tabs for advanced features */}
      <Tabs defaultValue="query-parser" className="mt-4">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-card border border-border p-1">
          <TabsTrigger value="query-parser" className="text-xs h-7">Query Parser</TabsTrigger>
          <TabsTrigger value="batch" className="text-xs h-7">Batch</TabsTrigger>
          <TabsTrigger value="unicode" className="text-xs h-7">Unicode</TabsTrigger>
          <TabsTrigger value="diff" className="text-xs h-7">Diff</TabsTrigger>
          <TabsTrigger value="security" className="text-xs h-7">Security</TabsTrigger>
        </TabsList>

        {/* Query Parser */}
        <TabsContent value="query-parser" className="mt-2">
          <div className="p-3 rounded-lg bg-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleParseParams}>Parse URL</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBuildUrl} disabled={queryParams.length === 0}>Rebuild URL</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addParam}><Plus className="w-3 h-3 mr-1" />Add Param</Button>
            </div>
            {baseUrl && (
              <div className="text-xs">
                <span className="text-muted-foreground">Base URL: </span>
                <code className="font-mono text-foreground bg-muted px-1 rounded">{baseUrl}</code>
              </div>
            )}
            {queryParams.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Key</TableHead>
                    <TableHead className="text-xs h-8">Value</TableHead>
                    <TableHead className="text-xs h-8 w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queryParams.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="p-1">
                        <Input value={p.key} onChange={(e) => updateParam(p.id, "key", e.target.value)} className="h-7 text-xs font-mono" />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input value={p.value} onChange={(e) => updateParam(p.id, "value", e.target.value)} className="h-7 text-xs font-mono" />
                      </TableCell>
                      <TableCell className="p-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeParam(p.id)}><X className="w-3 h-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Batch */}
        <TabsContent value="batch" className="mt-2">
          <div className="p-3 rounded-lg bg-card border border-border space-y-2">
            <p className="text-xs text-muted-foreground">Enter one URL/string per line for batch processing.</p>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => handleBatch("encode")}>Batch Encode</Button>
              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => handleBatch("decode")}>Batch Decode</Button>
              <Select value={batchFormat} onValueChange={(v) => setBatchFormat(v as "text" | "json" | "csv")}>
                <SelectTrigger className="w-[100px] h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Plain Text</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Unicode Breakdown */}
        <TabsContent value="unicode" className="mt-2">
          <div className="p-3 rounded-lg bg-card border border-border">
            {unicodeData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Enter text (≤200 chars) to see Unicode breakdown</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs h-8">Char</TableHead>
                      <TableHead className="text-xs h-8">Code Point</TableHead>
                      <TableHead className="text-xs h-8">UTF-8 Bytes</TableHead>
                      <TableHead className="text-xs h-8">Encoded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unicodeData.slice(0, 50).map((u, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1 font-mono text-lg">{u.char}</TableCell>
                        <TableCell className="p-1 font-mono text-xs">{u.codePoint}</TableCell>
                        <TableCell className="p-1 font-mono text-xs">{u.utf8Bytes.join(" ")}</TableCell>
                        <TableCell className="p-1 font-mono text-xs text-primary">{u.encoded}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Diff */}
        <TabsContent value="diff" className="mt-2">
          <div className="p-3 rounded-lg bg-card border border-border">
            {diff.length === 0 ? (
              <p className="text-xs text-muted-foreground">Encode or decode to see a character diff</p>
            ) : (
              <div className="font-mono text-sm leading-relaxed flex flex-wrap">
                {diff.map((d, i) => (
                  <span key={i} className={
                    d.type === "added" ? "bg-green-500/20 text-green-400" :
                    d.type === "removed" ? "bg-red-500/20 text-red-400 line-through" :
                    "text-muted-foreground"
                  }>{d.char === " " ? "\u00A0" : d.char}</span>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-2">
          <div className="p-3 rounded-lg bg-card border border-border space-y-2">
            {securityWarnings.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Shield className="w-4 h-4" /> No security issues detected
              </div>
            ) : (
              securityWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-accent-foreground">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {w}
                </div>
              ))
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              ⚠ URL encoding is <strong>not</strong> encryption. Never encode sensitive data and assume it's secure.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Educational Content for SEO/AEO/GEO */}
      <section className="mt-8 space-y-4" aria-label="URL encoding reference">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="what-is">
            <AccordionTrigger className="text-sm font-medium">What is URL Encoding?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              <p>URL encoding, also known as percent-encoding, is a mechanism for encoding information in a Uniform Resource Identifier (URI). It replaces unsafe or reserved characters with a <code className="bg-muted px-1 rounded">%</code> followed by two hexadecimal digits representing the character's ASCII/UTF-8 byte value.</p>
              <p className="mt-2">For example, a space character becomes <code className="bg-muted px-1 rounded">%20</code>, and the <code className="bg-muted px-1 rounded">&amp;</code> symbol becomes <code className="bg-muted px-1 rounded">%26</code>. This ensures URLs remain valid and can be safely transmitted across the internet.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="encode-uri-vs-component">
            <AccordionTrigger className="text-sm font-medium">encodeURI vs encodeURIComponent</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              <p><strong>encodeURI()</strong> encodes a complete URI, preserving characters that have special meaning in URLs: <code className="bg-muted px-1 rounded">: / ? # [ ] @ ! $ &amp; ' ( ) * + , ; =</code></p>
              <p className="mt-2"><strong>encodeURIComponent()</strong> encodes individual URI components (like query values), encoding <em>all</em> special characters except <code className="bg-muted px-1 rounded">- _ . ~</code>. Use this for query parameter values.</p>
              <p className="mt-2"><strong>Rule of thumb:</strong> Use <code className="bg-muted px-1 rounded">encodeURIComponent</code> for values, <code className="bg-muted px-1 rounded">encodeURI</code> for full URLs.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="common-mistakes">
            <AccordionTrigger className="text-sm font-medium">Common URL Encoding Mistakes</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Double encoding</strong> — Encoding an already-encoded string turns <code className="bg-muted px-1 rounded">%20</code> into <code className="bg-muted px-1 rounded">%2520</code></li>
                <li><strong>Using encodeURI for query values</strong> — This leaves <code className="bg-muted px-1 rounded">&amp;</code> and <code className="bg-muted px-1 rounded">=</code> unencoded, breaking query strings</li>
                <li><strong>Forgetting UTF-8</strong> — Non-ASCII characters require proper UTF-8 encoding before percent-encoding</li>
                <li><strong>Encoding the entire URL</strong> — Only encode user-provided values, not the URL structure itself</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
};

export default UrlEncodeTool;
