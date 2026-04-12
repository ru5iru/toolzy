import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PrivacyBadge } from "@/components/json-formatter/PrivacyBadge";
import { useNavigate } from "react-router-dom";
import {
  Copy, Eye, EyeOff, Clock, ShieldCheck, AlertTriangle, Trash2,
  Plus, Send, BookOpen, Save, History, Code, Zap, Info, ArrowRight,
} from "lucide-react";
import {
  ALGORITHMS, getAlgorithmFamily, signHMAC, signRSA, signECDSA,
  generateUnsigned, assessEncoderSecurity, PAYLOAD_TEMPLATES,
  getPresets, savePreset, deletePreset, getEncoderHistory,
  addEncoderHistory, clearEncoderHistory, generateCodeExamplesForEncoding,
  type AlgorithmFamily, type EncoderPreset, type EncoderHistoryEntry,
} from "@/components/jwt-encoder/encoderUtils";

const DEFAULT_HEADER = JSON.stringify({ alg: "HS256", typ: "JWT" }, null, 2);
const DEFAULT_PAYLOAD = JSON.stringify({
  sub: "1234567890",
  name: "John Doe",
  iat: Math.floor(Date.now() / 1000),
}, null, 2);

const JwtEncoder = () => {
  const navigate = useNavigate();
  const [alg, setAlg] = useState("HS256");
  const [headerStr, setHeaderStr] = useState(DEFAULT_HEADER);
  const [payloadStr, setPayloadStr] = useState(DEFAULT_PAYLOAD);
  const [secret, setSecret] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [generating, setGenerating] = useState(false);
  const [headerError, setHeaderError] = useState("");
  const [payloadError, setPayloadError] = useState("");
  const [autoClear, setAutoClear] = useState(false);
  const [presetName, setPresetName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const family = getAlgorithmFamily(alg);

  // Validate JSON
  const parsedHeader = useMemo(() => {
    try { const h = JSON.parse(headerStr); setHeaderError(""); return h; }
    catch { setHeaderError("Invalid JSON"); return null; }
  }, [headerStr]);

  const parsedPayload = useMemo(() => {
    try { const p = JSON.parse(payloadStr); setPayloadError(""); return p; }
    catch { setPayloadError("Invalid JSON"); return null; }
  }, [payloadStr]);

  // Security score
  const security = useMemo(() => {
    if (!parsedPayload) return null;
    return assessEncoderSecurity(alg, parsedPayload, family === "HMAC" ? secret : "key-provided", family);
  }, [alg, parsedPayload, secret, family]);

  // Sync header alg when dropdown changes
  useEffect(() => {
    try {
      const h = JSON.parse(headerStr);
      if (h.alg !== alg) {
        h.alg = alg;
        setHeaderStr(JSON.stringify(h, null, 2));
      }
    } catch { /* ignore */ }
  }, [alg]);

  // Auto-generate with debounce
  const doGenerate = useCallback(async () => {
    if (!parsedHeader || !parsedPayload) return;
    const keyOrSecret = family === "HMAC" ? secret : privateKey;
    if (!keyOrSecret) {
      setGeneratedToken(generateUnsigned(JSON.stringify(parsedHeader), JSON.stringify(parsedPayload)));
      return;
    }
    setGenerating(true);
    try {
      const algOpt = ALGORITHMS.find(a => a.value === alg);
      if (!algOpt) throw new Error("Unsupported algorithm");
      const headerJson = JSON.stringify(parsedHeader);
      const payloadJson = JSON.stringify(parsedPayload);
      let token: string;
      if (family === "HMAC") {
        token = await signHMAC(headerJson, payloadJson, secret, algOpt.webCryptoAlg);
      } else if (family === "RSA") {
        token = await signRSA(headerJson, payloadJson, privateKey, algOpt.webCryptoAlg);
      } else {
        token = await signECDSA(headerJson, payloadJson, privateKey, algOpt.webCryptoAlg, alg);
      }
      setGeneratedToken(token);
      addEncoderHistory(token, alg, parsedPayload);
    } catch (e: any) {
      toast.error(e.message || "Signing failed");
      setGeneratedToken(generateUnsigned(JSON.stringify(parsedHeader), JSON.stringify(parsedPayload)));
    } finally {
      setGenerating(false);
    }
  }, [parsedHeader, parsedPayload, alg, secret, privateKey, family]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doGenerate, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [doGenerate]);

  // Auto-clear
  useEffect(() => {
    if (autoClear && generatedToken) {
      if (autoClearRef.current) clearTimeout(autoClearRef.current);
      autoClearRef.current = setTimeout(() => {
        setSecret(""); setPrivateKey(""); setGeneratedToken("");
        toast.info("Inputs auto-cleared for security");
      }, 5 * 60 * 1000);
    }
    return () => { if (autoClearRef.current) clearTimeout(autoClearRef.current); };
  }, [autoClear, generatedToken]);

  // Timestamp helpers
  const addClaim = (key: string, value: number) => {
    try {
      const p = JSON.parse(payloadStr);
      p[key] = value;
      setPayloadStr(JSON.stringify(p, null, 2));
      toast.success(`Added ${key}`);
    } catch { toast.error("Fix payload JSON first"); }
  };

  const now = () => Math.floor(Date.now() / 1000);

  // Template
  const applyTemplate = (name: string) => {
    const tpl = PAYLOAD_TEMPLATES[name];
    if (tpl) {
      // Refresh timestamps
      const fresh: Record<string, any> = { ...tpl, iat: now() };
      if (tpl.exp) fresh.exp = now() + ((tpl.exp as number) - (tpl.iat as number));
      setPayloadStr(JSON.stringify(fresh, null, 2));
      toast.success(`Applied "${name}" template`);
    }
  };

  // Presets
  const [presets, setPresets] = useState<EncoderPreset[]>(getPresets());
  const handleSavePreset = () => {
    if (!presetName.trim()) { toast.error("Enter a preset name"); return; }
    savePreset({ name: presetName.trim(), alg, header: headerStr, payload: payloadStr, timestamp: Date.now() });
    setPresets(getPresets());
    setPresetName("");
    toast.success("Preset saved");
  };
  const handleLoadPreset = (p: EncoderPreset) => {
    setAlg(p.alg);
    setHeaderStr(p.header);
    setPayloadStr(p.payload);
    toast.success(`Loaded "${p.name}"`);
  };

  // History
  const [history, setHistory] = useState<EncoderHistoryEntry[]>(getEncoderHistory());
  const refreshHistory = () => setHistory(getEncoderHistory());

  // Copy helpers
  const copyToken = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    toast.success("JWT copied");
  };

  // Token parts for display
  const tokenParts = generatedToken.split(".");

  // Send to decoder
  const sendToDecoder = () => {
    if (!generatedToken) return;
    navigate(`/jwt?token=${encodeURIComponent(generatedToken)}`);
  };

  // Simulate invalid tokens
  const tamperPayload = () => {
    if (!generatedToken || tokenParts.length < 3) return;
    const tampered = `${tokenParts[0]}.${tokenParts[1]}x.${tokenParts[2]}`;
    navigator.clipboard.writeText(tampered);
    toast.success("Tampered token copied (payload modified)");
  };

  const removeSignature = () => {
    if (!generatedToken || tokenParts.length < 3) return;
    const unsigned = `${tokenParts[0]}.${tokenParts[1]}.`;
    navigator.clipboard.writeText(unsigned);
    toast.success("Unsigned token copied (signature removed)");
  };

  // Code examples
  const codeExamples = generateCodeExamplesForEncoding(alg, payloadStr);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <ToolSEO
        title="JWT Encoder & Token Generator"
        description="Generate and sign JSON Web Tokens with HMAC, RSA, or ECDSA. Build JWTs for API testing, debugging, and development. Free client-side JWT encoder."
        canonicalPath="/jwt-encoder"
        keywords={["JWT encoder", "JWT generator", "create JWT", "sign JWT", "JSON Web Token generator", "JWT builder"]}
        faq={[
          { question: "How do I create a JWT?", answer: "Enter your header and payload JSON, select a signing algorithm, provide a secret or private key, and the JWT is generated instantly in your browser." },
          { question: "Is my secret key safe?", answer: "Yes. All signing happens client-side using the Web Crypto API. No data is ever sent to any server." },
          { question: "What algorithms are supported?", answer: "HMAC (HS256/384/512), RSA (RS256/384/512), and ECDSA (ES256/384) are all supported." },
        ]}
        howToSteps={["Select a signing algorithm", "Edit the header and payload JSON", "Enter your secret or private key", "Copy the generated JWT or send it to the decoder"]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-mono font-bold text-foreground">JWT Encoder</h1>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => navigate("/jwt")}>
            <ArrowRight className="w-3 h-3" /> Decoder
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <PrivacyBadge />
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={autoClear} onChange={e => setAutoClear(e.target.checked)} className="w-3 h-3 rounded" />
            Auto-clear (5min)
          </label>
        </div>
      </div>

      {/* Algorithm selector + Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Algorithm</Label>
          <Select value={alg} onValueChange={setAlg}>
            <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALGORITHMS.map(a => (
                <SelectItem key={a.value} value={a.value} className="text-xs">
                  {a.label} <span className="text-muted-foreground ml-1">({a.family})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Timestamp helpers */}
        <Tooltip><TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addClaim("iat", now())}>
            <Clock className="w-3 h-3" /> +iat
          </Button>
        </TooltipTrigger><TooltipContent className="text-xs">Add current timestamp as iat</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addClaim("exp", now() + 900)}>
            <Clock className="w-3 h-3" /> +15m
          </Button>
        </TooltipTrigger><TooltipContent className="text-xs">Set exp to +15 minutes</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addClaim("exp", now() + 3600)}>
            <Clock className="w-3 h-3" /> +1h
          </Button>
        </TooltipTrigger><TooltipContent className="text-xs">Set exp to +1 hour</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addClaim("nbf", now())}>
            <Clock className="w-3 h-3" /> +nbf
          </Button>
        </TooltipTrigger><TooltipContent className="text-xs">Add nbf (not before) as now</TooltipContent></Tooltip>

        <div className="h-4 w-px bg-border" />

        {/* Templates */}
        <Select onValueChange={applyTemplate}>
          <SelectTrigger className="w-[130px] h-7 text-[10px]"><SelectValue placeholder="Templates" /></SelectTrigger>
          <SelectContent>
            {Object.keys(PAYLOAD_TEMPLATES).map(name => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main grid: Header + Payload + Secret/Key */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-blue-400 uppercase tracking-wider font-medium flex items-center gap-1">
              Header
              <Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="text-xs max-w-[200px]">JWT header specifies the algorithm and token type</TooltipContent></Tooltip>
            </Label>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => {
              navigator.clipboard.writeText(headerStr); toast.success("Header copied");
            }}><Copy className="w-2.5 h-2.5 mr-1" />Copy</Button>
          </div>
          <Textarea
            value={headerStr}
            onChange={e => setHeaderStr(e.target.value)}
            className={`min-h-[120px] font-mono text-xs bg-card resize-none ${headerError ? "border-destructive" : "border-blue-500/30"}`}
          />
          {headerError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{headerError}</p>}
        </div>

        {/* Payload */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-green-400 uppercase tracking-wider font-medium flex items-center gap-1">
              Payload
              <Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="text-xs max-w-[200px]">Claims like sub, exp, iss, aud go here</TooltipContent></Tooltip>
            </Label>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => {
              navigator.clipboard.writeText(payloadStr); toast.success("Payload copied");
            }}><Copy className="w-2.5 h-2.5 mr-1" />Copy</Button>
          </div>
          <Textarea
            value={payloadStr}
            onChange={e => setPayloadStr(e.target.value)}
            className={`min-h-[120px] font-mono text-xs bg-card resize-none ${payloadError ? "border-destructive" : "border-green-500/30"}`}
          />
          {payloadError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{payloadError}</p>}
        </div>
      </div>

      {/* Secret / Private Key */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {family === "HMAC" ? "Secret" : "Private Key (PEM)"}
        </Label>
        {family === "HMAC" ? (
          <div className="relative">
            <Input
              type={showSecret ? "text" : "password"}
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Enter HMAC secret..."
              className="font-mono text-xs pr-9 h-8"
            />
            <Button
              variant="ghost" size="icon"
              className="absolute right-0.5 top-0.5 h-7 w-7"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        ) : (
          <Textarea
            value={privateKey}
            onChange={e => setPrivateKey(e.target.value)}
            placeholder={`-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`}
            className="min-h-[100px] font-mono text-[10px] bg-card resize-none"
          />
        )}
        {family === "HMAC" && secret && secret.length < 16 && (
          <p className="text-[10px] text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Weak secret — use 16+ characters</p>
        )}
      </div>

      {/* Generated Token Output */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Generated JWT {generating && <span className="text-primary animate-pulse ml-1">signing...</span>}
          </Label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={copyToken} disabled={!generatedToken}>
              <Copy className="w-3 h-3" />Copy
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={sendToDecoder} disabled={!generatedToken}>
              <Send className="w-3 h-3" />Decode
            </Button>
          </div>
        </div>
        {generatedToken ? (
          <div className="bg-muted/50 border border-border rounded-lg p-3 font-mono text-xs break-all leading-relaxed">
            <span className="text-blue-400">{tokenParts[0]}</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-green-400">{tokenParts[1]}</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-muted-foreground">{tokenParts[2] || <span className="italic">no signature</span>}</span>
          </div>
        ) : (
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground italic">
            Token will appear here as you type...
          </div>
        )}
        {generatedToken && !tokenParts[2] && (
          <p className="text-[10px] text-yellow-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Token is unsigned — provide a secret/key to sign</p>
        )}
      </div>

      {/* Security Score */}
      {security && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Security Score</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${security.color}`}>{security.score}/100</span>
              <span className={`text-xs ${security.color}`}>{security.label}</span>
            </div>
          </div>
          {security.issues.length > 0 && (
            <div className="space-y-1">
              {security.issues.map((issue, i) => (
                <div key={i} className={`text-[10px] flex items-center gap-1.5 ${
                  issue.severity === "critical" ? "text-destructive" :
                  issue.severity === "warning" ? "text-yellow-500" : "text-muted-foreground"
                }`}>
                  {issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵"} {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs: Advanced, Code, Presets, History */}
      <Tabs defaultValue="advanced" className="space-y-3">
        <TabsList className="h-8">
          <TabsTrigger value="advanced" className="text-xs h-7"><Zap className="w-3 h-3 mr-1" />Advanced</TabsTrigger>
          <TabsTrigger value="code" className="text-xs h-7"><Code className="w-3 h-3 mr-1" />Code</TabsTrigger>
          <TabsTrigger value="presets" className="text-xs h-7"><Save className="w-3 h-3 mr-1" />Presets</TabsTrigger>
          <TabsTrigger value="history" className="text-xs h-7"><History className="w-3 h-3 mr-1" />History</TabsTrigger>
        </TabsList>

        {/* Advanced: Simulate invalid tokens */}
        <TabsContent value="advanced" className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <h3 className="text-xs font-medium text-foreground">Simulate Invalid Tokens</h3>
            <p className="text-[10px] text-muted-foreground">Test how your API handles tampered or unsigned tokens.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={tamperPayload} disabled={!generatedToken}>
                Tamper Payload
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={removeSignature} disabled={!generatedToken}>
                Remove Signature
              </Button>
            </div>
          </div>

          {/* Timestamp preview */}
          {parsedPayload && (parsedPayload.iat || parsedPayload.exp || parsedPayload.nbf) && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <h3 className="text-xs font-medium text-foreground">Timestamp Preview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {parsedPayload.iat && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">iat:</span>{" "}
                    <span className="text-foreground font-mono">{new Date(parsedPayload.iat * 1000).toISOString()}</span>
                  </div>
                )}
                {parsedPayload.exp && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">exp:</span>{" "}
                    <span className="text-foreground font-mono">{new Date(parsedPayload.exp * 1000).toISOString()}</span>
                    {parsedPayload.exp * 1000 < Date.now() && <span className="text-destructive ml-1">(expired)</span>}
                  </div>
                )}
                {parsedPayload.nbf && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">nbf:</span>{" "}
                    <span className="text-foreground font-mono">{new Date(parsedPayload.nbf * 1000).toISOString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Code examples */}
        <TabsContent value="code" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(codeExamples).map(([lang, code]) => (
              <div key={lang} className="rounded-lg border border-border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground capitalize">{lang}</span>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => {
                    navigator.clipboard.writeText(code); toast.success(`${lang} code copied`);
                  }}><Copy className="w-2.5 h-2.5 mr-1" />Copy</Button>
                </div>
                <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">{code}</pre>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Presets */}
        <TabsContent value="presets" className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="Preset name (e.g. Dev, QA, Prod)"
              className="h-7 text-xs flex-1"
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleSavePreset}><Save className="w-3 h-3 mr-1" />Save</Button>
          </div>
          {presets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No presets saved yet. Save your current configuration above.</p>
          ) : (
            <div className="space-y-2">
              {presets.map(p => (
                <div key={p.name} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <div>
                    <span className="text-xs font-medium text-foreground">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{p.alg} · {new Date(p.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleLoadPreset(p)}>Load</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => {
                      deletePreset(p.name); setPresets(getPresets()); toast.success("Preset deleted");
                    }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{history.length} token(s) generated</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => {
              clearEncoderHistory(); refreshHistory(); toast.success("History cleared");
            }}><Trash2 className="w-3 h-3 mr-1" />Clear</Button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tokens generated yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{h.label}</span>
                    <span className="text-[10px] text-muted-foreground">{h.alg} · {new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">{h.token}</div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => {
                      navigator.clipboard.writeText(h.token); toast.success("Token copied");
                    }}><Copy className="w-2.5 h-2.5 mr-1" />Copy</Button>
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => {
                      navigate(`/jwt?token=${encodeURIComponent(h.token)}`);
                    }}><Send className="w-2.5 h-2.5 mr-1" />Decode</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default JwtEncoder;
