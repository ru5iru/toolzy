import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Download, Copy, Minimize2, Maximize2, Upload, Search, X, Share2, Link } from "lucide-react";
import { JsonTreeNode } from "@/components/json-formatter/JsonTreeNode";
import { SchemaPanel } from "@/components/json-formatter/SchemaPanel";
import { PrivacyBadge } from "@/components/json-formatter/PrivacyBadge";
import { JsonStats } from "@/components/json-formatter/JsonStats";
import { JsonHighlighted } from "@/components/json-formatter/JsonHighlighted";
import { sortKeysDeep, jsonToXml, jsonToCsv, jsonToYaml, filterJson, downloadFile } from "@/components/json-formatter/jsonUtils";

type IndentOption = "2" | "4" | "tab";

const compressToUrl = (json: string): string => {
  try {
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = new URL(window.location.href);
    url.searchParams.set("d", encoded);
    return url.toString();
  } catch {
    return "";
  }
};

const decompressFromUrl = (): string | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("d");
    if (!d) return null;
    return decodeURIComponent(escape(atob(d)));
  } catch {
    return null;
  }
};

const JsonFormatter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indentOption, setIndentOption] = useState<IndentOption>("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "tree">("text");
  const [treeExpanded, setTreeExpanded] = useState(true);
  const [treeKey, setTreeKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from URL on mount
  useEffect(() => {
    const fromUrl = decompressFromUrl();
    if (fromUrl) {
      setInput(fromUrl);
      try {
        setOutput(JSON.stringify(JSON.parse(fromUrl), null, 2));
        toast.success("Loaded JSON from shared link");
      } catch { /* invalid */ }
    }
  }, []);

  const getIndent = (): string | number => indentOption === "tab" ? "\t" : Number(indentOption);

  const processJson = (raw: string) => {
    const parsed = JSON.parse(raw);
    return sortKeys ? sortKeysDeep(parsed) : parsed;
  };

  const debouncedInput = useDebouncedValue(input, 300);

  const parsedData = useMemo(() => {
    try { return processJson(debouncedInput); } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput, sortKeys]);

  const filteredData = useMemo(() => {
    if (!parsedData || !searchTerm) return parsedData;
    return filterJson(parsedData, searchTerm) ?? parsedData;
  }, [parsedData, searchTerm]);

  const format = () => {
    try {
      const data = processJson(input);
      setOutput(JSON.stringify(data, null, getIndent()));
      toast.success("JSON formatted");
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
      toast.error("Invalid JSON");
    }
  };

  const minify = () => {
    try {
      const data = processJson(input);
      setOutput(JSON.stringify(data));
      toast.success("JSON minified");
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
      toast.error("Invalid JSON");
    }
  };

  const copy = () => { navigator.clipboard.writeText(output); toast.success("Copied to clipboard"); };
  const expandAll = () => { setTreeExpanded(true); setTreeKey((k) => k + 1); };
  const collapseAll = () => { setTreeExpanded(false); setTreeKey((k) => k + 1); };

  const shareLink = () => {
    if (!input.trim()) { toast.error("No JSON to share"); return; }
    try {
      JSON.parse(input);
      const url = compressToUrl(input);
      if (url.length > 8000) {
        toast.error("JSON too large for URL sharing. Try a smaller payload.");
        return;
      }
      navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", url);
      toast.success("Shareable link copied to clipboard!");
    } catch {
      toast.error("Fix JSON errors before sharing");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Please upload a .json file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setInput(text);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = (fmt: string) => {
    try {
      const data = processJson(input);
      switch (fmt) {
        case "json": downloadFile(JSON.stringify(data, null, getIndent()), "data.json", "application/json"); break;
        case "xml": downloadFile('<?xml version="1.0" encoding="UTF-8"?>\n' + jsonToXml(data), "data.xml", "application/xml"); break;
        case "csv": downloadFile(jsonToCsv(data), "data.csv", "text/csv"); break;
        case "yaml": downloadFile(jsonToYaml(data), "data.yaml", "text/yaml"); break;
      }
      toast.success(`Downloaded as ${fmt.toUpperCase()}`);
    } catch { toast.error("Invalid JSON — cannot export"); }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <ToolSEO title="JSON Formatter & Validator" description="Free online JSON formatter, validator, and minifier. Paste your JSON to format, beautify, or compress it instantly in your browser." canonicalPath="/json" keywords={["JSON formatter", "JSON validator", "JSON beautifier", "JSON minifier", "format JSON online"]} faq={[{question:"How do I format JSON online?",answer:"Paste your JSON into the input field and click Format. The tool will parse, validate, and pretty-print your JSON with proper indentation."},{question:"Does this JSON formatter send my data to a server?",answer:"No. All JSON formatting and validation happens entirely in your browser — your data never leaves your machine."},{question:"Can I convert JSON to CSV, XML, or YAML?",answer:"Yes. Use the download buttons in the toolbar to export your JSON as CSV, XML, or YAML, or download the formatted JSON file itself."},{question:"What is the JSON tree view?",answer:"Tree view renders your JSON as an interactive, collapsible structure with syntax highlighting, search, and click-to-copy JSONPath for every node."},{question:"Can I share my JSON with someone?",answer:"Yes. Click Share to copy a link with your JSON encoded in the URL — anyone opening the link sees the same data loaded instantly."}]} howToSteps={["Paste your JSON into the input textarea","Click Format to beautify or Minify to compress","Click Copy to copy the result to your clipboard"]} />

      <header className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-mono font-bold text-foreground">JSON Formatter, Validator & Minifier</h1>
        <PrivacyBadge />
      </header>

      {/* Compact toolbar */}
      <h2 className="sr-only">Actions</h2>
      <div role="toolbar" aria-label="JSON formatter actions" className="flex flex-wrap items-center gap-1.5 mb-2 p-2 rounded-lg bg-card border border-border text-xs">
        <Button size="sm" className="h-7 px-3 text-xs" onClick={format}>Format</Button>
        <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={minify}><Minimize2 className="w-3 h-3 mr-1" />Minify</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={copy} disabled={!output} aria-label="Copy output to clipboard"><Copy className="w-3 h-3 mr-1" aria-hidden="true" />Copy</Button>

        <div className="border-l border-border h-5 mx-0.5" />

        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => fileInputRef.current?.click()}><Upload className="w-3 h-3 mr-1" />Upload</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={shareLink} disabled={!input}><Share2 className="w-3 h-3 mr-1" />Share</Button>

        <div className="border-l border-border h-5 mx-0.5" />

        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleDownload("json")} disabled={!input} aria-label="Download as JSON"><Download className="w-3 h-3" aria-hidden="true" /><span className="sr-only">Download JSON</span></Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleDownload("xml")} disabled={!input}>XML</Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleDownload("csv")} disabled={!input}>CSV</Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleDownload("yaml")} disabled={!input}>YAML</Button>

        <div className="border-l border-border h-5 mx-0.5" />

        <Select value={indentOption} onValueChange={(v) => setIndentOption(v as IndentOption)}>
          <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 spaces</SelectItem>
            <SelectItem value="4">4 spaces</SelectItem>
            <SelectItem value="tab">Tabs</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Switch id="sort-keys" checked={sortKeys} onCheckedChange={setSortKeys} className="scale-75" />
          <Label htmlFor="sort-keys" className="text-xs text-muted-foreground cursor-pointer">Sort</Label>
        </div>

        <div className="relative flex-1 min-w-[120px] max-w-[200px]">
          <Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search…"
            className="h-7 text-xs pl-7 pr-6"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex rounded-md border border-border overflow-hidden ml-auto">
          <button onClick={() => setViewMode("text")} className={`px-2 py-0.5 text-xs transition-colors ${viewMode === "text" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent/10"}`}>Text</button>
          <button onClick={() => setViewMode("tree")} className={`px-2 py-0.5 text-xs transition-colors ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent/10"}`}>Tree</button>
        </div>
      </div>

      {/* Stats bar - inline */}
      {parsedData !== null && (
        <div className="mb-2 p-1.5 px-3 rounded-lg bg-card border border-border">
          <JsonStats input={input} parsedData={parsedData} />
        </div>
      )}

      {/* Input / Output — resizable panels */}
      <ResizablePanelGroup direction="horizontal" className="rounded-lg border border-border min-h-[500px]">
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-border">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Input</label>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"key": "value"}'
              className="flex-1 min-h-0 font-mono text-sm bg-transparent border-0 resize-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 border-b border-border">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Output</label>
              {viewMode === "tree" && parsedData !== null && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="h-5 px-1.5 text-[10px] gap-0.5"><Maximize2 className="w-2.5 h-2.5" />Expand</Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="h-5 px-1.5 text-[10px] gap-0.5"><Minimize2 className="w-2.5 h-2.5" />Collapse</Button>
                </div>
              )}
            </div>
            {viewMode === "text" ? (
              output && !output.startsWith("Error:") ? (
                <JsonHighlighted code={output} />
              ) : (
                <Textarea value={output} readOnly placeholder="Formatted output will appear here…" className="flex-1 min-h-0 font-mono text-sm bg-transparent border-0 resize-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              )
            ) : (
              <div className="flex-1 min-h-0 p-3 overflow-auto">
                {filteredData !== null && filteredData !== undefined ? (
                  <JsonTreeNode key={treeKey} value={filteredData} defaultExpanded={treeExpanded} searchTerm={searchTerm} />
                ) : (
                  <p className="text-sm text-muted-foreground">{input ? "Invalid JSON" : "Paste JSON in the input to see tree view"}</p>
                )}
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Schema Panel */}
      <div className="mt-3">
        <SchemaPanel parsedData={parsedData} />
      </div>
    </div>
  );
};

export default JsonFormatter;
