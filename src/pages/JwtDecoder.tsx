import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Trash2, ShieldCheck, Timer, AlertTriangle } from "lucide-react";
import { PrivacyBadge } from "@/components/json-formatter/PrivacyBadge";
import {
  decodeJwt, formatTimestamp, getTokenStatus, calculateSecurityScore,
  encodeJwt, addToHistory, extractJwtFromInput, DecodedJwt,
} from "@/components/jwt-decoder/jwtUtils";
import { JwtSection } from "@/components/jwt-decoder/JwtSection";
import { SecurityScoreCard } from "@/components/jwt-decoder/SecurityScoreCard";
import { TokenComparison } from "@/components/jwt-decoder/TokenComparison";
import { CodeExamples } from "@/components/jwt-decoder/CodeExamples";
import { TokenHistory } from "@/components/jwt-decoder/TokenHistory";
import { SignatureVerifier } from "@/components/jwt-decoder/SignatureVerifier";
import { ClaimsValidator } from "@/components/jwt-decoder/ClaimsValidator";

const JwtDecoder = () => {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<DecodedJwt | null>(null);
  const [error, setError] = useState("");
  const [autoClear, setAutoClear] = useState(false);
  const autoClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live decode with debounce
  const doDecode = useCallback((raw: string) => {
    if (!raw.trim()) { setResult(null); setError(""); return; }
    try {
      const extracted = extractJwtFromInput(raw);
      const r = decodeJwt(extracted);
      setResult(r);
      setError("");
      addToHistory(extracted, r.payload);
    } catch (e: any) {
      setResult(null);
      setError(e.message);
    }
  }, []);

  const handleTokenChange = (val: string) => {
    setToken(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doDecode(val), 300);
  };

  // Auto-clear after 5 min
  useEffect(() => {
    if (autoClear && result) {
      if (autoClearRef.current) clearTimeout(autoClearRef.current);
      autoClearRef.current = setTimeout(() => {
        setToken(""); setResult(null); setError("");
        toast.info("Token auto-cleared for security");
      }, 5 * 60 * 1000);
    }
    return () => { if (autoClearRef.current) clearTimeout(autoClearRef.current); };
  }, [autoClear, result]);

  const clear = () => { setToken(""); setResult(null); setError(""); };

  const copyFull = () => {
    navigator.clipboard.writeText(token.trim());
    toast.success("Full JWT copied");
  };

  const status = result ? getTokenStatus(result.payload) : null;
  const security = result ? calculateSecurityScore(result.header, result.payload) : null;
  const exp = result?.payload?.exp ? formatTimestamp(result.payload.exp) : null;
  const iat = result?.payload?.iat ? formatTimestamp(result.payload.iat) : null;
  const nbf = result?.payload?.nbf ? formatTimestamp(result.payload.nbf) : null;

  // Editor state
  const [editHeader, setEditHeader] = useState("");
  const [editPayload, setEditPayload] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");

  useEffect(() => {
    if (result) {
      setEditHeader(JSON.stringify(result.header, null, 2));
      setEditPayload(JSON.stringify(result.payload, null, 2));
    }
  }, [result]);

  const regenerate = () => {
    try {
      const h = JSON.parse(editHeader);
      const p = JSON.parse(editPayload);
      const t = encodeJwt(h, p);
      setGeneratedToken(t);
      toast.success("Token regenerated (unsigned)");
    } catch {
      toast.error("Invalid JSON in header or payload");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <ToolSEO
        title="JWT Decoder & Debugger"
        description="Decode, inspect, verify and debug JSON Web Tokens. View header, payload, signature, security score, and expiration. Free client-side JWT tool."
        canonicalPath="/jwt"
        keywords={["JWT decoder", "JWT debugger", "decode JWT online", "JSON Web Token", "JWT verification", "JWT security"]}
        faq={[
          { question: "What is a JWT?", answer: "A JSON Web Token (JWT) is a compact, URL-safe token format used for authentication and authorization. It consists of three parts: header, payload, and signature." },
          { question: "Can this tool verify JWT signatures?", answer: "Yes! This tool supports HMAC signature verification (HS256/384/512) using the Web Crypto API, entirely in your browser." },
          { question: "Is my token data safe?", answer: "Absolutely. All processing happens client-side in your browser. No data is ever sent to any server." },
        ]}
        howToSteps={["Paste your JWT token — it decodes live as you type", "Inspect header, payload, timestamps, and security score", "Verify signatures, compare tokens, or generate code examples"]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-mono font-bold text-foreground">JWT Decoder</h1>
          {status && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${status.color} ${
              status.label === "Expired" ? "border-destructive bg-destructive/10" :
              status.label === "Expiring Soon" ? "border-yellow-500 bg-yellow-500/10" :
              "border-green-500 bg-green-500/10"
            }`}>
              {status.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PrivacyBadge />
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={autoClear} onChange={e => setAutoClear(e.target.checked)} className="w-3 h-3 rounded" />
            Auto-clear (5min)
          </label>
        </div>
      </div>

      {/* Input area */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider flex-1">Paste JWT, Bearer header, or URL with token</label>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={copyFull} disabled={!token}><Copy className="w-3 h-3 mr-1" />Copy</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={clear}><Trash2 className="w-3 h-3 mr-1" />Clear</Button>
        </div>
        <Textarea
          value={token}
          onChange={e => handleTokenChange(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
          className="min-h-[80px] font-mono text-xs bg-card border-border resize-none"
        />
        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
      </div>

      {/* Decoded result */}
      {result && (
        <div className="space-y-4">
          {/* Timestamps row */}
          {(iat || exp || nbf) && (
            <div className="flex flex-wrap gap-3">
              {iat && (
                <div className="rounded-lg border border-border bg-card px-3 py-2 flex-1 min-w-[160px]">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Issued At (iat)</div>
                  <div className="font-mono text-xs text-foreground">{iat.date}</div>
                  <div className="text-[10px] text-muted-foreground">{iat.relative} ago</div>
                </div>
              )}
              {nbf && (
                <div className="rounded-lg border border-border bg-card px-3 py-2 flex-1 min-w-[160px]">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Not Before (nbf)</div>
                  <div className="font-mono text-xs text-foreground">{nbf.date}</div>
                </div>
              )}
              {exp && (
                <div className={`rounded-lg border px-3 py-2 flex-1 min-w-[160px] ${exp.expired ? "border-destructive bg-destructive/10" : exp.expiringSoon ? "border-yellow-500 bg-yellow-500/10" : "border-green-500 bg-green-500/10"}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Expiry (exp)</div>
                  <div className="font-mono text-xs text-foreground">{exp.date}</div>
                  <div className={`text-[10px] font-medium ${exp.expired ? "text-destructive" : exp.expiringSoon ? "text-yellow-500" : "text-green-500"}`}>
                    {exp.expired ? `Expired ${exp.relative} ago` : `Expires in ${exp.relative}`}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main content tabs */}
          <Tabs defaultValue="decode" className="space-y-3">
            <TabsList className="h-8">
              <TabsTrigger value="decode" className="text-xs h-7">Decode</TabsTrigger>
              <TabsTrigger value="verify" className="text-xs h-7">Verify</TabsTrigger>
              <TabsTrigger value="edit" className="text-xs h-7">Edit</TabsTrigger>
              <TabsTrigger value="compare" className="text-xs h-7">Compare</TabsTrigger>
              <TabsTrigger value="validate" className="text-xs h-7">Claims</TabsTrigger>
              <TabsTrigger value="code" className="text-xs h-7">Code</TabsTrigger>
              <TabsTrigger value="history" className="text-xs h-7">History</TabsTrigger>
            </TabsList>

            {/* Decode tab */}
            <TabsContent value="decode" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <JwtSection title="Header" data={result.header} colorClass="text-blue-400" borderClass="border-blue-500/30" />
                <JwtSection title="Payload" data={result.payload} colorClass="text-green-400" borderClass="border-green-500/30" />
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Signature</span>
                    <div className="font-mono text-[10px] text-muted-foreground break-all mt-1">{result.signature}</div>
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] mt-1 px-1" onClick={() => { navigator.clipboard.writeText(result.signature); toast.success("Signature copied"); }}>
                      <Copy className="w-2.5 h-2.5 mr-1" /> Copy
                    </Button>
                  </div>
                  {security && <SecurityScoreCard score={security} />}
                </div>
              </div>
            </TabsContent>

            {/* Verify tab */}
            <TabsContent value="verify">
              <SignatureVerifier token={token.trim()} algorithm={result.header.alg || "unknown"} />
            </TabsContent>

            {/* Edit tab */}
            <TabsContent value="edit" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-blue-400 uppercase tracking-wider font-medium">Header</label>
                  <Textarea value={editHeader} onChange={e => setEditHeader(e.target.value)} className="min-h-[120px] font-mono text-xs bg-card border-blue-500/30 resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-green-400 uppercase tracking-wider font-medium">Payload</label>
                  <Textarea value={editPayload} onChange={e => setEditPayload(e.target.value)} className="min-h-[120px] font-mono text-xs bg-card border-green-500/30 resize-none" />
                </div>
              </div>
              <Button size="sm" onClick={regenerate}>Regenerate Token (unsigned)</Button>
              {generatedToken && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Generated Token</label>
                  <div className="relative">
                    <pre className="bg-muted/50 border border-border rounded-lg p-3 font-mono text-xs break-all">{generatedToken}</pre>
                    <Button variant="ghost" size="icon" className="absolute top-1.5 right-1.5 h-6 w-6" onClick={() => { navigator.clipboard.writeText(generatedToken); toast.success("Token copied"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">⚠ This token has no signature. Sign it server-side before use.</p>
                </div>
              )}
            </TabsContent>

            {/* Compare tab */}
            <TabsContent value="compare">
              <TokenComparison currentToken={token.trim()} />
            </TabsContent>

            {/* Claims validation tab */}
            <TabsContent value="validate">
              <ClaimsValidator payload={result.payload} />
            </TabsContent>

            {/* Code examples tab */}
            <TabsContent value="code">
              <CodeExamples token={token.trim()} />
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history">
              <TokenHistory onSelect={(t) => { setToken(t); doDecode(t); }} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default JwtDecoder;
