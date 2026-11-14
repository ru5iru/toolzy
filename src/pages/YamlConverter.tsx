import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { AboutTool } from "@/components/AboutTool";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Download, ArrowRight } from "lucide-react";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import TOML from "@iarna/toml";

type Format = "yaml" | "json" | "toml";

const FORMAT_LABELS: Record<Format, string> = {
  yaml: "YAML",
  json: "JSON",
  toml: "TOML",
};

const SAMPLE: Record<Format, string> = {
  yaml: `name: Toolzy
version: "1.0.0"
features:
  - formatter
  - converter
  - diff
database:
  host: localhost
  port: 5432
  name: app_db
debug: false`,
  json: `{
  "name": "Toolzy",
  "version": "1.0.0",
  "features": ["formatter", "converter", "diff"],
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "app_db"
  },
  "debug": false
}`,
  toml: `name = "Toolzy"
version = "1.0.0"
features = ["formatter", "converter", "diff"]
debug = false

[database]
host = "localhost"
port = 5432
name = "app_db"`,
};

function parseInput(text: string, fmt: Format): any {
  switch (fmt) {
    case "yaml": return yamlLoad(text);
    case "json": return JSON.parse(text);
    case "toml": return TOML.parse(text);
  }
}

function stringify(data: any, fmt: Format): string {
  switch (fmt) {
    case "yaml": return yamlDump(data, { indent: 2, lineWidth: -1 });
    case "json": return JSON.stringify(data, null, 2);
    case "toml": return TOML.stringify(data as any);
  }
}

const YamlConverter = () => {
  const [input, setInput] = useState("");
  const [inputFmt, setInputFmt] = useState<Format>("yaml");
  const [outputFmt, setOutputFmt] = useState<Format>("json");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback((text: string, from: Format, to: Format): boolean => {
    if (!text.trim()) { setOutput(""); setError(null); return true; }
    try {
      const data = parseInput(text, from);
      if (data === undefined || data === null) {
        setOutput(to === "json" ? "null" : "");
        setError(null);
        return true;
      }
      setOutput(stringify(data, to));
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse error");
      setOutput("");
      return false;
    }
  }, []);

  const handleConvert = () => {
    const ok = convert(input, inputFmt, outputFmt);
    if (ok) toast.success(`Converted ${FORMAT_LABELS[inputFmt]} → ${FORMAT_LABELS[outputFmt]}`);
  };

  const handleInputFmtChange = (fmt: Format) => {
    setInputFmt(fmt);
    setOutput("");
    setError(null);
  };

  const handleOutputFmtChange = (fmt: Format) => {
    setOutputFmt(fmt);
    if (input.trim()) convert(input, inputFmt, fmt);
  };

  const handleSwap = () => {
    if (!output) return;
    setInput(output);
    setInputFmt(outputFmt);
    setOutputFmt(inputFmt);
    setOutput("");
    setError(null);
  };

  const handleLoadSample = () => {
    setInput(SAMPLE[inputFmt]);
    convert(SAMPLE[inputFmt], inputFmt, outputFmt);
  };

  const handleDownload = () => {
    if (!output) return;
    const ext = outputFmt === "yaml" ? "yaml" : outputFmt === "toml" ? "toml" : "json";
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded converted.${ext}`);
  };

  const formats: Format[] = ["yaml", "json", "toml"];

  const FormatToggle = ({ value, onChange, exclude }: { value: Format; onChange: (f: Format) => void; exclude?: Format }) => (
    <div className="flex gap-1 rounded-md border border-border bg-background p-0.5">
      {formats.filter(f => f !== exclude).map(f => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${value === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {FORMAT_LABELS[f]}
        </button>
      ))}
    </div>
  );

  return (
    <ToolPageLayout
      title="YAML / JSON / TOML Converter"
      description="Convert between YAML, JSON, and TOML — runs entirely in your browser"
    >
      <ToolSEO
        title="YAML JSON TOML Converter — Free Online Format Converter"
        description="Convert between YAML, JSON, and TOML instantly. Paste any config format and convert it to the other. Free, browser-only, nothing uploaded."
        canonicalPath="/yaml"
        keywords={["yaml to json", "json to yaml", "yaml to toml", "toml to yaml", "toml to json", "config converter", "yaml converter"]}
      />

      {/* Format selector bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Input</span>
          <FormatToggle value={inputFmt} onChange={handleInputFmtChange} />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Output</span>
          <FormatToggle value={outputFmt} onChange={handleOutputFmtChange} />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleLoadSample}>Sample</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSwap} disabled={!output}>Swap</Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleConvert} disabled={!input.trim()}>Convert</Button>
        </div>
      </div>

      <div className="h-[clamp(400px,calc(100dvh-210px),900px)]">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border border-border">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{FORMAT_LABELS[inputFmt]}</span>
                {input && <span className="text-xs text-muted-foreground">{input.length.toLocaleString()} chars</span>}
              </div>
              <textarea
                className="flex-1 resize-none bg-card p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                value={input}
                onChange={(e) => { setInput(e.target.value); convert(e.target.value, inputFmt, outputFmt); }}
                placeholder={`Paste ${FORMAT_LABELS[inputFmt]} here…`}
                spellCheck={false}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{FORMAT_LABELS[outputFmt]}</span>
                <div className="flex items-center gap-1.5">
                  {output && <span className="text-xs text-muted-foreground">{output.length.toLocaleString()} chars</span>}
                  <CopyButton value={output} disabled={!output} size="sm" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} disabled={!output} aria-label="Download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {error ? (
                  <div className="p-3">
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive" role="alert">
                      {error}
                    </p>
                  </div>
                ) : output ? (
                  <pre className="h-full p-3 font-mono text-xs text-foreground whitespace-pre">{output}</pre>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-xs text-muted-foreground">Converted output will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <AboutTool>
        <p>Converts configuration data between YAML, JSON, and TOML — the three most common structured-data formats for config files, CI pipelines, and package manifests.</p>
        <p className="mt-2">YAML is used by Docker Compose, Kubernetes, GitHub Actions, and Ansible. JSON is standard for REST APIs and <code>package.json</code>. TOML is the native format for Rust's <code>Cargo.toml</code>, Python's <code>pyproject.toml</code>, and Hugo. All conversion is done entirely in your browser with <code>js-yaml</code> and <code>@iarna/toml</code>.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default YamlConverter;
