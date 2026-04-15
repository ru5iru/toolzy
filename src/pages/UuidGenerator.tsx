import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import {
  generateV1, generateV4, generateV3, generateV5,
  formatUUID, validateUUID, decodeV1,
  NAMESPACES, CODE_SNIPPETS,
  loadUUIDHistory, saveUUIDHistory,
  type UUIDValidation
} from "@/components/uuid/uuidUtils";
import { Check, Clipboard, Copy, Download, History, RotateCcw, X } from "lucide-react";

type Version = "v1" | "v4" | "v3" | "v5";
type ExportFormat = "txt" | "csv" | "json" | "sql";

const UuidGenerator = () => {
  const [version, setVersion] = useState<Version>("v4");
  const [count, setCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [urn, setUrn] = useState(false);
  const [selectedUuids, setSelectedUuids] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Namespace (v3/v5)
  const [nsType, setNsType] = useState<"DNS" | "URL" | "OID" | "X500" | "custom">("DNS");
  const [customNs, setCustomNs] = useState("");
  const [nsName, setNsName] = useState("");

  // Validator
  const [validateInput, setValidateInput] = useState("");
  const [validation, setValidation] = useState<UUIDValidation | null>(null);

  // Decode v1
  const [decodeInput, setDecodeInput] = useState("");
  const [decoded, setDecoded] = useState<{ timestamp: Date; clockSeq: number } | null>(null);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(loadUUIDHistory);

  // Code snippets
  const [snippetLang, setSnippetLang] = useState("JavaScript");

  const generate = useCallback(async () => {
    let results: string[] = [];
    const ns = nsType === "custom" ? customNs : NAMESPACES[nsType];

    for (let i = 0; i < count; i++) {
      if (version === "v1") results.push(generateV1());
      else if (version === "v4") results.push(generateV4());
      else if (version === "v3") results.push(await generateV3(ns, nsName || `name-${i}`));
      else if (version === "v5") results.push(await generateV5(ns, nsName || `name-${i}`));
    }
    setUuids(results);
    setSelectedUuids(new Set());

    saveUUIDHistory({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      version,
      count,
      preview: results[0]
    });
    setHistory(loadUUIDHistory());
  }, [version, count, nsType, customNs, nsName]);

  useEffect(() => { generate(); }, []);

  const formatted = (uuid: string) => formatUUID(uuid, { uppercase, hyphens, braces, urn });

  const copyOne = (uuid: string, idx: number) => {
    navigator.clipboard.writeText(formatted(uuid));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
    toast.success("Copied");
  };

  const copyAll = () => {
    navigator.clipboard.writeText(uuids.map(u => formatted(u)).join("\n"));
    toast.success("All copied");
  };

  const copySelected = () => {
    const sel = uuids.filter((_, i) => selectedUuids.has(i)).map(u => formatted(u));
    navigator.clipboard.writeText(sel.join("\n"));
    toast.success(`${sel.length} copied`);
  };

  const toggleSelect = (i: number) => {
    const next = new Set(selectedUuids);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedUuids(next);
  };

  const exportUuids = (format: ExportFormat) => {
    const data = uuids.map(u => formatted(u));
    let content: string;
    let ext: string;
    switch (format) {
      case "txt": content = data.join("\n"); ext = "txt"; break;
      case "csv": content = "index,uuid\n" + data.map((u, i) => `${i + 1},${u}`).join("\n"); ext = "csv"; break;
      case "json": content = JSON.stringify(data, null, 2); ext = "json"; break;
      case "sql": content = `INSERT INTO table (id) VALUES\n${data.map(u => `  ('${u}')`).join(",\n")};\n`; ext = "sql"; break;
    }
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `uuids.${ext}`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as .${ext}`);
  };

  const handleValidate = () => {
    setValidation(validateUUID(validateInput));
  };

  const handleDecode = () => {
    setDecoded(decodeV1(decodeInput));
  };

  return (
    <div className="space-y-6">
      <ToolSEO
        title="UUID Generator"
        description="Generate UUID v1, v3, v4, v5 in bulk. Validate, decode, format, and export UUIDs. Free browser-only developer tool with no backend."
        canonicalPath="/uuid"
        keywords={["UUID generator", "GUID generator", "UUID v4", "UUID v1", "UUID v5", "bulk UUID", "UUID validator", "generate UUID online"]}
        faq={[
          { question: "What is a UUID?", answer: "A UUID (Universally Unique Identifier) is a 128-bit identifier guaranteed to be unique across space and time. Version 4 UUIDs are randomly generated using cryptographic randomness." },
          { question: "Are UUIDs truly unique?", answer: "UUID v4 uses 122 random bits, giving about 5.3×10^36 possible values. The probability of collision is astronomically low — effectively zero for practical purposes." },
          { question: "Which UUID version should I use?", answer: "Use v4 for random IDs (most common), v1 for timestamp-based ordering, and v5 for deterministic IDs based on namespace + name." },
          { question: "Can UUIDs collide?", answer: "Theoretically yes, but the probability is so low it's considered impossible in practice. You'd need to generate 1 billion UUIDs per second for 86 years to have a 50% chance of one collision." }
        ]}
        howToSteps={[
          "Select UUID version (v1, v3, v4, v5)",
          "Choose quantity (1–10,000)",
          "Click Generate to create UUIDs",
          "Click any UUID to copy, or use Copy All",
          "Export as TXT, CSV, JSON, or SQL"
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">UUID Generator</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate, validate, and decode UUIDs</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <History className="h-4 w-4 mr-1" /> History
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Recent Generations</span>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}><X className="h-3 w-3" /></Button>
          </div>
          {history.map(h => (
            <div key={h.id} className="text-xs text-muted-foreground flex justify-between border-b border-border pb-1">
              <code className="font-mono">{h.preview}</code>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px]">{h.version}</Badge>
                <span>×{h.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="validate">Validate</TabsTrigger>
          <TabsTrigger value="decode">Decode v1</TabsTrigger>
          <TabsTrigger value="snippets">Code Snippets</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-lg p-4 bg-card space-y-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Version</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["v1", "v4", "v3", "v5"] as Version[]).map(v => (
                    <Button key={v} size="sm" variant={version === v ? "default" : "outline"} onClick={() => setVersion(v)}>
                      {v.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                  Count: {count}
                </label>
                <Slider value={[count]} onValueChange={([v]) => setCount(v)} min={1} max={100} step={1} />
                <div className="flex gap-2 mt-2">
                  {[1, 5, 10, 25, 50, 100].map(n => (
                    <Button key={n} size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setCount(n)}>{n}</Button>
                  ))}
                </div>
              </div>

              {(version === "v3" || version === "v5") && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Namespace</label>
                  <div className="flex gap-1 flex-wrap">
                    {(["DNS", "URL", "OID", "X500", "custom"] as const).map(ns => (
                      <Button key={ns} size="sm" variant={nsType === ns ? "default" : "outline"} className="h-7 text-xs" onClick={() => setNsType(ns)}>
                        {ns}
                      </Button>
                    ))}
                  </div>
                  {nsType === "custom" && (
                    <Input value={customNs} onChange={e => setCustomNs(e.target.value)} placeholder="Custom namespace UUID" className="font-mono text-xs h-8" />
                  )}
                  <Input value={nsName} onChange={e => setNsName(e.target.value)} placeholder="Name string" className="font-mono text-xs h-8" />
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg p-4 bg-card space-y-3">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block">Format Options</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Uppercase", checked: uppercase, set: setUppercase },
                  { label: "Hyphens", checked: hyphens, set: setHyphens },
                  { label: "Braces {}", checked: braces, set: setBraces },
                  { label: "URN format", checked: urn, set: setUrn },
                ].map(opt => (
                  <label key={opt.label} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={opt.checked} onChange={e => opt.set(e.target.checked)} className="accent-primary" />
                    {opt.label}
                  </label>
                ))}
              </div>

              <div className="pt-2 border-t border-border">
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Export</label>
                <div className="flex gap-2 flex-wrap">
                  {(["txt", "csv", "json", "sql"] as ExportFormat[]).map(fmt => (
                    <Button key={fmt} size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportUuids(fmt)}>
                      <Download className="h-3 w-3 mr-1" />.{fmt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generate + Copy */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={generate}><RotateCcw className="h-4 w-4 mr-1" /> Generate</Button>
            <Button variant="outline" onClick={copyAll}><Copy className="h-4 w-4 mr-1" /> Copy All</Button>
            {selectedUuids.size > 0 && (
              <Button variant="outline" onClick={copySelected}>
                <Clipboard className="h-4 w-4 mr-1" /> Copy Selected ({selectedUuids.size})
              </Button>
            )}
          </div>

          {/* UUID List */}
          <div className="space-y-1.5">
            {uuids.map((uuid, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-md border px-4 py-2.5 cursor-pointer transition-colors ${
                  selectedUuids.has(i)
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-primary/20"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedUuids.has(i)}
                  onChange={() => toggleSelect(i)}
                  className="accent-primary shrink-0"
                  aria-label={`Select UUID ${i + 1}`}
                />
                <span className="text-xs text-muted-foreground w-6 shrink-0 font-mono">{i + 1}</span>
                <code className="font-mono text-sm text-foreground flex-1 select-all">{formatted(uuid)}</code>
                <Button
                  variant="ghost" size="sm" className="h-7 px-2 shrink-0"
                  onClick={(e) => { e.stopPropagation(); copyOne(uuid, i); }}
                >
                  {copiedIdx === i ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="validate" className="space-y-4">
          <div className="border border-border rounded-lg p-4 bg-card space-y-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Paste a UUID to validate</label>
            <div className="flex gap-2">
              <Input
                value={validateInput}
                onChange={e => setValidateInput(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="font-mono text-sm"
              />
              <Button onClick={handleValidate}>Validate</Button>
            </div>
            {validation && (
              <div className={`rounded-lg p-4 border ${validation.valid ? "border-green-400/20 bg-green-400/5" : "border-red-400/20 bg-red-400/5"}`}>
                {validation.valid ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-400 font-medium text-sm">Valid UUID</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Version:</span> <span className="text-foreground font-mono">{validation.version}</span></div>
                      <div><span className="text-muted-foreground">Variant:</span> <span className="text-foreground font-mono">{validation.variant}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4 text-red-400" />
                    <span className="text-red-400 font-medium text-sm">Invalid UUID format</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="decode" className="space-y-4">
          <div className="border border-border rounded-lg p-4 bg-card space-y-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Paste a v1 UUID to decode timestamp</label>
            <div className="flex gap-2">
              <Input
                value={decodeInput}
                onChange={e => setDecodeInput(e.target.value)}
                placeholder="v1 UUID"
                className="font-mono text-sm"
              />
              <Button onClick={handleDecode}>Decode</Button>
            </div>
            {decoded ? (
              <div className="rounded-lg p-4 border border-primary/20 bg-primary/5 space-y-2">
                <div className="text-sm"><span className="text-muted-foreground">Timestamp:</span> <span className="text-foreground font-mono">{decoded.timestamp.toISOString()}</span></div>
                <div className="text-sm"><span className="text-muted-foreground">Local:</span> <span className="text-foreground font-mono">{decoded.timestamp.toLocaleString()}</span></div>
                <div className="text-sm"><span className="text-muted-foreground">Clock Seq:</span> <span className="text-foreground font-mono">{decoded.clockSeq}</span></div>
              </div>
            ) : decodeInput && (
              <p className="text-xs text-muted-foreground">Only UUID v1 can be decoded (contains embedded timestamp).</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="snippets" className="space-y-4">
          <div className="border border-border rounded-lg p-4 bg-card space-y-3">
            <div className="flex gap-2 flex-wrap">
              {Object.keys(CODE_SNIPPETS).map(lang => (
                <Button key={lang} size="sm" variant={snippetLang === lang ? "default" : "outline"} onClick={() => setSnippetLang(lang)}>
                  {lang}
                </Button>
              ))}
            </div>
            <pre className="bg-background rounded-lg p-4 text-sm font-mono text-foreground overflow-auto">
              <code>{CODE_SNIPPETS[snippetLang].code}</code>
            </pre>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(CODE_SNIPPETS[snippetLang].code); toast.success("Copied"); }}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* SEO Content */}
      <section className="mt-12 space-y-8 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">What is a UUID?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A UUID (Universally Unique Identifier) is a 128-bit identifier standardized by RFC 4122. UUIDs are used
            to uniquely identify resources without requiring a central authority. They're widely used in databases,
            distributed systems, APIs, and session management.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">UUID Version Comparison</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2 text-left text-muted-foreground">Version</th>
                  <th className="px-4 py-2 text-left text-muted-foreground">Method</th>
                  <th className="px-4 py-2 text-left text-muted-foreground">Best For</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                <tr className="border-b border-border"><td className="px-4 py-2">v1</td><td className="px-4 py-2 font-sans">Timestamp + MAC</td><td className="px-4 py-2 font-sans">Time-ordered IDs</td></tr>
                <tr className="border-b border-border"><td className="px-4 py-2">v3</td><td className="px-4 py-2 font-sans">Namespace + MD5</td><td className="px-4 py-2 font-sans">Deterministic IDs</td></tr>
                <tr className="border-b border-border"><td className="px-4 py-2">v4</td><td className="px-4 py-2 font-sans">Random</td><td className="px-4 py-2 font-sans">General purpose (most common)</td></tr>
                <tr><td className="px-4 py-2">v5</td><td className="px-4 py-2 font-sans">Namespace + SHA-1</td><td className="px-4 py-2 font-sans">Deterministic IDs (preferred over v3)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">FAQ</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Are UUIDs truly unique?</h3>
              <p className="text-sm text-muted-foreground">UUID v4 has 122 random bits, giving ~5.3×10³⁶ possible values. The chance of collision is astronomically low — effectively zero for all practical applications.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Which UUID version should I use?</h3>
              <p className="text-sm text-muted-foreground">Use v4 for most cases (random, no information leakage). Use v1 if you need time-ordered IDs. Use v5 for deterministic IDs from a namespace + name.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Can UUIDs be used as database primary keys?</h3>
              <p className="text-sm text-muted-foreground">Yes, UUIDs are widely used as primary keys in distributed databases. They eliminate the need for centralized ID generation but use more storage than auto-increment integers.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UuidGenerator;
