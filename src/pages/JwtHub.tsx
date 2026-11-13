import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Eye, EyeOff, Trash2, AlertTriangle, CheckCircle, XCircle, ChevronDown, History, ShieldCheck, ShieldAlert, ShieldX, Plus, Sparkles, Globe, Key, RefreshCw } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";

// Classic jwt.io demo token (HS256, secret "your-256-bit-secret") for instant demos
const SAMPLE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
import {
  decodeJwt, formatTimestamp, extractJwtFromInput, type DecodedJwt,
} from "@/components/jwt-decoder/jwtUtils";
import {
  ALGORITHMS, getAlgorithmFamily, signHMAC, signRSA, signRSAPSS, signECDSA,
} from "@/components/jwt-encoder/encoderUtils";
import { base64UrlToBytes, toArrayBuffer } from "@/lib/crypto/base64";
import { importKeyInput } from "@/lib/crypto/keyInput";
import { ToolPageLayout } from "@/components/ToolPageLayout";

// ---------- Algorithm metadata ----------
const ALG_META: Record<string, { family: string; grade: "best" | "good" | "weak" | "critical"; note: string }> = {
  HS256: { family: "HMAC", grade: "weak", note: "Symmetric — secret must be shared between issuer and verifier" },
  HS384: { family: "HMAC", grade: "weak", note: "Symmetric — secret must be shared between issuer and verifier" },
  HS512: { family: "HMAC", grade: "weak", note: "Symmetric — secret must be shared between issuer and verifier" },
  RS256: { family: "RSA", grade: "good", note: "Asymmetric — public key can be published safely" },
  RS384: { family: "RSA", grade: "good", note: "Asymmetric — public key can be published safely" },
  RS512: { family: "RSA", grade: "good", note: "Asymmetric — public key can be published safely" },
  PS256: { family: "RSA-PSS", grade: "best", note: "Asymmetric with PSS padding — recommended for new systems" },
  PS384: { family: "RSA-PSS", grade: "best", note: "Asymmetric with PSS padding — recommended for new systems" },
  PS512: { family: "RSA-PSS", grade: "best", note: "Asymmetric with PSS padding — recommended for new systems" },
  ES256: { family: "ECDSA", grade: "best", note: "Elliptic curve — small keys, strong security" },
  ES384: { family: "ECDSA", grade: "best", note: "Elliptic curve — small keys, strong security" },
  ES512: { family: "ECDSA", grade: "best", note: "Elliptic curve — small keys, strong security" },
  none:  { family: "None", grade: "critical", note: "No signature — NEVER use in production" },
};

const ALG_GRADE_COLOR: Record<string, string> = {
  best: "bg-green-500/15 text-green-400 border-green-500/30",
  good: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  weak: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/40",
};

function AlgoBadge({ alg }: { alg: string }) {
  const meta = ALG_META[alg?.toUpperCase()] || { family: "Unknown", grade: "weak" as const, note: "Unrecognised algorithm" };
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs font-semibold ${ALG_GRADE_COLOR[meta.grade]}`}>
        <Key className="w-3 h-3" />
        {alg?.toUpperCase()}
      </span>
      <span className={`rounded border px-2 py-0.5 text-xs ${ALG_GRADE_COLOR[meta.grade]}`}>{meta.family}</span>
      <span className={`rounded border px-2 py-0.5 text-xs capitalize ${ALG_GRADE_COLOR[meta.grade]}`}>{meta.grade}</span>
      <span className="text-xs text-muted-foreground">{meta.note}</span>
    </div>
  );
}

// ---------- Shared types & helpers ----------
type SigStatus = "unverified" | "valid" | "invalid" | "unsigned";

interface SecurityFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  fix: string;
}

interface SecurityResult {
  grade: "A" | "B" | "C" | "D" | "F";
  findings: SecurityFinding[];
}

const SEVERITY_WEIGHT: Record<SecurityFinding["severity"], number> = {
  critical: 100, high: 40, medium: 20, low: 5, info: 0,
};

function computeSecurity(header: Record<string, any> | null, payload: Record<string, any> | null, secretLen: number): SecurityResult {
  const findings: SecurityFinding[] = [];
  if (!header || !payload) {
    return { grade: "A", findings: [] };
  }
  const alg = String(header.alg || "").toLowerCase();

  if (alg === "none") {
    findings.push({ severity: "critical", message: "Algorithm is 'none' — token is unsigned", fix: "Use HS256, RS256, or ES256." });
  } else if (alg === "hs256") {
    if (secretLen > 0 && secretLen < 32) {
      findings.push({ severity: "high", message: `HS256 secret is only ${secretLen} chars`, fix: "Use a secret of 32+ random characters." });
    }
    findings.push({ severity: "low", message: "HS256 is symmetric", fix: "Consider RS256 / ES256 for public-facing APIs." });
  }

  if (!payload.exp) {
    findings.push({ severity: "medium", message: "Missing exp claim — token never expires", fix: "Add an exp claim (e.g. now + 1h)." });
  } else {
    const diff = payload.exp * 1000 - Date.now();
    if (diff > 24 * 60 * 60 * 1000) {
      findings.push({ severity: "low", message: "exp is more than 24h in the future", fix: "Use short-lived tokens with refresh." });
    }
  }
  if (!payload.iss) findings.push({ severity: "low", message: "Missing iss claim", fix: "Add iss to identify the issuer." });
  if (!payload.sub) findings.push({ severity: "info", message: "Missing sub claim", fix: "Add sub to identify the principal." });

  // Grade from worst severity tier
  let grade: SecurityResult["grade"] = "A";
  const total = findings.reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0);
  if (findings.some(f => f.severity === "critical")) grade = "F";
  else if (findings.some(f => f.severity === "high")) grade = "D";
  else if (findings.some(f => f.severity === "medium")) grade = "C";
  else if (total > 0) grade = "B";

  return { grade, findings };
}

const GRADE_COLOR: Record<SecurityResult["grade"], string> = {
  A: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success-foreground))] border-[hsl(var(--success))]/40",
  B: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/40",
  C: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning-foreground))] border-[hsl(var(--warning))]/40",
  D: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning-foreground))] border-[hsl(var(--warning))]/40",
  F: "bg-destructive/15 text-destructive border-destructive/40",
};

const SEVERITY_COLOR: Record<SecurityFinding["severity"], string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/40",
  high: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning-foreground))] border-[hsl(var(--warning))]/40",
  medium: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning-foreground))] border-[hsl(var(--warning))]/40",
  low: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/40",
  info: "bg-muted text-muted-foreground border-border",
};

// History (localStorage)
const HISTORY_KEY = "toolzy_jwt_history";
const HISTORY_MAX = 10;
interface HistoryItem { token: string; ts: number; label: string; }
function getHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function pushHistory(token: string, label: string) {
  if (!token) return;
  const list = getHistory().filter(h => h.token !== token);
  list.unshift({ token, ts: Date.now(), label });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
}

// base64url helper (for verification) — returns ArrayBuffer for crypto.subtle compatibility
const b64uToBuf = (s: string): ArrayBuffer => toArrayBuffer(base64UrlToBytes(s));

async function verifyHmacToken(token: string, secret: string, hashAlg: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: hashAlg }, false, ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, b64uToBuf(parts[2]), data);
}

async function verifyRsaToken(token: string, pubKeyPem: string, hashAlg: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const key = await importKeyInput(pubKeyPem, { name: "RSASSA-PKCS1-v1_5", hash: hashAlg }, "verify");
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64uToBuf(parts[2]), data);
}

async function verifyRsaPssToken(token: string, pubKeyPem: string, hashAlg: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const key = await importKeyInput(pubKeyPem, { name: "RSA-PSS", hash: hashAlg }, "verify");
  return crypto.subtle.verify({ name: "RSA-PSS", saltLength: Number(hashAlg.slice(4)) / 8 }, key, b64uToBuf(parts[2]), data);
}

async function verifyEcdsaToken(token: string, pubKeyPem: string, hashAlg: string, alg: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const namedCurve = alg === "ES384" ? "P-384" : "P-256";
  const key = await importKeyInput(pubKeyPem, { name: "ECDSA", namedCurve }, "verify");
  return crypto.subtle.verify({ name: "ECDSA", hash: hashAlg }, key, b64uToBuf(parts[2]), data);
}

// ---------- Token Preview (right column, shared) ----------
function TokenPreview({ token }: { token: string }) {
  const parts = token ? token.split(".") : [];
  const [copied, setCopied] = useState<"header" | "payload" | "signature" | null>(null);
  const copyPart = (p: string, segment: "header" | "payload" | "signature") => {
    if (!p) return;
    navigator.clipboard.writeText(p).then(() => {
      setCopied(segment);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Token Preview</div>
      {token ? (
        <div className="font-mono text-xs break-all leading-relaxed">
          <button
            onClick={() => copyPart(parts[0], "header")}
            className={`px-1.5 py-0.5 rounded transition-colors ${copied === "header" ? "bg-[hsl(var(--info))]/40 text-[hsl(var(--info))]" : "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/25"}`}
            title="Click to copy header"
            aria-label="Copy JWT header"
          >
            {parts[0]}
          </button>
          <span className="text-muted-foreground">.</span>
          <button
            onClick={() => copyPart(parts[1], "payload")}
            className={`px-1.5 py-0.5 rounded transition-colors ${copied === "payload" ? "bg-[hsl(var(--success))]/40 text-[hsl(var(--success-foreground))]" : "bg-[hsl(var(--success))]/15 text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/25"}`}
            title="Click to copy payload"
            aria-label="Copy JWT payload"
          >
            {parts[1]}
          </button>
          <span className="text-muted-foreground">.</span>
          {parts[2] ? (
            <button
              onClick={() => copyPart(parts[2], "signature")}
              className={`px-1.5 py-0.5 rounded transition-colors ${copied === "signature" ? "bg-destructive/40 text-destructive" : "bg-destructive/15 text-destructive hover:bg-destructive/25"}`}
              title="Click to copy signature"
              aria-label="Copy JWT signature"
            >
              {parts[2]}
            </button>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground italic">unsigned</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic py-4 text-center">No token yet — paste, encode, or verify a JWT.</p>
      )}
      {copied && (
        <p className="text-xs text-[hsl(var(--success-foreground))] text-center capitalize">{copied} copied ✓</p>
      )}
      {token && (
        <CopyButton value={token} message="Full JWT copied" label="Copy full token" variant="ghost" size="sm" className="h-6 text-xs w-full" />
      )}
    </div>
  );
}

// ---------- Security card (right column, shared) ----------
function SecurityCard({ result }: { result: SecurityResult }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Security Score</span>
        <div className={`px-3 py-1 rounded-md border font-mono text-lg font-bold ${GRADE_COLOR[result.grade]}`}>
          {result.grade}
        </div>
      </div>
      {result.findings.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--success-foreground))]">
          <CheckCircle className="w-4 h-4" /> No issues found
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-auto">
          {result.findings.map((f, i) => (
            <div key={i} className="rounded-md border border-border p-2 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${SEVERITY_COLOR[f.severity]}`}>{f.severity}</Badge>
                <span className="text-xs text-foreground">{f.message}</span>
              </div>
              <p className="text-xs text-muted-foreground pl-1">→ {f.fix}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Countdown helper ----------
function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m ${totalSec % 60}s`;
  const hrs = Math.floor(totalMin / 60);
  if (hrs < 24) return `${hrs}h ${totalMin % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

// ---------- Claims checklist (used in Decode & Verify) ----------
const STANDARD_CLAIMS = ["exp", "nbf", "iat", "iss", "aud", "sub"];
function ClaimsChecklist({ payload }: { payload: Record<string, any> | null }) {
  if (!payload) return null;
  const now = Math.floor(Date.now() / 1000);
  const rows = STANDARD_CLAIMS.map(claim => {
    const v = payload[claim];
    let ok = v !== undefined && v !== null && v !== "";
    let note = "";
    if (claim === "exp" && typeof v === "number") {
      if (v < now) { ok = false; note = "expired"; }
      else note = formatTimestamp(v).date;
    } else if (claim === "nbf" && typeof v === "number") {
      if (v > now) { ok = false; note = "not yet valid"; }
      else note = formatTimestamp(v).date;
    } else if (claim === "iat" && typeof v === "number") {
      note = formatTimestamp(v).date;
    } else if (v !== undefined) {
      note = typeof v === "object" ? JSON.stringify(v) : String(v);
    } else {
      note = "missing";
    }
    return { claim, ok, note };
  });
  return (
    <div className="rounded-md border border-border bg-card divide-y divide-border">
      {rows.map(r => (
        <div key={r.claim} className="flex items-center gap-2 px-3 py-1.5 text-xs">
          {r.ok ? <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--success-foreground))] shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
          <span className="font-mono font-semibold text-foreground w-10">{r.claim}</span>
          <span className={`font-mono ${r.ok ? "text-muted-foreground" : "text-destructive"}`}>{r.note}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- JSON viewer with copy ----------
function JsonBlock({ title, data, accent }: { title: string; data: any; accent: "blue" | "green" }) {
  const text = JSON.stringify(data, null, 2);
  const cls = accent === "blue" ? "border-[hsl(var(--info))]/30" : "border-[hsl(var(--success))]/30";
  const titleCls = accent === "blue" ? "text-[hsl(var(--info))]" : "text-[hsl(var(--success-foreground))]";
  return (
    <div className={`rounded-md border ${cls} bg-card`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className={`text-xs uppercase tracking-wider font-semibold ${titleCls}`}>{title}</span>
        <CopyButton value={text} message={`${title} copied`} label="Copy" variant="ghost" size="sm" className="h-5 text-xs px-1.5" />
      </div>
      <pre className="p-3 font-mono text-[11px] overflow-auto max-h-[280px] text-foreground">{text}</pre>
    </div>
  );
}

// ---------- Decode tab ----------
function DecodeTab({
  shared, setShared,
}: {
  shared: SharedState;
  setShared: (s: Partial<SharedState>) => void;
}) {
  const [input, setInput] = useState(shared.activeToken);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(getHistory());
  const [showHistory, setShowHistory] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tick every second so the exp/nbf countdown stays current
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!shared.decodedPayload?.exp) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [!!shared.decodedPayload?.exp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (shared.activeToken !== input) setInput(shared.activeToken);
  }, [shared.activeToken]);

  const run = useCallback((raw: string) => {
    if (!raw.trim()) {
      setError("");
      setShared({ activeToken: "", decodedHeader: null, decodedPayload: null, signatureStatus: "unverified" });
      return;
    }
    try {
      const extracted = extractJwtFromInput(raw);
      const r: DecodedJwt = decodeJwt(extracted);
      setError("");
      const status: SigStatus = !r.signature ? "unsigned" : "unverified";
      setShared({
        activeToken: extracted,
        decodedHeader: r.header,
        decodedPayload: r.payload,
        signatureStatus: status,
      });
      pushHistory(extracted, String(r.payload.sub || r.payload.email || r.payload.iss || "JWT"));
      setHistory(getHistory());
    } catch (e: any) {
      setError(e.message);
      setShared({ decodedHeader: null, decodedPayload: null });
    }
  }, [setShared]);

  const onChange = (v: string) => {
    setInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(v), 300);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="shrink-0 whitespace-nowrap text-xs uppercase tracking-wider text-muted-foreground">Paste JWT</Label>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setInput(SAMPLE_JWT); run(SAMPLE_JWT); toast.success("Sample token loaded"); }}>
            <Sparkles className="w-3 h-3 mr-1" /> Sample
          </Button>
          <div className="relative">
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowHistory(v => !v)}>
              <History className="w-3 h-3 mr-1" /> History ({history.length})
            </Button>
            {showHistory && history.length > 0 && (
              <div className="absolute right-0 top-7 z-10 w-72 rounded-md border border-border bg-popover shadow-md max-h-72 overflow-auto">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(h.token); run(h.token); setShowHistory(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border last:border-0"
                  >
                    <div className="font-mono truncate">{h.label}</div>
                    <div className="text-xs text-muted-foreground">{new Date(h.ts).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => { setInput(""); run(""); }}>
            <Trash2 className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      </div>
      <Textarea
        value={input}
        onChange={e => onChange(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        className="min-h-[120px] font-mono text-xs bg-card border-border resize-none"
      />
      {error && (
        <div className="flex items-center gap-2 text-destructive text-xs font-mono">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {shared.decodedHeader && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary w-full">
            <ChevronDown className="w-3 h-3" /> Header
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <JsonBlock title="Header" data={shared.decodedHeader} accent="blue" />
            {shared.decodedHeader.alg && <AlgoBadge alg={String(shared.decodedHeader.alg)} />}
          </CollapsibleContent>
        </Collapsible>
      )}

      {shared.decodedPayload && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary w-full">
            <ChevronDown className="w-3 h-3" /> Payload
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <JsonBlock title="Payload" data={shared.decodedPayload} accent="green" />
            {(shared.decodedPayload.iat || shared.decodedPayload.exp || shared.decodedPayload.nbf) && (
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {["iat", "nbf", "exp"].map(k => {
                  const v = shared.decodedPayload?.[k];
                  if (typeof v !== "number") return null;
                  const info = formatTimestamp(v);
                  const isExp = k === "exp";
                  const expiredMs = isExp ? (v * 1000 - Date.now()) : null;
                  const isExpired = expiredMs !== null && expiredMs < 0;
                  const countdownStr = expiredMs !== null
                    ? isExpired
                      ? `expired ${formatCountdown(-expiredMs)} ago`
                      : `expires in ${formatCountdown(expiredMs)}`
                    : null;
                  return (
                    <div key={k} className={`rounded border px-2 py-1 ${isExp && isExpired ? "border-destructive/40 bg-destructive/10" : isExp ? "border-green-500/30 bg-green-500/10" : "border-border bg-muted/30"}`}>
                      <span className="text-muted-foreground">{k}:</span> {v}{" "}
                      <span className="text-muted-foreground">→ {info.date}</span>
                      {countdownStr && (
                        <span className={`ml-2 font-semibold ${isExpired ? "text-destructive" : "text-green-400"}`}>
                          ({countdownStr})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {shared.decodedPayload && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary w-full">
            <ChevronDown className="w-3 h-3" /> Claims Validator
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ClaimsChecklist payload={shared.decodedPayload} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ---------- Encode tab ----------
const DEFAULT_HEADER = (alg: string) => JSON.stringify({ alg, typ: "JWT" }, null, 2);
const DEFAULT_PAYLOAD = () => JSON.stringify({ sub: "1234567890", iat: Math.floor(Date.now() / 1000) }, null, 2);

function EncodeTab({ shared, setShared }: { shared: SharedState; setShared: (s: Partial<SharedState>) => void; }) {
  const [alg, setAlg] = useState("HS256");
  const [headerStr, setHeaderStr] = useState(DEFAULT_HEADER("HS256"));
  const [payloadStr, setPayloadStr] = useState(DEFAULT_PAYLOAD());
  const [secret, setSecret] = useState("");
  const [pkey, setPkey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [signing, setSigning] = useState(false);
  const family = getAlgorithmFamily(alg);

  useEffect(() => {
    try {
      const h = JSON.parse(headerStr);
      if (h.alg !== alg) {
        h.alg = alg;
        setHeaderStr(JSON.stringify(h, null, 2));
      }
    } catch { }
  }, [alg]);

  // Propagate HMAC secret length to shared state so the security scorer can use it
  useEffect(() => {
    if (family === "HMAC") setShared({ hmacSecretLen: secret.length });
    else setShared({ hmacSecretLen: 0 });
  }, [secret, family]);

  useEffect(() => {
    try {
      const h = JSON.parse(headerStr);
      const p = JSON.parse(payloadStr);
      const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const unsigned = `${b64u(JSON.stringify(h))}.${b64u(JSON.stringify(p))}.`;
      setShared({
        activeToken: unsigned,
        decodedHeader: h,
        decodedPayload: p,
        signatureStatus: "unsigned",
      });
    } catch { }
  }, [headerStr, payloadStr]);

  const addClaim = (key: string, value: any) => {
    try {
      const p = JSON.parse(payloadStr);
      p[key] = value;
      setPayloadStr(JSON.stringify(p, null, 2));
      toast.success(`Added ${key}`);
    } catch { toast.error("Fix payload JSON first"); }
  };
  const now = () => Math.floor(Date.now() / 1000);

  const sign = async () => {
    let h: any, p: any;
    try { h = JSON.parse(headerStr); } catch { toast.error("Invalid header JSON"); return; }
    try { p = JSON.parse(payloadStr); } catch { toast.error("Invalid payload JSON"); return; }
    const keyOrSecret = family === "HMAC" ? secret : pkey;
    if (!keyOrSecret) { toast.error(family === "HMAC" ? "Enter a secret" : "Paste a private key"); return; }
    setSigning(true);
    try {
      const opt = ALGORITHMS.find(a => a.value === alg)!;
      let token: string;
      if (family === "HMAC") token = await signHMAC(JSON.stringify(h), JSON.stringify(p), secret, opt.webCryptoAlg);
      else if (family === "RSA") token = await signRSA(JSON.stringify(h), JSON.stringify(p), pkey, opt.webCryptoAlg);
      else if (family === "RSA-PSS") token = await signRSAPSS(JSON.stringify(h), JSON.stringify(p), pkey, opt.webCryptoAlg);
      else token = await signECDSA(JSON.stringify(h), JSON.stringify(p), pkey, opt.webCryptoAlg, alg);
      setShared({
        activeToken: token,
        decodedHeader: h,
        decodedPayload: p,
        signatureStatus: "unverified",
      });
      pushHistory(token, String(p.sub || p.iss || "Encoded JWT"));
      toast.success("JWT signed");
    } catch (e: any) {
      toast.error(e.message || "Signing failed");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Algorithm</Label>
        <Select value={alg} onValueChange={setAlg}>
          <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALGORITHMS.filter(a => ["HS256","HS384","HS512","RS256","PS256","ES256"].includes(a.value)).map(a => (
              <SelectItem key={a.value} value={a.value} className="text-xs">{a.label} <span className="text-muted-foreground ml-1">({a.family})</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {family === "HMAC" ? "Secret" : "Private Key (PEM or JWK)"}
        </Label>
        {family === "HMAC" ? (
          <div className="relative">
            <Input type={showSecret ? "text" : "password"} value={secret} onChange={e => setSecret(e.target.value)} placeholder="HMAC secret..." className="font-mono text-xs pr-9 h-8" />
            <Button variant="ghost" size="icon" className="absolute right-0.5 top-0.5 h-7 w-7" onClick={() => setShowSecret(v => !v)} aria-label="Toggle secret visibility">
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        ) : (
          <Textarea value={pkey} onChange={e => setPkey(e.target.value)} placeholder={`-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`} className="min-h-[90px] font-mono text-xs bg-card resize-none" />
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[hsl(var(--info))] uppercase tracking-wider">Header</Label>
        <Textarea value={headerStr} onChange={e => setHeaderStr(e.target.value)} className="min-h-[90px] font-mono text-xs bg-card border-[hsl(var(--info))]/30 resize-none" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-[hsl(var(--success-foreground))] uppercase tracking-wider">Payload</Label>
        <Textarea value={payloadStr} onChange={e => setPayloadStr(e.target.value)} className="min-h-[110px] font-mono text-xs bg-card border-[hsl(var(--success))]/30 resize-none" />
      </div>

      <div className="flex flex-wrap gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addClaim("exp", now() + 3600)}><Plus className="w-3 h-3" />exp (1h)</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addClaim("nbf", now())}><Plus className="w-3 h-3" />nbf</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addClaim("iss", "https://example.com")}><Plus className="w-3 h-3" />iss</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addClaim("aud", "my-api")}><Plus className="w-3 h-3" />aud</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addClaim("jti", crypto.randomUUID())}><Plus className="w-3 h-3" />jti</Button>
      </div>

      <Button onClick={sign} disabled={signing} className="w-full">
        {signing ? "Signing..." : "Sign & Preview"}
      </Button>

      {shared.signatureStatus === "unsigned" && (
        <p className="text-xs text-[hsl(var(--warning-foreground))] flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Unsigned preview — click Sign to generate signature
        </p>
      )}
    </div>
  );
}

// ---------- Verify tab ----------
const VERIFY_CODE = {
  nodejs: `// npm i jsonwebtoken\nconst jwt = require('jsonwebtoken');\nconst decoded = jwt.verify(token, secretOrPublicKey, { algorithms: ['HS256'] });\nconsole.log(decoded);`,
  python: `# pip install pyjwt\nimport jwt\ndecoded = jwt.decode(token, secret_or_public_key, algorithms=['HS256'])\nprint(decoded)`,
  go: `// go get github.com/golang-jwt/jwt/v5\nimport "github.com/golang-jwt/jwt/v5"\ntoken, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {\n    return []byte(secret), nil\n})`,
  php: `// composer require firebase/php-jwt\nuse Firebase\\JWT\\JWT;\nuse Firebase\\JWT\\Key;\n$decoded = JWT::decode($jwt, new Key($secret, 'HS256'));\nprint_r($decoded);`,
};

function VerifyTab({ shared, setShared }: { shared: SharedState; setShared: (s: Partial<SharedState>) => void; }) {
  const [token, setToken] = useState(shared.activeToken);
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<null | "valid" | "invalid" | "warn-none">(null);
  const [verifying, setVerifying] = useState(false);
  const [parsed, setParsed] = useState<DecodedJwt | null>(null);

  useEffect(() => { setToken(shared.activeToken); }, [shared.activeToken]);

  useEffect(() => {
    try { setParsed(decodeJwt(token)); } catch { setParsed(null); }
  }, [token]);

  const alg: string = (parsed?.header.alg || "").toUpperCase();
  const family = alg.startsWith("HS") ? "HMAC" : alg.startsWith("RS") ? "RSA" : alg.startsWith("PS") ? "RSA-PSS" : alg.startsWith("ES") ? "ECDSA" : "";

  // Propagate HMAC secret length to shared state so the security scorer can use it
  useEffect(() => {
    if (family === "HMAC") setShared({ hmacSecretLen: secret.length });
    else setShared({ hmacSecretLen: 0 });
  }, [secret, family]);

  const verify = async () => {
    if (!parsed) { toast.error("Paste a valid JWT first"); return; }
    if (alg === "NONE") { setResult("warn-none"); setShared({ signatureStatus: "invalid" }); return; }
    if (!secret.trim()) { toast.error("Provide secret or public key"); return; }
    setVerifying(true);
    try {
      const opt = ALGORITHMS.find(a => a.value === alg);
      const hash = opt?.webCryptoAlg || "SHA-256";
      let ok = false;
      if (family === "HMAC") ok = await verifyHmacToken(token, secret, hash);
      else if (family === "RSA") ok = await verifyRsaToken(token, secret, hash);
      else if (family === "RSA-PSS") ok = await verifyRsaPssToken(token, secret, hash);
      else if (family === "ECDSA") ok = await verifyEcdsaToken(token, secret, hash, alg);
      setResult(ok ? "valid" : "invalid");
      setShared({ signatureStatus: ok ? "valid" : "invalid", activeToken: token, decodedHeader: parsed.header, decodedPayload: parsed.payload });
      toast[ok ? "success" : "error"](ok ? "Signature valid" : "Signature invalid");
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
      setResult("invalid");
    } finally {
      setVerifying(false);
    }
  };

  const [codeLang, setCodeLang] = useState<keyof typeof VERIFY_CODE>("nodejs");

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">JWT</Label>
        <Textarea value={token} onChange={e => setToken(e.target.value)} placeholder="Paste JWT to verify..." className="min-h-[90px] font-mono text-xs bg-card resize-none" />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Algorithm:</span>
        <Badge variant="outline" className="font-mono">{alg || "—"}</Badge>
        {family && <span className="text-muted-foreground">({family})</span>}
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {family === "HMAC" ? "Secret" : "Public Key (PEM or JWK)"}
        </Label>
        {family === "HMAC" || !family ? (
          <Input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Secret..." className="font-mono text-xs h-8" />
        ) : (
          <Textarea value={secret} onChange={e => setSecret(e.target.value)} placeholder={`-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`} className="min-h-[90px] font-mono text-xs bg-card resize-none" />
        )}
      </div>

      <Button onClick={verify} disabled={verifying} className="w-full">{verifying ? "Verifying..." : "Verify Signature"}</Button>

      {result && (
        <div
          className={`w-full rounded-md border p-3 flex items-center gap-2 text-sm font-medium ${
            result === "valid" ? "bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/40 text-[hsl(var(--success-foreground))]"
            : result === "warn-none" ? "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/40 text-[hsl(var(--warning-foreground))]"
            : "bg-destructive/10 border-destructive/40 text-destructive"
          }`}
        >
          {result === "valid" ? <ShieldCheck className="w-4 h-4" /> : result === "warn-none" ? <ShieldAlert className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
          {result === "valid" && "Signature valid"}
          {result === "invalid" && "Signature invalid"}
          {result === "warn-none" && "Warning: algorithm is 'none' — token is unsigned"}
        </div>
      )}

      {parsed && (
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Claims</Label>
          <ClaimsChecklist payload={parsed.payload} />
        </div>
      )}

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary w-full">
          <ChevronDown className="w-3 h-3" /> Server-side verification examples
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          <div className="flex gap-1">
            {(Object.keys(VERIFY_CODE) as (keyof typeof VERIFY_CODE)[]).map(k => (
              <button
                key={k}
                onClick={() => setCodeLang(k)}
                className={`px-2 py-1 rounded text-xs font-mono ${codeLang === k ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {k}
              </button>
            ))}
          </div>
          <pre className="bg-muted/50 border border-border rounded-md p-3 font-mono text-[11px] overflow-auto max-h-[220px]">
{VERIFY_CODE[codeLang]}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------- JWKS tab ----------
interface JwksKey { kid?: string; kty: string; alg?: string; use?: string; n?: string; e?: string; x?: string; y?: string; crv?: string; [k: string]: any; }

function JwksTab({ shared, setShared }: { shared: SharedState; setShared: (s: Partial<SharedState>) => void }) {
  const [url, setUrl] = useState("");
  const [keys, setKeys] = useState<JwksKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedKid, setSelectedKid] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<"valid" | "invalid" | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchJwks = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(""); setKeys([]); setSelectedKid(null);
    try {
      const res = await fetch(url.trim(), { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      const ks: JwksKey[] = Array.isArray(data.keys) ? data.keys : [];
      if (ks.length === 0) throw new Error("No keys found in JWKS response");
      setKeys(ks);
      toast.success(`Loaded ${ks.length} key${ks.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      setError(e.message || "Fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const selectedKey = keys.find(k => (k.kid ?? keys.indexOf(k).toString()) === selectedKid);

  const verifyWithKey = async () => {
    if (!selectedKey || !shared.activeToken) { toast.error("Load a JWT and select a key first"); return; }
    setVerifying(true); setVerifyResult(null);
    try {
      const alg = (selectedKey.alg || shared.decodedHeader?.alg || "RS256").toUpperCase();
      const jwk = { ...selectedKey } as JsonWebKey;
      const keyUsage: KeyUsage[] = ["verify"];
      let cryptoKey: CryptoKey;
      if (alg.startsWith("RS")) {
        cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${alg.slice(2)}` }, false, keyUsage);
      } else if (alg.startsWith("PS")) {
        cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSA-PSS", hash: `SHA-${alg.slice(2)}` }, false, keyUsage);
      } else if (alg.startsWith("ES")) {
        const namedCurve = alg === "ES384" ? "P-384" : alg === "ES512" ? "P-521" : "P-256";
        cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve }, false, keyUsage);
      } else {
        throw new Error(`Algorithm ${alg} not supported for JWKS verification`);
      }
      const parts = shared.activeToken.split(".");
      const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const sig = toArrayBuffer(base64UrlToBytes(parts[2]));
      let ok: boolean;
      if (alg.startsWith("RS")) ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sig, data);
      else if (alg.startsWith("PS")) ok = await crypto.subtle.verify({ name: "RSA-PSS", saltLength: Number(alg.slice(2)) / 8 }, cryptoKey, sig, data);
      else ok = await crypto.subtle.verify({ name: "ECDSA", hash: `SHA-${alg.slice(2)}` }, cryptoKey, sig, data);
      setVerifyResult(ok ? "valid" : "invalid");
      setShared({ signatureStatus: ok ? "valid" : "invalid" });
      toast[ok ? "success" : "error"](ok ? "Signature valid" : "Signature invalid");
    } catch (e: any) {
      setError(e.message); setVerifyResult("invalid");
    } finally {
      setVerifying(false);
    }
  };

  const WELL_KNOWN_EXAMPLES = [
    { label: "Google", url: "https://www.googleapis.com/oauth2/v3/certs" },
    { label: "Microsoft", url: "https://login.microsoftonline.com/common/discovery/v2.0/keys" },
    { label: "Auth0 (example)", url: "https://<your-domain>.auth0.com/.well-known/jwks.json" },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">JWKS Endpoint URL</Label>
        <div className="flex gap-2">
          <Input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchJwks()} placeholder="https://example.com/.well-known/jwks.json" className="font-mono text-xs h-8 flex-1" />
          <Button size="sm" onClick={fetchJwks} disabled={loading} className="h-8 shrink-0">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5 mr-1" />}
            {loading ? "" : "Fetch"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {WELL_KNOWN_EXAMPLES.map(ex => (
            <button key={ex.label} onClick={() => setUrl(ex.url)} className="text-xs rounded border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">{ex.label}</button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}

      {keys.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Keys ({keys.length})</Label>
          <div className="space-y-1.5 max-h-[300px] overflow-auto">
            {keys.map((k, i) => {
              const id = k.kid ?? i.toString();
              const sel = selectedKid === id;
              return (
                <button key={id} onClick={() => setSelectedKid(sel ? null : id)}
                  className={`w-full text-left rounded-md border p-2.5 text-xs transition-colors ${sel ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-border/80"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">{k.kid ? `kid: ${k.kid}` : `Key ${i + 1}`}</span>
                    {k.kty && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{k.kty}</span>}
                    {k.alg && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{k.alg}</span>}
                    {k.use && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{k.use}</span>}
                    {sel && <span className="ml-auto text-primary text-xs font-medium">Selected ✓</span>}
                  </div>
                  {k.crv && <div className="mt-1 text-muted-foreground">curve: {k.crv}</div>}
                </button>
              );
            })}
          </div>

          {selectedKid !== null && (
            <div className="space-y-2">
              {shared.activeToken ? (
                <>
                  <Button onClick={verifyWithKey} disabled={verifying} className="w-full" size="sm">
                    {verifying ? "Verifying..." : "Verify Token Against Key"}
                  </Button>
                  {verifyResult && (
                    <div className={`flex items-center gap-2 rounded-md border p-2.5 text-sm font-medium ${verifyResult === "valid" ? "bg-green-500/10 border-green-500/40 text-green-400" : "bg-destructive/10 border-destructive/40 text-destructive"}`}>
                      {verifyResult === "valid" ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                      {verifyResult === "valid" ? "Signature valid with selected key" : "Signature invalid with selected key"}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Paste a JWT in the Decode tab, then come back to verify it.</p>
              )}
              <div className="rounded-md border border-border bg-muted/30">
                <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">JWK (public key)</span>
                  <CopyButton value={JSON.stringify(selectedKey, null, 2)} size="sm" />
                </div>
                <pre className="p-3 font-mono text-[11px] text-foreground overflow-auto max-h-[200px]">{JSON.stringify(selectedKey, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {keys.length === 0 && !loading && !error && (
        <p className="text-xs text-muted-foreground py-6 text-center">Enter a JWKS URL and click Fetch to load public keys.</p>
      )}
    </div>
  );
}

// ---------- Shared state ----------
interface SharedState {
  activeToken: string;
  decodedHeader: Record<string, any> | null;
  decodedPayload: Record<string, any> | null;
  signatureStatus: SigStatus;
  hmacSecretLen: number; // length of the entered HMAC secret (0 = unknown / not HMAC)
}

// ---------- Main page ----------
const JwtHub = () => {
  const [shared, setSharedState] = useState<SharedState>({
    activeToken: "",
    decodedHeader: null,
    decodedPayload: null,
    signatureStatus: "unverified",
    hmacSecretLen: 0,
  });
  const setShared = (patch: Partial<SharedState>) =>
    setSharedState(prev => ({ ...prev, ...patch }));

  const security = useMemo(
    () => computeSecurity(shared.decodedHeader, shared.decodedPayload, shared.hmacSecretLen),
    [shared.decodedHeader, shared.decodedPayload, shared.hmacSecretLen]
  );

  return (
    <ToolPageLayout title="JWT Hub" description="Decode, encode and verify JSON Web Tokens · HMAC, RSA, ECDSA">
      <ToolSEO
        title="JWT Hub — Decode, Encode & Verify JSON Web Tokens"
        description="Free browser-based JWT tool. Decode and inspect JWT claims, encode and sign tokens with HS256/RS256, and verify signatures — all client-side, nothing leaves your browser."
        canonicalPath="/jwt"
        keywords={["jwt decoder", "jwt encoder", "json web token", "jwt verify", "hs256", "rs256", "jwt claims", "jwt security"]}
        faq={[
          { question: "What is a JSON Web Token (JWT)?", answer: "A JWT is a compact, URL-safe token format used for authentication and authorization. It has three Base64URL-encoded sections joined by dots: header, payload, and signature." },
          { question: "Can I decode a JWT without knowing the secret?", answer: "Yes. The header and payload are only Base64URL-encoded (not encrypted), so any JWT can be decoded and inspected without a secret. The secret is only required to verify the signature." },
          { question: "How does signature verification work here?", answer: "JWT Hub uses the browser's native Web Crypto API (crypto.subtle) to verify HMAC (HS256/384/512), RSA (RS256/384/512), RSA-PSS (PS256/384/512), and ECDSA (ES256/384) signatures locally. No data is transmitted." },
          { question: "What does the security score check?", answer: "It flags algorithm 'none', weak HS256 secrets (< 32 chars), preference for RS256/ES256 on public APIs, missing exp/iss/sub claims, and overly long expiry windows. Grade ranges from A (best) to F (critical issue)." },
        ]}
        howToSteps={[
          "Paste a JWT in the Decode tab to auto-parse the header and payload",
          "Inspect claims (exp, nbf, iat, iss, aud, sub) in the live validator",
          "Switch to Verify, provide your secret or public key, and confirm the signature",
          "Use Encode to build and sign a new token with HS256/RS256/PS256/ES256 using PEM or JWK keys",
        ]}
      />


      <div className="h-[clamp(500px,calc(100dvh-180px),1000px)]">
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border border-border">
        <ResizablePanel defaultSize={60} minSize={35}>
          <div className="p-4 h-full overflow-auto">
            <Tabs defaultValue="decode" className="space-y-3">
              <TabsList className="h-9">
                <TabsTrigger value="decode" className="text-xs">Decode</TabsTrigger>
                <TabsTrigger value="encode" className="text-xs">Encode</TabsTrigger>
                <TabsTrigger value="verify" className="text-xs">Verify</TabsTrigger>
                <TabsTrigger value="jwks" className="text-xs">JWKS</TabsTrigger>
              </TabsList>
              <TabsContent value="decode"><DecodeTab shared={shared} setShared={setShared} /></TabsContent>
              <TabsContent value="encode"><EncodeTab shared={shared} setShared={setShared} /></TabsContent>
              <TabsContent value="verify"><VerifyTab shared={shared} setShared={setShared} /></TabsContent>
              <TabsContent value="jwks"><JwksTab shared={shared} setShared={setShared} /></TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="p-4 h-full overflow-auto space-y-3">
            <TokenPreview token={shared.activeToken} />
            <SecurityCard result={security} />
            {shared.signatureStatus !== "unverified" && (
              <div className="text-xs text-muted-foreground text-center">
                Signature status: <span className="font-mono text-foreground">{shared.signatureStatus}</span>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      </div>
    </ToolPageLayout>
  );
};

export default JwtHub;
