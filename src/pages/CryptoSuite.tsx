import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import {
  generateV1, generateV4, generateV3, generateV5,
  formatUUID, validateUUID, decodeV1,
  NAMESPACES, CODE_SNIPPETS,
  loadUUIDHistory, saveUUIDHistory,
  type UUIDValidation
} from "@/components/uuid/uuidUtils";
import {
  Check, ChevronDown, Copy, Download, Eye, EyeOff, History, RotateCcw, Upload, X, KeyRound, FileText
} from "lucide-react";
import HashWorker from "@/workers/hashWorker?worker";
import UuidWorker from "@/workers/uuidWorker?worker";

// ---------- Hash helpers ----------
type HashAlgo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
const ALL_ALGOS: HashAlgo[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
type OutputFmt = "hex" | "HEX" | "b64" | "b64u";

function bufToHex(buf: ArrayBuffer, upper = false) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return upper ? s.toUpperCase() : s;
}
function bufToB64(buf: ArrayBuffer, urlSafe = false) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return urlSafe ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}
function formatDigest(buf: ArrayBuffer, fmt: OutputFmt) {
  switch (fmt) {
    case "hex": return bufToHex(buf, false);
    case "HEX": return bufToHex(buf, true);
    case "b64": return bufToB64(buf, false);
    case "b64u": return bufToB64(buf, true);
  }
}
function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length === 0 || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function constantTimeCompare(a: string, b: string): { match: boolean; diffs: number[] } {
  const max = Math.max(a.length, b.length);
  const diffs: number[] = [];
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < max; i++) {
    const same = i < a.length && i < b.length && a.charCodeAt(i) === b.charCodeAt(i);
    if (!same) { diffs.push(i); mismatch |= 1; }
  }
  return { match: mismatch === 0, diffs };
}

// ---------- Hash history ----------
const HASH_HISTORY_KEY = "toolzy_hash_history";
const HASH_VISIBLE_KEY = "toolzy_hash_visible_algos";
type HashHistoryEntry = { snippet: string; sha256: string; at: number };
function loadHashHistory(): HashHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HASH_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHashHistory(e: HashHistoryEntry) {
  const h = loadHashHistory();
  if (h[0]?.sha256 === e.sha256) return;
  h.unshift(e);
  localStorage.setItem(HASH_HISTORY_KEY, JSON.stringify(h.slice(0, 10)));
}

// ---------- Page ----------
type Version = "v1" | "v4" | "v3" | "v5";
type ExportFormat = "txt" | "csv" | "json" | "sql";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const MAX_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

const CryptoSuite = () => {
  const [params, setParams] = useSearchParams();
  const initialTab = params.get("tab") === "uuid" ? "uuid" : "hash";
  const [tab, setTab] = useState<"hash" | "uuid">(initialTab);
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-6">
      <ToolSEO
        title="Crypto Suite — Hash Generator & UUID Generator"
        description="Free browser-based cryptography tools. Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes with HMAC support, and create UUID v1/v3/v4/v5 tokens in bulk — all via the native Web Crypto API, nothing leaves your browser."
        canonicalPath="/crypto"
        keywords={["sha256 generator", "sha512 hash", "hmac generator", "hash file", "uuid generator", "uuid v4", "uuid v5", "bulk uuid", "crypto subtle", "web crypto api", "hash calculator", "uuid validator"]}
        faq={[
          { question: "What is the difference between SHA-256 and SHA-512?", answer: "Both are SHA-2 family hashes. SHA-256 produces a 256-bit (32-byte) digest and is faster on 32-bit hardware; SHA-512 produces a 512-bit (64-byte) digest and is generally faster on 64-bit hardware. SHA-512 offers a larger security margin against brute-force attacks." },
          { question: "What is HMAC and when should I use it?", answer: "HMAC (Hash-based Message Authentication Code) combines a cryptographic hash with a secret key to produce a tag that proves both integrity and authenticity. Use it whenever you need to verify a message came from a party that knows the shared secret — e.g. signing API requests or webhook payloads." },
          { question: "Is it safe to hash files in the browser?", answer: "Yes. All hashing in Crypto Suite happens locally via the Web Crypto API (crypto.subtle.digest). The file bytes never leave your machine and no network requests are made." },
          { question: "What is the difference between UUID v4 and v5?", answer: "v4 is fully random (122 bits of entropy from crypto.getRandomValues). v5 is deterministic: it derives the UUID from a namespace UUID plus a name string using SHA-1, so the same inputs always yield the same UUID — useful for stable IDs derived from URLs, DNS names, or other natural keys." },
          { question: "How do I generate cryptographically secure UUIDs?", answer: "Use v4. Crypto Suite uses crypto.getRandomValues (or crypto.randomUUID when available), the browser's CSPRNG, which is suitable for security-sensitive identifiers." },
          { question: "Why is MD5 not supported?", answer: "MD5 is cryptographically broken — practical collisions can be generated in seconds. The Web Crypto API deliberately omits it. We only expose it indirectly inside UUID v3 generation, where collision resistance is not a security requirement." },
        ]}
        howToSteps={[
          "Hashing: paste text, drop a file, or enter a hex string in the Hashing tab",
          "Hashing: pick the algorithms and output format you need",
          "Hashing: click any result to copy it",
          "UUID: pick a version (v1, v3, v4, or v5) in the UUID Generator tab",
          "UUID: set the quantity (1–10,000) and generate",
          "UUID: copy individual UUIDs or export the batch as CSV/JSON/SQL/TXT",
        ]}
      />

      <header className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-primary" aria-hidden />
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Crypto Suite</h1>
          <p className="text-sm text-muted-foreground">Hashing &amp; UUID generation — 100% browser-side</p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "hash" | "uuid")} className="space-y-6">
        <TabsList>
          <TabsTrigger value="hash">Hashing</TabsTrigger>
          <TabsTrigger value="uuid">UUID Generator</TabsTrigger>
        </TabsList>
        <TabsContent value="hash" forceMount className={tab === "hash" ? "space-y-6" : "hidden"}>
          <HashTab />
        </TabsContent>
        <TabsContent value="uuid" forceMount className={tab === "uuid" ? "space-y-6" : "hidden"}>
          <UuidTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ===================================================================
// HASH TAB
// ===================================================================
function HashTab() {
  const [mode, setMode] = useState<"text" | "file" | "hex">("text");
  const [text, setText] = useState("");
  const [hex, setHex] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [visible, setVisible] = useState<HashAlgo[]>(() => {
    try {
      const raw = localStorage.getItem(HASH_VISIBLE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.filter((a) => ALL_ALGOS.includes(a));
      }
    } catch { /* ignore */ }
    return [...ALL_ALGOS];
  });
  useEffect(() => {
    localStorage.setItem(HASH_VISIBLE_KEY, JSON.stringify(visible));
  }, [visible]);

  const [outFmt, setOutFmt] = useState<OutputFmt>("hex");
  const [hmac, setHmac] = useState(false);
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [results, setResults] = useState<Record<string, ArrayBuffer>>({});
  const [progress, setProgress] = useState<{ pct: number | null; label: string } | null>(null);
  const [hexError, setHexError] = useState<string | null>(null);

  const [history, setHistory] = useState<HashHistoryEntry[]>(loadHashHistory);
  const [showHistory, setShowHistory] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);

  // Determine bytes for current mode (non-file)
  const getInlineBytes = useCallback((): { bytes: Uint8Array | null; err: string | null } => {
    if (mode === "text") {
      return { bytes: new TextEncoder().encode(text), err: null };
    }
    if (mode === "hex") {
      if (!hex.trim()) return { bytes: new Uint8Array(0), err: null };
      const b = hexToBytes(hex);
      if (!b) return { bytes: null, err: "Invalid hex input" };
      return { bytes: b, err: null };
    }
    return { bytes: null, err: null };
  }, [mode, text, hex]);

  const algosToRun = useMemo<HashAlgo[]>(() => {
    if (hmac) return visible.filter((a) => a !== "SHA-1");
    return visible;
  }, [visible, hmac]);

  const computeInline = useCallback(async () => {
    const r: Record<string, ArrayBuffer> = {};
    if (mode === "file") return; // handled separately
    const { bytes, err } = getInlineBytes();
    setHexError(err);
    if (err || !bytes) { setResults({}); return; }
    if (mode !== "hex" && mode !== "text") return;

    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    if (hmac) {
      if (!secret) { setResults({}); return; }
      const keyBytes = new TextEncoder().encode(secret);
      const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
      for (const algo of algosToRun) {
        const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: algo }, false, ["sign"]);
        r[algo] = await crypto.subtle.sign("HMAC", key, data);
      }
    } else {
      for (const algo of algosToRun) {
        r[algo] = await crypto.subtle.digest(algo, data);
      }
    }
    setResults(r);
    if (!hmac && r["SHA-256"]) {
      const snippet = mode === "text" ? text.slice(0, 64) : hex.slice(0, 64);
      if (snippet) {
        saveHashHistory({ snippet, sha256: bufToHex(r["SHA-256"]), at: Date.now() });
        setHistory(loadHashHistory());
      }
    }
  }, [mode, getInlineBytes, hmac, secret, algosToRun, text, hex]);

  // debounced compute on input
  useEffect(() => {
    if (mode === "file") return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void computeInline(); }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [computeInline, mode]);

  // File handling
  const hashFile = useCallback(async (f: File) => {
    setFile(f);
    setResults({});
    const useWorker = f.size > 5 * 1024 * 1024;
    setProgress({ pct: useWorker ? 0 : null, label: `Hashing ${f.name}…` });

    if (!useWorker) {
      const buf = await f.arrayBuffer();
      const r: Record<string, ArrayBuffer> = {};
      if (hmac) {
        if (!secret) { setProgress(null); return; }
        const kb = new TextEncoder().encode(secret);
        const keyBuf = kb.buffer.slice(kb.byteOffset, kb.byteOffset + kb.byteLength) as ArrayBuffer;
        for (const algo of algosToRun) {
          const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: algo }, false, ["sign"]);
          r[algo] = await crypto.subtle.sign("HMAC", key, buf);
        }
      } else {
        for (const algo of algosToRun) r[algo] = await crypto.subtle.digest(algo, buf);
      }
      setResults(r);
      setProgress(null);
      return;
    }

    if (!workerRef.current) workerRef.current = new HashWorker();
    const worker = workerRef.current;
    const id = ++reqIdRef.current;
    const buf = await f.arrayBuffer();

    if (hmac) {
      // HMAC always main-thread (key import is light)
      if (!secret) { setProgress(null); return; }
      const kb = new TextEncoder().encode(secret);
      const keyBuf = kb.buffer.slice(kb.byteOffset, kb.byteOffset + kb.byteLength) as ArrayBuffer;
      const r: Record<string, ArrayBuffer> = {};
      for (const algo of algosToRun) {
        const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: algo }, false, ["sign"]);
        r[algo] = await crypto.subtle.sign("HMAC", key, buf);
      }
      setResults(r);
      setProgress(null);
      return;
    }

    let done = 0;
    const total = algosToRun.length;
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (data.id !== id) return;
      if (data.type === "progress") {
        done += 1;
        setProgress({ pct: Math.round((done / total) * 100), label: `Hashing ${f.name}… ${data.algo}` });
      } else if (data.type === "done") {
        setResults(data.results);
        setProgress(null);
        worker.removeEventListener("message", handler);
      } else if (data.type === "error") {
        toast.error(data.message);
        setProgress(null);
        worker.removeEventListener("message", handler);
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ buffer: buf, algos: algosToRun, id }, [buf]);
  }, [algosToRun, hmac, secret]);

  // Re-hash file when toggles change
  useEffect(() => {
    if (mode === "file" && file) { void hashFile(file); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algosToRun.join(","), hmac, secret, mode]);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void hashFile(f);
  };

  const copyVal = (v: string) => { void navigator.clipboard.writeText(v); toast.success("Copied"); };

  const toggleAlgo = (a: HashAlgo) => {
    setVisible((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  };

  // Compare
  const [openCompare, setOpenCompare] = useState(false);
  const [hashA, setHashA] = useState("");
  const [hashB, setHashB] = useState("");
  const [cmp, setCmp] = useState<{ match: boolean; diffs: number[] } | null>(null);

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {(["text", "file", "hex"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
            {m === "text" ? "Text" : m === "file" ? "File" : "Hex"}
          </Button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setShowHistory((s) => !s)} aria-label="Hash history">
          <History className="h-4 w-4 mr-1" /> History
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">Recent hashes</span>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} aria-label="Close history"><X className="h-3 w-3" /></Button>
          </div>
          {history.map((h, i) => (
            <button key={i} type="button" onClick={() => { setMode("text"); setText(h.snippet); }} className="w-full text-left text-xs hover:bg-secondary rounded px-2 py-1 flex items-center gap-2">
              <code className="font-mono text-muted-foreground truncate flex-1">{h.snippet}</code>
              <code className="font-mono text-foreground/70 truncate">{h.sha256.slice(0, 16)}…</code>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {mode === "text" && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Input text</label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to hash…" className="min-h-[140px] font-mono text-sm bg-card border-border" />
        </div>
      )}
      {mode === "hex" && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Hex input</label>
          <Textarea value={hex} onChange={(e) => setHex(e.target.value)} placeholder="deadbeefcafebabe…" className="min-h-[120px] font-mono text-sm bg-card border-border" />
          {hexError && <p className="text-xs text-destructive">{hexError}</p>}
        </div>
      )}
      {mode === "file" && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">File</label>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors duration-150 ${dragOver ? "bg-accent border-primary" : "bg-muted border-border"}`}
          >
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-sm text-foreground">Drop a file here or click to choose</span>
            <span className="text-xs text-muted-foreground">Files up to 500 MB are streamed in a Web Worker</span>
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void hashFile(f); }} />
          </label>
          {file && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <FileText className="h-3 w-3" />
              <span className="font-mono">{file.name}</span>
              <span>· {(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
          {progress && (
            <div className="space-y-1">
              <Progress value={progress.pct ?? undefined} />
              <p className="text-xs text-muted-foreground">{progress.label}</p>
            </div>
          )}
        </div>
      )}

      {/* HMAC */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div>
          <label htmlFor="hmac-toggle" className="text-sm font-medium text-foreground">HMAC mode</label>
          <p className="text-xs text-muted-foreground">Sign the input with a secret key (HMAC-SHA-256/384/512)</p>
        </div>
        <Switch id="hmac-toggle" checked={hmac} onCheckedChange={setHmac} />
      </div>
      {hmac && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Secret key</label>
          <div className="flex gap-2">
            <Input type={showSecret ? "text" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Shared secret" className="font-mono" />
            <Button variant="outline" size="icon" onClick={() => setShowSecret((s) => !s)} aria-label={showSecret ? "Hide secret" : "Show secret"}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {!secret && <p className="text-xs text-muted-foreground">Enter a secret key to compute HMAC</p>}
        </div>
      )}

      {/* Algorithm visibility */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Algorithms</label>
        <div className="flex flex-wrap gap-2">
          {ALL_ALGOS.map((a) => {
            const active = visible.includes(a);
            const disabled = hmac && a === "SHA-1";
            return (
              <Button
                key={a}
                size="sm"
                variant={active && !disabled ? "default" : "outline"}
                disabled={disabled}
                onClick={() => toggleAlgo(a)}
                className="h-7 text-xs"
              >
                {hmac && a !== "SHA-1" ? `HMAC-${a}` : a}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Output format */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Output format</label>
        <div className="flex flex-wrap gap-2">
          {([
            ["hex", "Hex (lower)"],
            ["HEX", "Hex (UPPER)"],
            ["b64", "Base64"],
            ["b64u", "Base64 URL-safe"],
          ] as [OutputFmt, string][]).map(([k, label]) => (
            <Button key={k} size="sm" variant={outFmt === k ? "default" : "outline"} className="h-7 text-xs" onClick={() => setOutFmt(k)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{hmac ? "HMAC output" : "Hash output"}</h2>
        {algosToRun.length === 0 && <p className="text-sm text-muted-foreground">Enable at least one algorithm to see results.</p>}
        {algosToRun.map((a) => {
          const buf = results[a];
          const val = buf ? formatDigest(buf, outFmt) : "";
          const label = hmac ? `HMAC-${a}` : a;
          return (
            <div key={a} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{label}</Badge>
                  {a === "SHA-1" && !hmac && <span className="text-[10px] text-destructive">cryptographically broken — not for security</span>}
                </div>
                <Button variant="ghost" size="sm" aria-label={`Copy ${label}`} disabled={!val} onClick={() => copyVal(val)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <p className="font-mono text-sm text-foreground break-all min-h-[1.25rem]">{val || <span className="text-muted-foreground">—</span>}</p>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">MD5 and bcrypt are intentionally not supported — MD5 is cryptographically broken and the Web Crypto API does not expose it; bcrypt requires a server-side key-stretching loop.</p>
      </div>

      {/* Compare */}
      <Collapsible open={openCompare} onOpenChange={setOpenCompare}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <span>Compare hashes</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${openCompare ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Hash A</label>
              <Input value={hashA} onChange={(e) => setHashA(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Hash B</label>
              <Input value={hashB} onChange={(e) => setHashB(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
          <Button size="sm" onClick={() => setCmp(constantTimeCompare(hashA.trim(), hashB.trim()))}>Compare</Button>
          {cmp && (
            <div className={`rounded-lg p-3 border text-sm ${cmp.match ? "border-green-500/30 bg-green-500/5 text-green-500" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
              {cmp.match ? "✓ Hashes match" : "✗ Hashes do not match"}
              {!cmp.match && (
                <div className="mt-2 font-mono text-xs text-foreground break-all">
                  {Array.from(hashA).map((ch, i) => (
                    <span key={`a-${i}`} className={cmp.diffs.includes(i) ? "text-destructive font-bold" : ""}>{ch}</span>
                  ))}
                  <br />
                  {Array.from(hashB).map((ch, i) => (
                    <span key={`b-${i}`} className={cmp.diffs.includes(i) ? "text-destructive font-bold" : ""}>{ch}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ===================================================================
// UUID TAB
// ===================================================================
const UUID_EXPORT_KEY = "toolzy_uuid_export_format";
const UUID_COPY_KEY = "toolzy_uuid_copy_format";

function UuidTab() {
  const [version, setVersion] = useState<Version>("v4");
  const [count, setCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Format
  type CopyFmt = { uppercase: boolean; hyphens: boolean; braces: boolean; urn: boolean };
  const [fmt, setFmt] = useState<CopyFmt>(() => {
    try { return JSON.parse(localStorage.getItem(UUID_COPY_KEY) || "") || { uppercase: false, hyphens: true, braces: false, urn: false }; }
    catch { return { uppercase: false, hyphens: true, braces: false, urn: false }; }
  });
  useEffect(() => { localStorage.setItem(UUID_COPY_KEY, JSON.stringify(fmt)); }, [fmt]);

  const [exportFmt, setExportFmt] = useState<ExportFormat>(() => {
    const v = localStorage.getItem(UUID_EXPORT_KEY);
    return (v === "csv" || v === "json" || v === "sql" || v === "txt") ? v : "txt";
  });
  useEffect(() => { localStorage.setItem(UUID_EXPORT_KEY, exportFmt); }, [exportFmt]);

  // namespace
  const [nsType, setNsType] = useState<"DNS" | "URL" | "OID" | "X500" | "custom">("DNS");
  const [customNs, setCustomNs] = useState("");
  const [nsName, setNsName] = useState("");

  // validator/decoder
  const [validateInput, setValidateInput] = useState("");
  const [validation, setValidation] = useState<UUIDValidation | null>(null);
  const [decodeInput, setDecodeInput] = useState("");
  const [decoded, setDecoded] = useState<{ timestamp: Date; clockSeq: number } | null>(null);

  // history
  const [history, setHistory] = useState(loadUUIDHistory);
  const [showHistory, setShowHistory] = useState(false);

  // snippets
  const [snippetLang, setSnippetLang] = useState("JavaScript");

  // sorting
  type SortMode = "order" | "alpha" | "time";
  const [sortMode, setSortMode] = useState<SortMode>("order");

  // crypto quality
  const cryptoSecure = typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function";

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);

  const generate = useCallback(async () => {
    const ns = nsType === "custom" ? customNs : NAMESPACES[nsType];
    if (version === "v4" && count > 1000) {
      if (!workerRef.current) workerRef.current = new UuidWorker();
      const id = ++reqIdRef.current;
      setProgress({ done: 0, total: count });
      setUuids([]);
      const handler = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        if (e.data.type === "progress") setProgress({ done: e.data.done, total: e.data.total });
        if (e.data.type === "done") {
          setUuids(e.data.uuids);
          setProgress(null);
          workerRef.current?.removeEventListener("message", handler);
          saveUUIDHistory({ id: crypto.randomUUID(), timestamp: Date.now(), version, count, preview: e.data.uuids[0] });
          setHistory(loadUUIDHistory());
        }
      };
      workerRef.current.addEventListener("message", handler);
      workerRef.current.postMessage({ count, id });
      return;
    }
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      if (version === "v1") out.push(generateV1());
      else if (version === "v4") out.push(generateV4());
      else if (version === "v3") out.push(await generateV3(ns, nsName || `name-${i}`));
      else if (version === "v5") out.push(await generateV5(ns, nsName || `name-${i}`));
    }
    setUuids(out);
    saveUUIDHistory({ id: crypto.randomUUID(), timestamp: Date.now(), version, count, preview: out[0] });
    setHistory(loadUUIDHistory());
  }, [version, count, nsType, customNs, nsName]);

  useEffect(() => { void generate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const formatted = (u: string) => formatUUID(u, fmt);

  const displayed = useMemo(() => {
    if (sortMode === "order") return uuids;
    const arr = [...uuids];
    if (sortMode === "alpha") arr.sort();
    if (sortMode === "time") {
      arr.sort((a, b) => {
        const da = decodeV1(a)?.timestamp.getTime() ?? 0;
        const db = decodeV1(b)?.timestamp.getTime() ?? 0;
        return da - db;
      });
    }
    return arr;
  }, [uuids, sortMode]);

  // Virtualisation
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const ROW_H = 40;
  const VIEW_H = 480;
  const virtualise = displayed.length > 500;
  const startIdx = virtualise ? Math.max(0, Math.floor(scrollTop / ROW_H) - 5) : 0;
  const endIdx = virtualise ? Math.min(displayed.length, startIdx + Math.ceil(VIEW_H / ROW_H) + 10) : displayed.length;

  const copyAll = () => {
    navigator.clipboard.writeText(displayed.map(formatted).join("\n"));
    toast.success(`Copied ${displayed.length} UUIDs`);
  };
  const copyOne = (u: string) => { navigator.clipboard.writeText(formatted(u)); toast.success("Copied"); };

  const exportUuids = (format: ExportFormat) => {
    setExportFmt(format);
    const data = displayed.map(formatted);
    let content = "";
    switch (format) {
      case "txt": content = data.join("\n"); break;
      case "csv": content = "index,uuid\n" + data.map((u, i) => `${i + 1},${u}`).join("\n"); break;
      case "json": content = JSON.stringify(data, null, 2); break;
      case "sql": content = `INSERT INTO table (id) VALUES\n${data.map(u => `  ('${u}')`).join(",\n")};\n`; break;
    }
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `uuids.${format}`; a.click();
    URL.revokeObjectURL(url);
  };

  // Compare UUIDs
  const [openCompare, setOpenCompare] = useState(false);
  const [uA, setUA] = useState("");
  const [uB, setUB] = useState("");
  const fieldsOf = (u: string) => {
    const hex = u.replace(/[^0-9a-f]/gi, "");
    if (hex.length !== 32) return null;
    return {
      timeLow: hex.substring(0, 8),
      timeMid: hex.substring(8, 12),
      timeHiVersion: hex.substring(12, 16),
      clockSeq: hex.substring(16, 20),
      node: hex.substring(20, 32),
    };
  };
  const cmpFields = useMemo(() => {
    const a = fieldsOf(uA); const b = fieldsOf(uB);
    if (!a || !b) return null;
    const dv1a = decodeV1(uA); const dv1b = decodeV1(uB);
    let timeDelta: string | null = null;
    if (dv1a && dv1b) {
      const ms = dv1b.timestamp.getTime() - dv1a.timestamp.getTime();
      const sign = ms >= 0 ? "after" : "before";
      timeDelta = `UUID B was generated ${Math.abs(ms / 1000).toFixed(3)}s ${sign} UUID A`;
    }
    return { a, b, timeDelta };
  }, [uA, uB]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={cryptoSecure ? "default" : "destructive"} className="text-[10px]">
            {cryptoSecure ? "Using crypto.getRandomValues ✓" : "Not cryptographically secure"}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory((s) => !s)} aria-label="UUID history">
          <History className="h-4 w-4 mr-1" /> History
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-1">
          {history.map((h) => (
            <div key={h.id} className="text-xs text-muted-foreground flex justify-between border-b border-border pb-1">
              <code className="font-mono">{h.preview}</code>
              <div className="flex gap-2"><Badge variant="outline" className="text-[10px]">{h.version}</Badge><span>×{h.count}</span></div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Version</label>
            <div className="grid grid-cols-4 gap-2">
              {(["v1", "v4", "v3", "v5"] as Version[]).map((v) => (
                <Button key={v} size="sm" variant={version === v ? "default" : "outline"} onClick={() => setVersion(v)}>{v.toUpperCase()}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" title="All-zero UUID (RFC 9562 Nil)" onClick={() => { navigator.clipboard.writeText(NIL_UUID); toast.success("Nil UUID copied"); }}>
              Copy Nil UUID
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" title="All-ones UUID (RFC 9562 Max)" onClick={() => { navigator.clipboard.writeText(MAX_UUID); toast.success("Max UUID copied"); }}>
              Copy Max UUID
            </Button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Count: {count.toLocaleString()}</label>
            <Slider value={[count]} onValueChange={([v]) => setCount(v)} min={1} max={10000} step={1} />
            <div className="flex gap-2 mt-2 flex-wrap">
              {[1, 10, 100, 500, 1000, 5000, 10000].map((n) => (
                <Button key={n} size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setCount(n)}>{n.toLocaleString()}</Button>
              ))}
            </div>
          </div>
          {(version === "v3" || version === "v5") && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Namespace</label>
              <div className="flex gap-1 flex-wrap">
                {(["DNS", "URL", "OID", "X500", "custom"] as const).map((ns) => (
                  <Button key={ns} size="sm" variant={nsType === ns ? "default" : "outline"} className="h-7 text-xs" onClick={() => setNsType(ns)}>{ns}</Button>
                ))}
              </div>
              {nsType === "custom" && (
                <Input value={customNs} onChange={(e) => setCustomNs(e.target.value)} placeholder="Custom namespace UUID" className="font-mono text-xs h-8" />
              )}
              <Input value={nsName} onChange={(e) => setNsName(e.target.value)} placeholder="Name string" className="font-mono text-xs h-8" />
            </div>
          )}
        </div>

        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wider block">Format options</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["Uppercase", "uppercase"],
              ["Hyphens", "hyphens"],
              ["Braces {}", "braces"],
              ["URN format", "urn"],
            ] as [string, keyof CopyFmt][]).map(([label, key]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={fmt[key]} onChange={(e) => setFmt({ ...fmt, [key]: e.target.checked })} className="accent-primary" />
                {label}
              </label>
            ))}
          </div>
          <div className="pt-2 border-t border-border">
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Sort by</label>
            <div className="flex gap-2">
              {([
                ["order", "Order"],
                ["alpha", "A→Z"],
                ["time", "Timestamp (v1)"],
              ] as [SortMode, string][]).map(([k, l]) => (
                <Button key={k} size="sm" variant={sortMode === k ? "default" : "outline"} className="h-7 text-xs" onClick={() => setSortMode(k)}>{l}</Button>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-border">
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Export {exportFmt && <span className="text-foreground/60">(last: .{exportFmt})</span>}</label>
            <div className="flex gap-2 flex-wrap">
              {(["txt", "csv", "json", "sql"] as ExportFormat[]).map((f) => (
                <Button key={f} size="sm" variant={exportFmt === f ? "default" : "outline"} className="h-7 text-xs" onClick={() => exportUuids(f)}>
                  <Download className="h-3 w-3 mr-1" />.{f}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Button onClick={generate}><RotateCcw className="h-4 w-4 mr-1" /> Generate</Button>
        <Button variant="outline" onClick={copyAll} disabled={!displayed.length}><Copy className="h-4 w-4 mr-1" /> Copy all</Button>
        {progress && (
          <span className="text-xs text-muted-foreground">Generating… {progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
        )}
      </div>

      {/* Results — virtualised when > 500 */}
      {virtualise ? (
        <div
          ref={listRef}
          onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          className="border border-border rounded-lg bg-card overflow-auto"
          style={{ height: VIEW_H }}
        >
          <div style={{ height: displayed.length * ROW_H, position: "relative" }}>
            {displayed.slice(startIdx, endIdx).map((u, j) => {
              const i = startIdx + j;
              return (
                <div key={i} style={{ position: "absolute", top: i * ROW_H, left: 0, right: 0, height: ROW_H }} className="flex items-center gap-3 px-4 border-b border-border">
                  <span className="text-xs text-muted-foreground w-12 font-mono shrink-0">{i + 1}</span>
                  <code className="font-mono text-xs text-foreground flex-1 truncate">{formatted(u)}</code>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyOne(u)} aria-label="Copy UUID"><Copy className="h-3 w-3" /></Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayed.map((u, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2.5">
              <span className="text-xs text-muted-foreground w-6 shrink-0 font-mono">{i + 1}</span>
              <code className="font-mono text-sm text-foreground flex-1 select-all break-all">{formatted(u)}</code>
              <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={() => copyOne(u)} aria-label="Copy UUID"><Copy className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      )}

      {/* Validator + decoder */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Validate</label>
          <div className="flex gap-2">
            <Input value={validateInput} onChange={(e) => setValidateInput(e.target.value)} placeholder="Paste a UUID" className="font-mono text-xs" />
            <Button size="sm" onClick={() => setValidation(validateUUID(validateInput))}>Check</Button>
          </div>
          {validation && (
            <div className={`rounded p-3 text-xs border ${validation.valid ? "border-green-500/30 bg-green-500/5 text-green-500" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
              {validation.valid ? `Valid · v${validation.version} · ${validation.variant}` : "Invalid UUID"}
            </div>
          )}
        </div>
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Decode v1 timestamp</label>
          <div className="flex gap-2">
            <Input value={decodeInput} onChange={(e) => setDecodeInput(e.target.value)} placeholder="v1 UUID" className="font-mono text-xs" />
            <Button size="sm" onClick={() => setDecoded(decodeV1(decodeInput))}>Decode</Button>
          </div>
          {decoded ? (
            <div className="text-xs text-foreground space-y-1">
              <div><span className="text-muted-foreground">ISO:</span> <span className="font-mono">{decoded.timestamp.toISOString()}</span></div>
              <div><span className="text-muted-foreground">Clock seq:</span> <span className="font-mono">{decoded.clockSeq}</span></div>
            </div>
          ) : decodeInput && <p className="text-xs text-muted-foreground">Not a valid v1 UUID.</p>}
        </div>
      </div>

      {/* Compare UUIDs */}
      <Collapsible open={openCompare} onOpenChange={setOpenCompare}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <span>Compare UUIDs</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${openCompare ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Input value={uA} onChange={(e) => setUA(e.target.value)} placeholder="UUID A" className="font-mono text-xs" />
            <Input value={uB} onChange={(e) => setUB(e.target.value)} placeholder="UUID B" className="font-mono text-xs" />
          </div>
          {cmpFields && (
            <div className="border border-border rounded-lg p-3 bg-card overflow-auto">
              <table className="w-full text-xs font-mono">
                <thead><tr className="text-muted-foreground"><th className="text-left pb-1">Field</th><th className="text-left pb-1">A</th><th className="text-left pb-1">B</th></tr></thead>
                <tbody>
                  {(["timeLow", "timeMid", "timeHiVersion", "clockSeq", "node"] as const).map((k) => {
                    const diff = cmpFields.a[k] !== cmpFields.b[k];
                    return (
                      <tr key={k} className={diff ? "text-destructive" : "text-foreground"}>
                        <td className="font-sans pr-3">{k}</td>
                        <td>{cmpFields.a[k]}</td>
                        <td>{cmpFields.b[k]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {cmpFields.timeDelta && <p className="text-xs text-muted-foreground mt-2">{cmpFields.timeDelta}</p>}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Code snippets */}
      <div className="border border-border rounded-lg p-4 bg-card space-y-3">
        <div className="flex gap-2 flex-wrap">
          {Object.keys(CODE_SNIPPETS).map((lang) => (
            <Button key={lang} size="sm" variant={snippetLang === lang ? "default" : "outline"} onClick={() => setSnippetLang(lang)}>{lang}</Button>
          ))}
        </div>
        <pre className="bg-background rounded-lg p-4 text-sm font-mono text-foreground overflow-auto"><code>{CODE_SNIPPETS[snippetLang].code}</code></pre>
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(CODE_SNIPPETS[snippetLang].code); toast.success("Copied"); }}>
          <Copy className="h-3 w-3 mr-1" /> Copy
        </Button>
      </div>
    </div>
  );
}

export default CryptoSuite;
