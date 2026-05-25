import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Copy, Download, Trash2, ArrowLeftRight, Upload, FileText, Image as ImageIcon, Code2, Clock, Shield, Info, ChevronDown, ChevronUp, Eye, BarChart3, AlertTriangle
} from "lucide-react";
import {
  encodeText, decodeBase64, decodeToText, encodeFile, detectContentType, analyze, formatBytes,
  isValidBase64, autoDetectMode, getHistory, addToHistory, clearHistory, generateCodeSnippets,
  type EncodingType, type Base64Variant, type WrapMode, type DetectedContent, type AnalysisResult, type ConversionHistoryItem
} from "@/components/base64/base64Utils";

const Base64Tool = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [autoMode, setAutoMode] = useState(true);
  const [encoding, setEncoding] = useState<EncodingType>("utf-8");
  const [variant, setVariant] = useState<Base64Variant>("standard");
  const [wrapMode, setWrapMode] = useState<WrapMode>("none");
  const [customWrap, setCustomWrap] = useState(76);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [detectedContent, setDetectedContent] = useState<DetectedContent | null>(null);
  const [history, setHistory] = useState<ConversionHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [snippetLang, setSnippetLang] = useState("javascript");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setHistory(getHistory()); }, []);

  const process = useCallback((text: string, currentMode: "encode" | "decode") => {
    if (!text.trim()) {
      setOutput("");
      setAnalysis(null);
      setDetectedContent(null);
      setError(null);
      return;
    }
    try {
      setError(null);
      if (currentMode === "encode") {
        const result = encodeText(text, encoding, variant, wrapMode, customWrap);
        setOutput(result);
        setAnalysis(analyze(text, result));
        setDetectedContent(null);
      } else {
        const validation = isValidBase64(text);
        if (!validation.valid) {
          setError(validation.error || "Invalid Base64");
          setOutput("");
          return;
        }
        const bytes = decodeBase64(text, encoding);
        const detected = detectContentType(bytes);
        setDetectedContent(detected);
        if (detected.type === "text" || detected.type === "json") {
          const decoded = detected.text || decodeToText(text, encoding);
          setOutput(detected.type === "json" ? JSON.stringify(detected.json, null, 2) : decoded);
        } else {
          setOutput(`[${detected.mimeType || "binary"} data — ${formatBytes(bytes.length)}]`);
        }
        setAnalysis(analyze(text, detected.text || ""));
      }
      addToHistory({
        mode: currentMode,
        inputPreview: text.substring(0, 80),
        outputPreview: (currentMode === "encode" ? encodeText(text, encoding, variant, wrapMode, customWrap) : decodeToText(text, encoding)).substring(0, 80),
        inputSize: new TextEncoder().encode(text).length,
        outputSize: 0,
      });
      setHistory(getHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
      setOutput("");
    }
  }, [encoding, variant, wrapMode, customWrap]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const m = autoMode ? autoDetectMode(value) : mode;
      if (autoMode && m !== mode) setMode(m);
      process(value, m);
    }, 350);
  }, [autoMode, mode, process]);

  const handleFileUpload = async (file: File) => {
    try {
      const b64 = await encodeFile(file);
      const dataUri = `data:${file.type};base64,${b64}`;
      setMode("encode");
      setInput(`[File: ${file.name} — ${formatBytes(file.size)}]`);
      setOutput(b64);
      setAnalysis({ originalSize: file.size, encodedSize: b64.length, percentIncrease: Math.round(((b64.length - file.size) / file.size) * 100) });
      toast.success(`Encoded ${file.name}`);
    } catch { toast.error("Failed to read file"); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
    else {
      const text = e.dataTransfer.getData("text");
      if (text) handleInputChange(text);
    }
  };

  const swap = () => {
    setInput(output);
    setMode(m => m === "encode" ? "decode" : "encode");
    handleInputChange(output);
  };

  const copyOutput = (format: "raw" | "datauri" | "json" = "raw") => {
    let text = output;
    if (format === "datauri") text = `data:text/plain;base64,${output}`;
    if (format === "json") text = JSON.stringify(output);
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const downloadOutput = () => {
    if (detectedContent?.blobUrl) {
      const a = document.createElement("a");
      a.href = detectedContent.blobUrl;
      a.download = `decoded.${detectedContent.mimeType?.split("/")[1] || "bin"}`;
      a.click();
    } else {
      const blob = new Blob([output], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = mode === "encode" ? "encoded.txt" : "decoded.txt";
      a.click();
    }
  };

  const snippets = generateCodeSnippets(input || "Hello World", mode);

  return (
    <div className="h-full flex flex-col gap-3 max-w-full">
      <ToolSEO title="Base64 Encoder & Decoder" description="Professional Base64 encoder and decoder with file support, image preview, and real-time processing. 100% client-side." canonicalPath="/base64" keywords={["Base64 encoder", "Base64 decoder", "Base64 file converter", "Base64 image"]} faq={[{ question: "What is Base64?", answer: "Base64 is a binary-to-text encoding for transmitting data over text-based protocols." }, { question: "Is Base64 encryption?", answer: "No. Base64 is encoding, not encryption. It is easily reversible." }]} howToSteps={["Enter text or upload a file", "Choose encode or decode mode", "Copy or download the result"]} />

      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-mono font-bold text-foreground">Base64 Encoder & Decoder</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs"><Shield className="w-3 h-3" aria-hidden="true" /> Client-side only</Badge>
          <Badge variant="outline" className="gap-1 text-xs"><Info className="w-3 h-3" aria-hidden="true" /> Encoding ≠ Encryption</Badge>
        </div>
      </header>
      <h2 className="sr-only">Conversion settings</h2>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Mode:</span>
          <Button size="sm" variant={mode === "encode" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => { setMode("encode"); setAutoMode(false); process(input, "encode"); }}>Encode</Button>
          <Button size="sm" variant={mode === "decode" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => { setMode("decode"); setAutoMode(false); process(input, "decode"); }}>Decode</Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch checked={autoMode} onCheckedChange={setAutoMode} className="scale-75" />
          <span className="text-muted-foreground">Auto-detect</span>
        </div>
        <div className="w-px h-5 bg-border" />
        <Select value={variant} onValueChange={(v: Base64Variant) => setVariant(v)}>
          <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="url-safe">URL-safe</SelectItem>
          </SelectContent>
        </Select>
        <Select value={encoding} onValueChange={(v: EncodingType) => setEncoding(v)}>
          <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="utf-8">UTF-8</SelectItem>
            <SelectItem value="ascii">ASCII</SelectItem>
            <SelectItem value="utf-16">UTF-16</SelectItem>
          </SelectContent>
        </Select>
        <Select value={wrapMode} onValueChange={(v: WrapMode) => setWrapMode(v)}>
          <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No wrap</SelectItem>
            <SelectItem value="mime">MIME (76)</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {wrapMode === "custom" && <Input type="number" value={customWrap} onChange={e => setCustomWrap(Number(e.target.value))} className="h-7 w-16 text-xs" />}
      </div>

      {/* Main panels */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border border-border">
          {/* Input */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Input {mode === "encode" ? "(Text/File)" : "(Base64)"}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fileRef.current?.click()} aria-label="Upload file" title="Upload file"><Upload className="w-3 h-3" aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setInput(""); setOutput(""); setError(null); setDetectedContent(null); setAnalysis(null); }} aria-label="Clear input" title="Clear"><Trash2 className="w-3 h-3" aria-hidden="true" /></Button>
                </div>
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              <Textarea
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                placeholder={mode === "encode" ? "Paste text, drop a file, or upload..." : "Paste Base64 string..."}
                className={`flex-1 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 ${dragOver ? "bg-primary/5" : "bg-card"} ${error ? "text-destructive" : ""}`}
              />
              {error && <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</div>}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Output */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output</span>
                  {detectedContent && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{detectedContent.type}{detectedContent.mimeType ? ` • ${detectedContent.mimeType}` : ""}</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyOutput("raw")} disabled={!output} title="Copy"><Copy className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadOutput} disabled={!output} title="Download"><Download className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={swap} disabled={!output} title="Swap"><ArrowLeftRight className="w-3 h-3" /></Button>
                </div>
              </div>

              {/* Image preview */}
              {detectedContent?.type === "image" && detectedContent.imageUrl && (
                <div className="p-3 border-b border-border bg-muted/10 flex flex-col items-center gap-2">
                  <img src={detectedContent.imageUrl} alt={`Base64 decoded image preview${detectedContent.mimeType ? ` (${detectedContent.mimeType})` : ""}`} className="max-h-40 max-w-full rounded border border-border object-contain" />
                  <span className="text-[10px] text-muted-foreground">{detectedContent.mimeType}</span>
                </div>
              )}

              <Textarea
                value={output}
                readOnly
                className={`flex-1 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-card ${detectedContent?.type === "json" ? "text-emerald-400" : ""}`}
              />

              {/* Copy format bar */}
              {output && (
                <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border bg-muted/20">
                  <span className="text-[10px] text-muted-foreground mr-1">Copy as:</span>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => copyOutput("raw")}>Raw</Button>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => copyOutput("datauri")}>Data URI</Button>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => copyOutput("json")}>JSON String</Button>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Analysis */}
        {analysis && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><BarChart3 className="w-3 h-3" /> Analysis</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-sm font-mono font-bold text-foreground">{formatBytes(analysis.originalSize)}</div><div className="text-[10px] text-muted-foreground">Original</div></div>
              <div><div className="text-sm font-mono font-bold text-foreground">{formatBytes(analysis.encodedSize)}</div><div className="text-[10px] text-muted-foreground">Encoded</div></div>
              <div><div className={`text-sm font-mono font-bold ${analysis.percentIncrease > 0 ? "text-amber-500" : "text-emerald-500"}`}>{analysis.percentIncrease > 0 ? "+" : ""}{analysis.percentIncrease}%</div><div className="text-[10px] text-muted-foreground">Change</div></div>
            </div>
          </div>
        )}

        {/* Code snippets toggle */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1.5">
          <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground w-full" onClick={() => setShowSnippets(!showSnippets)}>
            <Code2 className="w-3 h-3" /> Code Snippets {showSnippets ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showSnippets && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {(["javascript", "php", "python", "java"] as const).map(l => (
                  <button key={l} onClick={() => setSnippetLang(l)} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${snippetLang === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{l}</button>
                ))}
              </div>
              <pre className="bg-muted/50 border border-border rounded p-2 font-mono text-[11px] overflow-auto max-h-24">{snippets[snippetLang as keyof typeof snippets]}</pre>
              <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => { navigator.clipboard.writeText(snippets[snippetLang as keyof typeof snippets]); toast.success("Copied"); }}><Copy className="w-2.5 h-2.5 mr-1" />Copy</Button>
            </div>
          )}
        </div>

        {/* History */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1.5">
          <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground w-full" onClick={() => setShowHistory(!showHistory)}>
            <Clock className="w-3 h-3" /> History ({history.length}) {showHistory ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showHistory && (
            <div className="space-y-1">
              {history.length === 0 && <p className="text-[10px] text-muted-foreground">No history yet</p>}
              {history.slice(0, 5).map(item => (
                <button key={item.id} onClick={() => { setInput(item.inputPreview); setMode(item.mode); process(item.inputPreview, item.mode); }} className="w-full text-left p-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1">{item.mode}</Badge>
                    <span className="text-[9px] text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] font-mono text-foreground truncate mt-0.5">{item.inputPreview}</p>
                </button>
              ))}
              {history.length > 0 && <Button variant="ghost" size="sm" className="h-5 text-[10px] w-full" onClick={() => { clearHistory(); setHistory([]); toast.success("History cleared"); }}><Trash2 className="w-2.5 h-2.5 mr-1" />Clear</Button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Base64Tool;
