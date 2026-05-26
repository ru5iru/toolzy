import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import {
  Copy, Download, Trash2, ArrowLeftRight, Upload, Clipboard, AlertTriangle,
  Shield, ChevronDown, Plus, X, FileText, Image as ImageIcon, Loader2,
} from "lucide-react";

import {
  encodeText, decodeBase64, decodeToText, encodeFile as encodeFileToB64,
  detectContentType, formatBytes, isValidBase64,
  type DetectedContent,
} from "@/components/base64/base64Utils";
import {
  encode as urlEncode, decode as urlDecode, detectEncoding,
  parseQueryParams, buildUrl, getUnicodeBreakdown, computeDiff,
  securityScan, getHistory as getUrlHistory, addToHistory as addUrlHistory,
  type EncodingMode, type QueryParam, type HistoryItem,
} from "@/components/url-encode/urlEncodeUtils";

type HubMode = "auto" | "base64" | "base64url" | "url" | "dataurl";

const MODE_LABELS: Record<HubMode, string> = {
  auto: "Auto-Detect",
  base64: "Base64",
  base64url: "Base64 URL-Safe",
  url: "URL Encode",
  dataurl: "Data URL",
};

const MIME_SUGGESTIONS = [
  "image/png", "image/jpeg", "image/svg+xml", "image/gif", "image/webp",
  "text/plain", "text/html", "text/css", "application/json", "application/pdf", "font/woff2",
];

const LARGE_INPUT_THRESHOLD = 50 * 1024; // 50 KB

// --- Detection for Auto mode ---
function detectMode(input: string): Exclude<HubMode, "auto"> {
  const t = input.trim();
  if (!t) return "base64";
  if (t.startsWith("data:") && t.includes(",")) return "dataurl";
  if (/%[0-9A-Fa-f]{2}/.test(t)) return "url";
  // Base64 standard: A-Z a-z 0-9 + / =
  if (/^[A-Za-z0-9+/\\s]+=*$/.test(t) && t.replace(/\\s/g, "").length % 4 === 0 && t.length >= 4) {
    return "base64";
  }
  // Base64 URL-safe
  if (/^[A-Za-z0-9_-]+=*$/.test(t) && t.length >= 4) {
    return "base64url";
  }
  // Non-ASCII or spaces → likely raw text needing URL encode
  if (/[^\\x20-\\x7E]/.test(t) || /\\s/.test(t)) return "url";
  return "base64";
}

// --- Base64 URL-safe helpers ---
function toUrlSafe(b64: string) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- Data URL parsing ---
interface DataUrlParts {
  mime: string;
  isBase64: boolean;
  data: string;
  decodedBytes?: Uint8Array;
  decodedText?: string;
  size: number;
}

function parseDataUrl(input: string): DataUrlParts | null {
  const m = input.trim().match(/^data:([^,;]*)?(;[^,]*)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1] || "text/plain";
  const params = m[2] || "";
  const isBase64 = /;base64/i.test(params);
  const data = m[3];
  try {
    if (isBase64) {
      const bytes = decodeBase64(data);
      return { mime, isBase64, data, decodedBytes: bytes, size: bytes.length };
    }
    const text = decodeURIComponent(data);
    return { mime, isBase64, data, decodedText: text, size: new TextEncoder().encode(text).length };
  } catch {
    return { mime, isBase64, data, size: data.length };
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
    "image/svg+xml": "svg", "application/pdf": "pdf", "application/json": "json",
    "text/plain": "txt", "text/html": "html", "text/css": "css", "font/woff2": "woff2",
  };
  return map[mime] || (mime.split("/")[1] || "bin");
}

const EncodingHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get("mode") as HubMode) || "auto";

  const [mode, setMode] = useState<HubMode>(
    ["auto", "base64", "base64url", "url", "dataurl"].includes(initialMode) ? initialMode : "auto"
  );
  const [direction, setDirection] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [detectedSubMode, setDetectedSubMode] = useState<Exclude<HubMode, "auto">>("base64");
  const [detectExplain, setDetectExplain] = useState<string>("");
  const [detectedContent, setDetectedContent] = useState<DetectedContent | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number; type: string } | null>(null);

  // URL mode state
  const [urlSubMode, setUrlSubMode] = useState<EncodingMode>("encodeURIComponent");
  const [queryParams, setQueryParams] = useState<QueryParam[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [batchFormat, setBatchFormat] = useState<"text" | "json" | "csv">("text");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Data URL mode state
  const [dataUrlTab, setDataUrlTab] = useState<"builder" | "decoder">("builder");
  const [dataUrlMime, setDataUrlMime] = useState("text/plain");
  const [dataUrlSource, setDataUrlSource] = useState<"text" | "file">("text");
  const [dataUrlParsed, setDataUrlParsed] = useState<DataUrlParts | null>(null);
  const [dataUrlPreviewBlobUrl, setDataUrlPreviewBlobUrl] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null);
  const dataUrlFileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Persist mode in URL
  useEffect(() => {
    const current = searchParams.get("mode");
    if (current !== mode) {
      const next = new URLSearchParams(searchParams);
      next.set("mode", mode);
      setSearchParams(next, { replace: true });
    }
  }, [mode, searchParams, setSearchParams]);

  // Load history once
  useEffect(() => { setHistory(getUrlHistory()); }, []);

  // Clean up blob URL
  useEffect(() => {
    return () => { if (dataUrlPreviewBlobUrl) URL.revokeObjectURL(dataUrlPreviewBlobUrl); };
  }, [dataUrlPreviewBlobUrl]);

  // --- Core processing ---
  const processNow = useCallback((text: string, hubMode: HubMode, dir: "encode" | "decode") => {
    setError(null);
    setDetectedContent(null);
    if (!text.trim()) { setOutput(""); return; }

    // Resolve effective mode for auto
    let effective: Exclude<HubMode, "auto"> = hubMode === "auto" ? detectMode(text) : hubMode;
    if (hubMode === "auto") {
      setDetectedSubMode(effective);
      // Auto-detect always implies decode for known encoded inputs, encode for plain
      const explanations: Record<Exclude<HubMode, "auto">, string> = {
        base64: "Detected: Base64 encoded string — decoding",
        base64url: "Detected: Base64 URL-safe string — decoding",
        url: "Detected: Percent-encoded URL — decoding",
        dataurl: "Detected: Data URL — decoding",
      };
      // If it looks like plain text we encode instead
      const looksEncoded = effective !== "url" || /%[0-9A-Fa-f]{2}/.test(text);
      const autoDir = looksEncoded || effective === "base64" || effective === "base64url" || effective === "dataurl"
        ? "decode" : "encode";
      dir = autoDir;
      setDetectExplain(autoDir === "decode" ? explanations[effective] : `Detected: plain text — encoding as ${MODE_LABELS[effective]}`);
    } else {
      setDetectExplain("");
    }

    const large = text.length > LARGE_INPUT_THRESHOLD;
    if (large) setProcessing(true);

    const run = () => {
      try {
        if (effective === "base64" || effective === "base64url") {
          const variant = effective === "base64url" ? "url-safe" : "standard";
          if (dir === "encode") {
            setOutput(encodeText(text, "utf-8", variant));
          } else {
            const v = isValidBase64(text);
            if (!v.valid) { setError(v.error || "Invalid Base64"); setOutput(""); return; }
            const bytes = decodeBase64(text);
            const det = detectContentType(bytes);
            setDetectedContent(det);
            if (det.type === "text" || det.type === "json") {
              setOutput(det.type === "json" ? JSON.stringify(det.json, null, 2) : det.text || "");
            } else {
              setOutput(`[${det.mimeType || "binary"} • ${formatBytes(bytes.length)}]`);
            }
          }
        } else if (effective === "url") {
          if (dir === "encode") {
            setOutput(urlEncode(text, urlSubMode));
          } else {
            const r = urlDecode(text);
            if (r.error) { setError(r.error); setOutput(""); return; }
            setOutput(r.result);
          }
          if (dir === "encode" || dir === "decode") {
            addUrlHistory({ input: text.slice(0, 200), output: (output || "").slice(0, 200), mode: dir, encodingMode: urlSubMode });
            setHistory(getUrlHistory());
          }
        } else if (effective === "dataurl") {
          if (dir === "decode") {
            const parsed = parseDataUrl(text);
            if (!parsed) { setError("Not a valid data URL"); setOutput(""); return; }
            setDataUrlParsed(parsed);
            if (parsed.decodedText !== undefined) setOutput(parsed.decodedText);
            else if (parsed.decodedBytes) {
              const det = detectContentType(parsed.decodedBytes);
              setDetectedContent(det);
              if (det.type === "text" || det.type === "json") {
                setOutput(det.type === "json" ? JSON.stringify(det.json, null, 2) : det.text || "");
              } else setOutput(`[${parsed.mime} • ${formatBytes(parsed.size)}]`);
            }
          } else {
            // Build data URL from text
            const b64 = encodeText(text, "utf-8", "standard");
            setOutput(`data:${dataUrlMime};base64,${b64}`);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Processing failed");
        setOutput("");
      } finally {
        if (large) setProcessing(false);
      }
    };

    if (large) {
      // Defer to next tick so the loading state can render. (Pragmatic alternative
      // to a Web Worker for inputs > 50KB — keeps the UI responsive without a
      // separate worker bundle.)
      setTimeout(run, 0);
    } else run();
  }, [urlSubMode, dataUrlMime, output]);

  // Debounced reprocess on input/mode change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => processNow(input, mode, direction), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, mode, direction, urlSubMode, dataUrlMime]);

  // Keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        processNow(input, mode, direction);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input, mode, direction, processNow]);

  // --- Detection panels for URL mode ---
  const detection = useMemo(() => (mode === "url" && input.trim() ? detectEncoding(input) : null), [mode, input]);
  const securityWarnings = useMemo(() => (mode === "url" && input.trim() ? securityScan(input) : []), [mode, input]);
  const unicodeData = useMemo(
    () => (mode === "url" && input.trim() && input.length <= 200 ? getUnicodeBreakdown(input) : []),
    [mode, input]
  );
  const diff = useMemo(
    () => (mode === "url" && input && output && !error ? computeDiff(input, output) : []),
    [mode, input, output, error]
  );

  // --- Actions ---
  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch { toast.error("Clipboard read failed"); }
  };

  const handleDownload = () => {
    if (!output) return;
    let blob: Blob;
    let filename = "output.txt";
    if (mode === "dataurl" && direction === "decode" && dataUrlParsed?.decodedBytes) {
      blob = new Blob([dataUrlParsed.decodedBytes as BlobPart], { type: dataUrlParsed.mime });
      filename = `decoded.${mimeToExt(dataUrlParsed.mime)}`;
    } else if ((mode === "base64" || mode === "base64url") && direction === "decode" && detectedContent?.blobUrl) {
      const a = document.createElement("a");
      a.href = detectedContent.blobUrl;
      a.download = `decoded.${mimeToExt(detectedContent.mimeType || "application/octet-stream")}`;
      a.click();
      return;
    } else {
      blob = new Blob([output], { type: "text/plain" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleClear = () => {
    setInput(""); setOutput(""); setError(null); setDetectedContent(null); setFileMeta(null);
    setDataUrlParsed(null);
  };

  const handleSwap = () => {
    if (!output) return;
    setInput(output);
    setOutput("");
    setDirection((d) => (d === "encode" ? "decode" : "encode"));
  };

  // --- File handling ---
  const handleFile = async (file: File) => {
    setFileMeta({ name: file.name, size: file.size, type: file.type });
    if (mode === "dataurl") {
      const b64 = await encodeFileToB64(file);
      setDataUrlMime(file.type || "application/octet-stream");
      setOutput(`data:${file.type || "application/octet-stream"};base64,${b64}`);
      toast.success(`Encoded ${file.name}`);
      return;
    }
    const b64 = await encodeFileToB64(file);
    const finalB64 = mode === "base64url" ? toUrlSafe(b64) : b64;
    setDirection("encode");
    setInput(`[File: ${file.name} — ${formatBytes(file.size)}]`);
    setOutput(finalB64);
    toast.success(`Encoded ${file.name}`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // --- Query parser actions ---
  const parseQuery = () => {
    const { baseUrl: bu, params } = parseQueryParams(input);
    setBaseUrl(bu); setQueryParams(params);
  };
  const rebuildUrl = () => {
    const url = buildUrl(baseUrl, queryParams);
    setInput(url); setOutput(url);
  };
  const addParam = () => setQueryParams([...queryParams, { id: crypto.randomUUID(), key: "", value: "" }]);
  const removeParam = (id: string) => setQueryParams(queryParams.filter((p) => p.id !== id));
  const updateParam = (id: string, f: "key" | "value", v: string) =>
    setQueryParams(queryParams.map((p) => (p.id === id ? { ...p, [f]: v } : p)));

  const batchProcess = (dir: "encode" | "decode") => {
    const lines = input.split("\\n").filter((l) => l.trim());
    const results = lines.map((line) =>
      dir === "encode" ? urlEncode(line, urlSubMode) : urlDecode(line).result
    );
    if (batchFormat === "json") setOutput(JSON.stringify(results, null, 2));
    else if (batchFormat === "csv") setOutput(results.map((r) => `"${r.replace(/"/g, '""')}"`).join("\\n"));
    else setOutput(results.join("\\n"));
    toast.success(`Batch ${dir}d ${results.length} lines`);
  };

  // --- Render helpers ---
  const outputBadgeText = mode === "auto" ? `${MODE_LABELS[detectedSubMode]} (auto)` : MODE_LABELS[mode];

  return (
    <div className="h-full flex flex-col gap-3 max-w-full">
      <ToolSEO
        title="Encoding Hub — Base64, URL Encode & Data URL Converter"
        description="Free browser-based encoding tool. Encode and decode Base64, URL-safe Base64, percent-encoded URLs, and Data URLs — with auto-detect, file support, and query-string editing. Nothing leaves your browser."
        canonicalPath="/encode"
        keywords={[
          "base64 encoder", "base64 decoder", "url encode", "url decode",
          "percent encoding", "data url", "base64 url safe", "encodeURIComponent",
          "RFC 3986", "query string parser",
        ]}
        faq={[
          { question: "What is the difference between Base64 and URL encoding?", answer: "Base64 converts binary data into a 64-character ASCII alphabet (A-Z, a-z, 0-9, +, /) — used for embedding binary in text. URL encoding (percent-encoding) replaces unsafe URL characters with %HH hex escapes — used for query parameters and paths." },
          { question: "How do I encode a file to Base64?", answer: "Switch to Base64 mode, then drag and drop your file into the input panel — or click Upload. The file's bytes are read entirely in the browser and converted to a Base64 string." },
          { question: "What is URL-safe Base64?", answer: "A Base64 variant that replaces + with - and / with _ and strips = padding, so the output is safe to use in URLs and filenames without any further percent-encoding." },
          { question: "How do I decode a data URL?", answer: "Pick Data URL mode, switch to Decoder, and paste the full data:[mime];base64,[data] string. The tool extracts the MIME type, decodes the payload, and shows an inline preview where possible." },
          { question: "What is the difference between encodeURI and encodeURIComponent?", answer: "encodeURI preserves URL structural characters (: / ? # &), so it's used on a full URL. encodeURIComponent encodes everything except letters, digits, and - _ . ~, so it's used for individual query parameter values." },
        ]}
        howToSteps={[
          "Paste text, a URL, or drop a file into the input panel",
          "Select a mode — Auto-Detect, Base64, Base64 URL-Safe, URL Encode, or Data URL",
          "Toggle Encode or Decode (Auto-Detect routes automatically)",
          "Copy the result or download it as a file",
        ]}
      />

      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-mono font-bold text-foreground">Encoding Hub</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Base64, URL encoding, and Data URL converter — 100% client-side</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs"><Shield className="w-3 h-3" aria-hidden="true" /> Client-side only</Badge>
        </div>
      </header>

      {/* Mode selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Encoding mode">
        {(Object.keys(MODE_LABELS) as HubMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {MODE_LABELS[m]}
            {mode === "auto" && m === "auto" && detectExplain && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-background/20 text-[10px]">
                {MODE_LABELS[detectedSubMode]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Auto-detect explanation */}
      {mode === "auto" && detectExplain && (
        <div className="text-xs text-muted-foreground px-2">{detectExplain}</div>
      )}

      {/* Direction toggle + sub-mode controls */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border text-xs">
        {mode !== "auto" && mode !== "dataurl" && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Direction:</span>
            <Button size="sm" variant={direction === "encode" ? "default" : "outline"} className="h-7 text-xs px-3" onClick={() => setDirection("encode")}>Encode →</Button>
            <Button size="sm" variant={direction === "decode" ? "default" : "outline"} className="h-7 text-xs px-3" onClick={() => setDirection("decode")}>← Decode</Button>
          </div>
        )}

        {mode === "url" && (
          <>
            <div className="w-px h-5 bg-border" />
            <Select value={urlSubMode} onValueChange={(v) => setUrlSubMode(v as EncodingMode)}>
              <SelectTrigger className="h-7 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="encodeURIComponent">encodeURIComponent</SelectItem>
                <SelectItem value="encodeURI">encodeURI</SelectItem>
                <SelectItem value="form">Form (x-www-form-urlencoded)</SelectItem>
                <SelectItem value="rfc3986">RFC 3986 (strict)</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {mode === "dataurl" && (
          <Tabs value={dataUrlTab} onValueChange={(v) => { setDataUrlTab(v as "builder" | "decoder"); setDirection(v === "builder" ? "encode" : "decode"); }}>
            <TabsList className="h-7">
              <TabsTrigger value="builder" className="text-xs h-6">Builder</TabsTrigger>
              <TabsTrigger value="decoder" className="text-xs h-6">Decoder</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          {processing && <><Loader2 className="w-3 h-3 animate-spin" /> Processing…</>}
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-card font-mono">Ctrl+Enter</kbd>
        </div>
      </div>

      {/* Data URL Builder controls */}
      {mode === "dataurl" && dataUrlTab === "builder" && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-card border border-border text-xs">
          <span className="text-muted-foreground">MIME:</span>
          <Input
            list="mime-suggestions"
            value={dataUrlMime}
            onChange={(e) => setDataUrlMime(e.target.value)}
            className="h-7 w-48 text-xs font-mono"
          />
          <datalist id="mime-suggestions">
            {MIME_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>
          <div className="w-px h-5 bg-border" />
          <span className="text-muted-foreground">Source:</span>
          <Button size="sm" variant={dataUrlSource === "text" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setDataUrlSource("text")}>Paste text</Button>
          <Button size="sm" variant={dataUrlSource === "file" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => { setDataUrlSource("file"); dataUrlFileRef.current?.click(); }}>Upload file</Button>
          <input ref={dataUrlFileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Base64 URL-safe note */}
      {mode === "base64url" && (
        <div className="text-[11px] text-muted-foreground px-2">
          URL-safe Base64 replaces <code className="font-mono">+</code> with <code className="font-mono">-</code> and <code className="font-mono">/</code> with <code className="font-mono">_</code> — safe for use in URLs and filenames without percent-encoding.
        </div>
      )}

      {/* Detection / security banners for URL mode */}
      {mode === "url" && detection && input.trim() && (
        <div className="p-2 rounded-lg bg-card border border-border flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Detected:</span>
          {detection.isDoubleEncoded && <Badge variant="destructive" className="text-[10px] h-5">Double Encoded</Badge>}
          {detection.isPartiallyEncoded && <Badge variant="secondary" className="text-[10px] h-5">Partially Encoded</Badge>}
          {detection.isEncoded && !detection.isDoubleEncoded && !detection.isPartiallyEncoded && <Badge variant="secondary" className="text-[10px] h-5">Encoded</Badge>}
          {!detection.isEncoded && <Badge variant="outline" className="text-[10px] h-5">Plain Text</Badge>}
          <span className="text-muted-foreground">→ {detection.suggestion}</span>
        </div>
      )}

      {/* Main split-pane */}
      <div className="flex-1 min-h-[360px]" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border border-border h-full">
          {/* Input panel */}
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Input {direction === "encode" ? "(text / file)" : `(${MODE_LABELS[mode === "auto" ? detectedSubMode : mode]})`}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePaste} aria-label="Paste" title="Paste"><Clipboard className="w-3 h-3" /></Button>
                  {(mode === "base64" || mode === "base64url" || mode === "dataurl") && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fileRef.current?.click()} aria-label="Upload file" title="Upload file"><Upload className="w-3 h-3" /></Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear} aria-label="Clear" title="Clear"><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === "dataurl" && dataUrlTab === "decoder" ? "Paste a data: URL…" :
                  direction === "encode" ? "Paste text or drop a file…" : "Paste encoded string…"
                }
                className={`flex-1 min-h-[200px] font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 ${dragOver ? "bg-primary/5" : "bg-card"} ${error ? "text-destructive" : ""}`}
              />
              {fileMeta && (
                <div className="px-3 py-1 border-t border-border bg-muted/20 text-[10px] text-muted-foreground flex gap-3">
                  <span><FileText className="w-3 h-3 inline mr-1" />{fileMeta.name}</span>
                  <span>{formatBytes(fileMeta.size)}</span>
                  <span>{fileMeta.type || "unknown"}</span>
                </div>
              )}
              <div className="px-3 py-1 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
                {input.length.toLocaleString()} chars
                {dragOver && <span className="ml-2 text-primary">Drop file to encode</span>}
              </div>
              {error && (
                <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />{error}
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Output panel */}
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{outputBadgeText}</Badge>
                  {detectedContent && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{detectedContent.mimeType || detectedContent.type}</Badge>}
                  {dataUrlParsed && mode === "dataurl" && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{dataUrlParsed.mime} • {formatBytes(dataUrlParsed.size)}</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy} disabled={!output} aria-label="Copy output" title="Copy"><Copy className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDownload} disabled={!output} aria-label="Download" title="Download"><Download className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSwap} disabled={!output} aria-label="Swap" title="Swap"><ArrowLeftRight className="w-3 h-3" /></Button>
                </div>
              </div>

              {/* Inline preview */}
              {detectedContent?.type === "image" && detectedContent.imageUrl && (
                <div className="p-2 border-b border-border bg-muted/10 flex justify-center">
                  <img src={detectedContent.imageUrl} alt={`Decoded ${detectedContent.mimeType || "image"} preview`} className="max-h-32 max-w-full rounded border border-border object-contain" />
                </div>
              )}
              {detectedContent?.mimeType === "application/pdf" && (
                <div className="p-2 border-b border-border bg-muted/10 text-xs flex items-center gap-2"><Badge>PDF detected</Badge> — use Download to save</div>
              )}
              {mode === "dataurl" && dataUrlParsed?.mime.startsWith("image/") && (
                <div className="p-2 border-b border-border bg-muted/10 flex justify-center">
                  <img
                    src={`data:${dataUrlParsed.mime};base64,${dataUrlParsed.data}`}
                    alt={`Data URL ${dataUrlParsed.mime} preview`}
                    className="max-h-32 max-w-full rounded border border-border object-contain"
                  />
                </div>
              )}

              <Textarea
                value={output}
                readOnly
                className="flex-1 min-h-[160px] font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-card"
              />
              <div className="px-3 py-1 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
                {output.length.toLocaleString()} chars
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* URL mode advanced panels */}
      {mode === "url" && (
        <div className="space-y-2">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground p-2 rounded-lg bg-card border border-border w-full hover:bg-muted/30">
              <ChevronDown className="w-3 h-3" /> Query-string editor
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 rounded-b-lg bg-card border-x border-b border-border space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={parseQuery}>Parse URL</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={rebuildUrl} disabled={!queryParams.length}>Rebuild</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addParam}><Plus className="w-3 h-3 mr-1" />Add</Button>
              </div>
              {baseUrl && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Base: </span>
                  <code className="font-mono bg-muted px-1 rounded">{baseUrl}</code>
                </div>
              )}
              {queryParams.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs h-8">Key</TableHead>
                      <TableHead className="text-xs h-8">Value</TableHead>
                      <TableHead className="text-xs h-8 w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryParams.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="p-1"><Input value={p.key} onChange={(e) => updateParam(p.id, "key", e.target.value)} className="h-7 text-xs font-mono" /></TableCell>
                        <TableCell className="p-1"><Input value={p.value} onChange={(e) => updateParam(p.id, "value", e.target.value)} className="h-7 text-xs font-mono" /></TableCell>
                        <TableCell className="p-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeParam(p.id)}><X className="w-3 h-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground p-2 rounded-lg bg-card border border-border w-full hover:bg-muted/30">
              <ChevronDown className="w-3 h-3" /> Batch mode
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 rounded-b-lg bg-card border-x border-b border-border space-y-2">
              <p className="text-[11px] text-muted-foreground">Enter one value per line in the input panel.</p>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => batchProcess("encode")}>Batch Encode</Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => batchProcess("decode")}>Batch Decode</Button>
                <Select value={batchFormat} onValueChange={(v) => setBatchFormat(v as "text" | "json" | "csv")}>
                  <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground p-2 rounded-lg bg-card border border-border w-full hover:bg-muted/30">
              <ChevronDown className="w-3 h-3" /> Character breakdown
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 rounded-b-lg bg-card border-x border-b border-border">
              {unicodeData.length === 0 ? (
                <p className="text-xs text-muted-foreground">Enter text (≤200 chars) to see Unicode breakdown.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-8">Char</TableHead>
                        <TableHead className="text-xs h-8">Code Point</TableHead>
                        <TableHead className="text-xs h-8">UTF-8</TableHead>
                        <TableHead className="text-xs h-8">Encoded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unicodeData.slice(0, 60).map((u, i) => (
                        <TableRow key={i}>
                          <TableCell className="p-1 font-mono">{u.char}</TableCell>
                          <TableCell className="p-1 font-mono text-xs">{u.codePoint}</TableCell>
                          <TableCell className="p-1 font-mono text-xs">{u.utf8Bytes.join(" ")}</TableCell>
                          <TableCell className="p-1 font-mono text-xs text-primary">{u.encoded}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground p-2 rounded-lg bg-card border border-border w-full hover:bg-muted/30">
              <ChevronDown className="w-3 h-3" /> Security scanner
              {securityWarnings.length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4">{securityWarnings.length}</Badge>}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 rounded-b-lg bg-card border-x border-b border-border space-y-1">
              {securityWarnings.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-primary"><Shield className="w-4 h-4" /> No issues detected</div>
              ) : securityWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs"><AlertTriangle className="w-3.5 h-3.5 text-destructive" /> {w}</div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground p-2 rounded-lg bg-card border border-border w-full hover:bg-muted/30">
              <ChevronDown className="w-3 h-3" /> Visual diff
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 rounded-b-lg bg-card border-x border-b border-border">
              {diff.length === 0 ? (
                <p className="text-xs text-muted-foreground">Encode/decode to see a character diff.</p>
              ) : (
                <div className="font-mono text-sm flex flex-wrap">
                  {diff.map((d, i) => (
                    <span key={i} className={
                      d.type === "added" ? "bg-primary/20 text-primary" :
                      d.type === "removed" ? "bg-destructive/20 text-destructive line-through" :
                      "text-muted-foreground"
                    }>{d.char === " " ? "\\u00A0" : d.char}</span>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {history.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground p-2 rounded-lg bg-card border border-border w-full hover:bg-muted/30">
                <ChevronDown className="w-3 h-3" /> History ({history.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 rounded-b-lg bg-card border-x border-b border-border space-y-1 max-h-48 overflow-auto">
                {history.slice(0, 10).map((h) => (
                  <button key={h.id} onClick={() => { setInput(h.input); setOutput(h.output); }} className="w-full text-left p-1.5 rounded hover:bg-accent/50 text-xs font-mono truncate text-muted-foreground">
                    <Badge variant="outline" className="text-[9px] h-4 mr-1">{h.mode}</Badge>{h.input.slice(0, 80)}
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      <h2 className="sr-only">Encoding Hub features</h2>
    </div>
  );
};

export default EncodingHub;
