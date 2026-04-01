import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, Copy, Minimize2, Maximize2, Upload, Search, X } from "lucide-react";
import { JsonTreeNode } from "@/components/json-formatter/JsonTreeNode";
import { SchemaPanel } from "@/components/json-formatter/SchemaPanel";
import { PrivacyBadge } from "@/components/json-formatter/PrivacyBadge";
import { sortKeysDeep, jsonToXml, jsonToCsv, jsonToYaml, filterJson, downloadFile } from "@/components/json-formatter/jsonUtils";

type IndentOption = "2" | "4" | "tab";

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

  const getIndent = (): string | number => indentOption === "tab" ? "\t" : Number(indentOption);

  const processJson = (raw: string) => {
    const parsed = JSON.parse(raw);
    return sortKeys ? sortKeysDeep(parsed) : parsed;
  };

  const parsedData = useMemo(() => {
    try { return processJson(input); } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sortKeys]);

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
    <div className="max-w-5xl mx-auto">
      <ToolSEO title="JSON Formatter & Validator" description="Free online JSON formatter, validator, and minifier. Paste your JSON to format, beautify, or compress it instantly in your browser." canonicalPath="/json" keywords={["JSON formatter", "JSON validator", "JSON beautifier", "JSON minifier", "format JSON online"]} faq={[{question:"How do I format JSON online?",answer:"Paste your JSON into the input field and click Format. The tool will parse, validate, and pretty-print your JSON with proper indentation."},{question:"Does this JSON formatter send my data to a server?",answer:"No. All JSON formatting and validation happens entirely in your browser — your data never leaves your machine."}]} howToSteps={["Paste your JSON into the input textarea","Click Format to beautify or Minify to compress","Click Copy to copy the result to your clipboard"]} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-mono font-bold text-foreground">JSON Formatter</h1>
        <PrivacyBadge />
      </div>

      {/* Action buttons — moved to top */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-card border border-border">
        <Button onClick={format}>Format</Button>
        <Button variant="secondary" onClick={minify}><Minimize2 className="w-4 h-4 mr-1" /> Minify</Button>
        <Button variant="outline" onClick={copy} disabled={!output}><Copy className="w-4 h-4 mr-1" /> Copy</Button>

        <div className="border-l border-border h-6 mx-1" />

        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="w-3 h-3 mr-1" /> Upload</Button>

        <div className="border-l border-border h-6 mx-1" />

        <Button variant="outline" size="sm" onClick={() => handleDownload("json")} disabled={!input}><Download className="w-3 h-3 mr-1" /> JSON</Button>
        <Button variant="outline" size="sm" onClick={() => handleDownload("xml")} disabled={!input}><Download className="w-3 h-3 mr-1" /> XML</Button>
        <Button variant="outline" size="sm" onClick={() => handleDownload("csv")} disabled={!input}><Download className="w-3 h-3 mr-1" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={() => handleDownload("yaml")} disabled={!input}><Download className="w-3 h-3 mr-1" /> YAML</Button>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Indent</Label>
          <Select value={indentOption} onValueChange={(v) => setIndentOption(v as IndentOption)}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 spaces</SelectItem>
              <SelectItem value="4">4 spaces</SelectItem>
              <SelectItem value="tab">Tabs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="sort-keys" checked={sortKeys} onCheckedChange={setSortKeys} />
          <Label htmlFor="sort-keys" className="text-xs text-muted-foreground cursor-pointer">Sort keys</Label>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="relative flex-1">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search keys & values…"
              className="h-8 text-xs pr-7"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">View</Label>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button onClick={() => setViewMode("text")} className={`px-3 py-1 text-xs transition-colors ${viewMode === "text" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent/10"}`}>Text</button>
            <button onClick={() => setViewMode("tree")} className={`px-3 py-1 text-xs transition-colors ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent/10"}`}>Tree</button>
          </div>
        </div>
      </div>

      {/* Input / Output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Input</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"key": "value"}'
            className="min-h-[400px] font-mono text-sm bg-card border-border resize-none"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Output</label>
            {viewMode === "tree" && parsedData !== null && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={expandAll} className="h-6 px-2 text-xs gap-1"><Maximize2 className="w-3 h-3" /> Expand</Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="h-6 px-2 text-xs gap-1"><Minimize2 className="w-3 h-3" /> Collapse</Button>
              </div>
            )}
          </div>
          {viewMode === "text" ? (
            <Textarea value={output} readOnly className="min-h-[400px] font-mono text-sm bg-card border-border resize-none" />
          ) : (
            <div className="min-h-[400px] bg-card border border-border rounded-md p-3 overflow-auto">
              {filteredData !== null && filteredData !== undefined ? (
                <JsonTreeNode key={treeKey} value={filteredData} defaultExpanded={treeExpanded} searchTerm={searchTerm} />
              ) : (
                <p className="text-sm text-muted-foreground">{input ? "Invalid JSON" : "Paste JSON in the input to see tree view"}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Schema Panel */}
      <div className="mt-4">
        <SchemaPanel parsedData={parsedData} />
      </div>
    </div>
  );
};

export default JsonFormatter;
