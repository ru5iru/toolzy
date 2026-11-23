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

  const convert = useCallback((text: string, from: Format, to: Format): boolean | null => {
    if (!text.trim()) { setOutput(""); setError(null); return null; }
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
    if (ok === true) toast.success(`Converted ${FORMAT_LABELS[inputFmt]} → ${FORMAT_LABELS[outputFmt]}`);
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
    const prevOutput = output;
    const prevOutputFmt = outputFmt;
    const prevInputFmt = inputFmt;
    setInput(prevOutput);
    setInputFmt(prevOutputFmt);
    setOutputFmt(prevInputFmt);
    setOutput("");
    setError(null);
    convert(prevOutput, prevOutputFmt, prevInputFmt);
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded converted.${ext}`);
  };

  const formats: Format[] = ["yaml", "json", "toml"];

  const FormatToggle = ({ value, onChange, exclude, label }: { value: Format; onChange: (f: Format) => void; exclude?: Format; label: string }) => (
    <div className="flex gap-1 rounded-md border border-border bg-background p-0.5" role="group" aria-label={label}>
      {formats.filter(f => f !== exclude).map(f => (
        <Button
          key={f}
          variant={value === f ? "selected" : "ghost"}
          size="sm"
          className="rounded h-auto px-2.5 py-1 text-xs"
          onClick={() => onChange(f)}
        >
          {FORMAT_LABELS[f]}
        </Button>
      ))}
    </div>
  );

  const toolbar = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Input</span>
        <FormatToggle value={inputFmt} onChange={handleInputFmtChange} exclude={outputFmt} label="Input format" />
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Output</span>
        <FormatToggle value={outputFmt} onChange={handleOutputFmtChange} exclude={inputFmt} label="Output format" />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleLoadSample}>Sample</Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSwap} disabled={!output}>Swap</Button>
        <Button size="sm" className="h-8 text-xs" onClick={handleConvert} disabled={!input.trim()}>Convert</Button>
      </div>
    </>
  );

  return (
    <ToolPageLayout
      title="YAML / JSON / TOML Converter"
      description="Convert between YAML, JSON, and TOML: runs entirely in your browser"
      toolbar={toolbar}
    >
      <ToolSEO
        title="YAML JSON TOML Converter - Free Online Format Converter"
        description="Convert between YAML, JSON, and TOML instantly. Paste any config format and convert it to the other. Free, browser-only, nothing uploaded."
        canonicalPath="/yaml"
        keywords={["yaml to json", "json to yaml", "yaml to toml", "toml to yaml", "toml to json", "config converter", "yaml converter"]}
        faq={[
          { question: "Which format conversions does this tool support?", answer: "The tool converts in all directions between YAML, JSON, and TOML: YAML to JSON, JSON to YAML, YAML to TOML, TOML to YAML, JSON to TOML, and TOML to JSON." },
          { question: "What is YAML used for?", answer: "YAML (YAML Ain't Markup Language) is a human-readable data serialization format widely used for configuration files in tools such as Docker Compose, Kubernetes, Ansible, GitHub Actions, and many CI/CD systems." },
          { question: "What is TOML?", answer: "TOML (Tom's Obvious Minimal Language) is a configuration file format designed to be easy to read and write. It is used by Rust projects (Cargo.toml), Python packaging (pyproject.toml), and Hugo static site generator, among others." },
          { question: "Does this tool send my config data to a server?", answer: "No. All conversion runs entirely in your browser using the js-yaml and @iarna/toml libraries. Your configuration data never leaves your machine." },
          { question: "What happens if my input has a syntax error?", answer: "The tool displays a parse error with the line number and message so you can locate and fix the problem before converting." },
        ]}
        howToSteps={[
          "Select the source format (YAML, JSON, or TOML) from the left panel dropdown.",
          "Paste your configuration into the left panel.",
          "Select the target format from the right panel dropdown.",
          "The converted output appears instantly in the right panel.",
          "Copy the result or download it as a file.",
        ]}
      />

      <div className="h-[clamp(400px,calc(100dvh-210px),900px)]">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border border-border">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{FORMAT_LABELS[inputFmt]}</span>
                <div className="flex items-center gap-2">
                  {input && <span className="text-xs text-muted-foreground">{input.length.toLocaleString()} chars</span>}
                  {input && <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setInput(""); setOutput(""); setError(null); }}>Clear</Button>}
                </div>
              </div>
              <textarea
                className="flex-1 resize-none bg-card p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                aria-label={`${FORMAT_LABELS[inputFmt]} input`}
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
        <p>Converts configuration data between YAML, JSON, and TOML, the three most common structured-data formats for config files, CI pipelines, and package manifests.</p>
        <p className="mt-2">YAML is used by Docker Compose, Kubernetes, GitHub Actions, and Ansible. JSON is standard for REST APIs and <code>package.json</code>. TOML is the native format for Rust's <code>Cargo.toml</code>, Python's <code>pyproject.toml</code>, and Hugo. All conversion is done entirely in your browser with <code>js-yaml</code> and <code>@iarna/toml</code>.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default YamlConverter;
