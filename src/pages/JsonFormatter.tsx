import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, Copy, ChevronDown, ChevronRight, Minimize2, Maximize2 } from "lucide-react";

type IndentOption = "2" | "4" | "tab";

const sortKeysDeep = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortKeysDeep(obj[key]);
        return acc;
      }, {});
  }
  return obj;
};

// JSON to XML
const jsonToXml = (obj: any, rootName = "root", indent = 0): string => {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === undefined) return `${pad}<${rootName}/>\n`;
  if (typeof obj !== "object") return `${pad}<${rootName}>${String(obj)}</${rootName}>\n`;
  if (Array.isArray(obj)) {
    return obj.map((item, i) => jsonToXml(item, "item", indent)).join("");
  }
  let xml = `${pad}<${rootName}>\n`;
  for (const key of Object.keys(obj)) {
    xml += jsonToXml(obj[key], key.replace(/[^a-zA-Z0-9_]/g, "_"), indent + 1);
  }
  xml += `${pad}</${rootName}>\n`;
  return xml;
};

// JSON to CSV (flat array of objects)
const jsonToCsv = (data: any): string => {
  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) return "";
  const flatObj = (obj: any, prefix = ""): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (obj[key] !== null && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        Object.assign(result, flatObj(obj[key], path));
      } else {
        result[path] = Array.isArray(obj[key]) ? JSON.stringify(obj[key]) : String(obj[key] ?? "");
      }
    }
    return result;
  };
  const rows = arr.map((item) => flatObj(item));
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n");
};

// JSON to YAML
const jsonToYaml = (obj: any, indent = 0): string => {
  const pad = "  ".repeat(indent);
  if (obj === null) return "null\n";
  if (typeof obj === "boolean") return `${obj}\n`;
  if (typeof obj === "number") return `${obj}\n`;
  if (typeof obj === "string") return obj.includes("\n") ? `|\n${obj.split("\n").map((l) => pad + "  " + l).join("\n")}\n` : `${JSON.stringify(obj)}\n`;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]\n";
    return obj.map((item) => {
      const val = jsonToYaml(item, indent + 1);
      if (typeof item === "object" && item !== null) return `${pad}- ${val.trimStart()}`;
      return `${pad}- ${val}`;
    }).join("");
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}\n";
    return keys.map((key) => {
      const val = obj[key];
      if (typeof val === "object" && val !== null) {
        return `${pad}${key}:\n${jsonToYaml(val, indent + 1)}`;
      }
      return `${pad}${key}: ${jsonToYaml(val, indent + 1)}`;
    }).join("");
  }
  return String(obj) + "\n";
};

// Collapsible tree view
const JsonTreeNode = ({ keyName, value, defaultExpanded }: { keyName?: string; value: any; defaultExpanded: boolean }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (value === null) return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{keyName}: </>}</span><span className="text-orange-400">null</span></div>;
  if (typeof value === "boolean") return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{keyName}: </>}</span><span className="text-yellow-400">{String(value)}</span></div>;
  if (typeof value === "number") return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{keyName}: </>}</span><span className="text-cyan-400">{value}</span></div>;
  if (typeof value === "string") return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{keyName}: </>}</span><span className="text-green-400">"{value}"</span></div>;

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i) => [String(i), v] as [string, any]) : Object.entries(value);
  const bracket = isArray ? ["[", "]"] : ["{", "}"];

  return (
    <div className="pl-4">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 font-mono text-sm hover:bg-accent/30 rounded px-1 -ml-1 transition-colors">
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-muted-foreground">{keyName && <>{keyName}: </>}</span>
        {!expanded && <span className="text-muted-foreground">{bracket[0]} {entries.length} items {bracket[1]}</span>}
        {expanded && <span className="text-muted-foreground">{bracket[0]}</span>}
      </button>
      {expanded && (
        <div>
          {entries.map(([k, v]) => (
            <JsonTreeNode key={k} keyName={isArray ? undefined : k} value={v} defaultExpanded={defaultExpanded} />
          ))}
          <div className="pl-4 font-mono text-sm text-muted-foreground">{bracket[1]}</div>
        </div>
      )}
    </div>
  );
};

const JsonFormatter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indentOption, setIndentOption] = useState<IndentOption>("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "tree">("text");
  const [treeExpanded, setTreeExpanded] = useState(true);
  const [treeKey, setTreeKey] = useState(0); // force re-render tree

  const getIndent = (): string | number => {
    if (indentOption === "tab") return "\t";
    return Number(indentOption);
  };

  const processJson = (raw: string) => {
    const parsed = JSON.parse(raw);
    return sortKeys ? sortKeysDeep(parsed) : parsed;
  };

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

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  };

  const expandAll = () => { setTreeExpanded(true); setTreeKey((k) => k + 1); };
  const collapseAll = () => { setTreeExpanded(false); setTreeKey((k) => k + 1); };

  const parsedTree = useMemo(() => {
    try {
      const data = processJson(input);
      return data;
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sortKeys]);

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = (format: string) => {
    try {
      const data = processJson(input);
      switch (format) {
        case "json":
          downloadFile(JSON.stringify(data, null, getIndent()), "data.json", "application/json");
          break;
        case "xml":
          downloadFile('<?xml version="1.0" encoding="UTF-8"?>\n' + jsonToXml(data), "data.xml", "application/xml");
          break;
        case "csv":
          downloadFile(jsonToCsv(data), "data.csv", "text/csv");
          break;
        case "yaml":
          downloadFile(jsonToYaml(data), "data.yaml", "text/yaml");
          break;
      }
      toast.success(`Downloaded as ${format.toUpperCase()}`);
    } catch (e: any) {
      toast.error("Invalid JSON — cannot export");
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <ToolSEO title="JSON Formatter & Validator" description="Free online JSON formatter, validator, and minifier. Paste your JSON to format, beautify, or compress it instantly in your browser." canonicalPath="/json" keywords={["JSON formatter", "JSON validator", "JSON beautifier", "JSON minifier", "format JSON online"]} faq={[{question:"How do I format JSON online?",answer:"Paste your JSON into the input field and click Format. The tool will parse, validate, and pretty-print your JSON with proper indentation."},{question:"Does this JSON formatter send my data to a server?",answer:"No. All JSON formatting and validation happens entirely in your browser — your data never leaves your machine."}]} howToSteps={["Paste your JSON into the input textarea","Click Format to beautify or Minify to compress","Click Copy to copy the result to your clipboard"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground mb-6">JSON Formatter</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Indent</Label>
          <Select value={indentOption} onValueChange={(v) => setIndentOption(v as IndentOption)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
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

        <div className="flex items-center gap-2 ml-auto">
          <Label className="text-xs text-muted-foreground">View</Label>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button onClick={() => setViewMode("text")} className={`px-3 py-1 text-xs transition-colors ${viewMode === "text" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>Text</button>
            <button onClick={() => setViewMode("tree")} className={`px-3 py-1 text-xs transition-colors ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>Tree</button>
          </div>
        </div>
      </div>

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
            {viewMode === "tree" && parsedTree !== null && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={expandAll} className="h-6 px-2 text-xs gap-1">
                  <Maximize2 className="w-3 h-3" /> Expand
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="h-6 px-2 text-xs gap-1">
                  <Minimize2 className="w-3 h-3" /> Collapse
                </Button>
              </div>
            )}
          </div>
          {viewMode === "text" ? (
            <Textarea
              value={output}
              readOnly
              className="min-h-[400px] font-mono text-sm bg-card border-border resize-none"
            />
          ) : (
            <div className="min-h-[400px] bg-card border border-border rounded-md p-3 overflow-auto">
              {parsedTree !== null ? (
                <JsonTreeNode key={treeKey} value={parsedTree} defaultExpanded={treeExpanded} />
              ) : (
                <p className="text-sm text-muted-foreground">{input ? "Invalid JSON" : "Paste JSON in the input to see tree view"}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button onClick={format}>Format</Button>
        <Button variant="secondary" onClick={minify}><Minimize2 className="w-4 h-4 mr-1" /> Minify</Button>
        <Button variant="outline" onClick={copy} disabled={!output}><Copy className="w-4 h-4 mr-1" /> Copy</Button>

        <div className="border-l border-border mx-1" />

        <Button variant="outline" size="sm" onClick={() => handleDownload("json")} disabled={!input}><Download className="w-3 h-3 mr-1" /> JSON</Button>
        <Button variant="outline" size="sm" onClick={() => handleDownload("xml")} disabled={!input}><Download className="w-3 h-3 mr-1" /> XML</Button>
        <Button variant="outline" size="sm" onClick={() => handleDownload("csv")} disabled={!input}><Download className="w-3 h-3 mr-1" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={() => handleDownload("yaml")} disabled={!input}><Download className="w-3 h-3 mr-1" /> YAML</Button>
      </div>
    </div>
  );
};

export default JsonFormatter;
