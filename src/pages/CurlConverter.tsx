import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CopyButton } from "@/components/CopyButton";
import { AboutTool } from "@/components/AboutTool";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Terminal, ArrowRight } from "lucide-react";
import { parseCurl } from "@/lib/curlParser";
import { generateCode, toCurl, type Lang } from "@/lib/curlCodegen";

const LANGS: { key: Lang; label: string; ext: string }[] = [
  { key: "python",     label: "Python",     ext: "py"  },
  { key: "javascript", label: "JavaScript", ext: "js"  },
  { key: "go",         label: "Go",         ext: "go"  },
  { key: "php",        label: "PHP",        ext: "php" },
  { key: "ruby",       label: "Ruby",       ext: "rb"  },
];

const EXAMPLES = [
  {
    label: "POST JSON",
    curl: `curl -X POST https://api.example.com/users \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer token123" \\\n  -d '{"name":"Alice","email":"alice@example.com"}'`,
  },
  {
    label: "GET with headers",
    curl: `curl https://api.github.com/repos/octocat/Hello-World \\\n  -H "Accept: application/vnd.github.v3+json" \\\n  -H "Authorization: token ghp_xxx"`,
  },
  {
    label: "Form POST",
    curl: `curl -X POST https://httpbin.org/post \\\n  -d "username=alice&password=secret"`,
  },
  {
    label: "PUT with auth",
    curl: `curl -X PUT https://api.example.com/items/42 \\\n  -u admin:password \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"active"}' \\\n  -L`,
  },
];

const CurlConverter = () => {
  const [curlInput, setCurlInput] = useState("");
  const [lang, setLang] = useState<Lang>("python");

  const parsed = useMemo(() => {
    if (!curlInput.trim()) return null;
    try { return parseCurl(curlInput); } catch { return null; }
  }, [curlInput]);

  const output = useMemo(() => {
    if (!parsed) return "";
    return generateCode(parsed, lang);
  }, [parsed, lang]);

  const normalised = useMemo(() => parsed ? toCurl(parsed) : "", [parsed]);

  const loadExample = (ex: typeof EXAMPLES[0]) => {
    setCurlInput(ex.curl);
    toast.success(`Loaded: ${ex.label}`);
  };

  const methodColor = (m: string) => {
    if (m === "GET")    return "text-green-400";
    if (m === "POST")   return "text-blue-400";
    if (m === "PUT")    return "text-amber-400";
    if (m === "DELETE") return "text-red-400";
    if (m === "PATCH")  return "text-purple-400";
    return "text-foreground";
  };

  return (
    <ToolPageLayout
      title="curl ↔ Code"
      icon={Terminal}
      description="Convert curl commands to Python, JavaScript, Go, PHP, or Ruby — and back to a clean curl."
    >
      <ToolSEO
        title="curl to Code Converter — Python, JS, Go, PHP, Ruby"
        description="Paste a curl command and instantly get equivalent code in Python requests, JavaScript fetch, Go net/http, PHP curl, or Ruby net/http. Free and browser-only."
        canonicalPath="/curl"
        keywords={["curl to python", "curl to javascript", "curl converter", "curl to code", "curl to fetch", "curl to requests"]}
        faq={[
          { question: "What curl flags are supported?", answer: "-X, -H, -d, --data-raw, --data-binary, -F, -u, -k, --compressed, -L, --json, and URL arguments. Unknown flags are silently ignored." },
          { question: "Does this send my request anywhere?", answer: "No. Everything runs in your browser. No request is made to any server." },
          { question: "Can I convert code back to curl?", answer: "The 'Normalised curl' tab shows a cleaned-up version of the parsed curl command with consistent quoting." },
        ]}
        howToSteps={["Paste or type a curl command", "Choose a target language", "Copy the generated code"]}
      />

      {/* Example snippets */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">Examples</span>
        {EXAMPLES.map(ex => (
          <Button key={ex.label} variant="secondary" size="sm" className="h-7 text-xs"
            onClick={() => loadExample(ex)}>{ex.label}</Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Input ── */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">curl command</label>
          <Textarea
            value={curlInput}
            onChange={e => setCurlInput(e.target.value)}
            placeholder={`curl -X POST https://api.example.com/data \\\n  -H "Content-Type: application/json" \\\n  -d '{"key":"value"}'`}
            className="min-h-[220px] font-mono text-sm bg-card border-border resize-y"
            spellCheck={false}
          />
          {curlInput && !parsed && (
            <p className="text-xs text-destructive">Could not parse curl command. Check for syntax errors.</p>
          )}
        </div>

        {/* ── Parsed summary ── */}
        {parsed && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block">Parsed request</span>
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${methodColor(parsed.method)}`}>{parsed.method}</span>
                <span className="text-foreground break-all">{parsed.url}</span>
              </div>
              {Object.keys(parsed.headers).length > 0 && (
                <div className="space-y-0.5">
                  {Object.entries(parsed.headers).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="text-muted-foreground">{k}: </span>
                      <span className="text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {parsed.body && (
                <div className="text-xs text-muted-foreground border-t border-border/40 pt-2 break-all">
                  <span className="text-muted-foreground/60 uppercase text-[10px] block mb-0.5">Body ({parsed.bodyType})</span>
                  {parsed.body.slice(0, 300)}{parsed.body.length > 300 ? "…" : ""}
                </div>
              )}
              <div className="flex gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                {parsed.insecure && <span className="text-amber-400">-k insecure</span>}
                {parsed.compressed && <span>compressed</span>}
                {parsed.followRedirects && <span>follow redirects</span>}
                {parsed.user && <span>basic auth</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {parsed && (
        <>
          {/* Language selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            {LANGS.map(l => (
              <Button key={l.key} variant={lang === l.key ? "selected" : "outline"} size="sm"
                onClick={() => setLang(l.key)}>{l.label}</Button>
            ))}
          </div>

          {/* Output tabs: code + normalised curl */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                {LANGS.find(l => l.key === lang)?.label} · {LANGS.find(l => l.key === lang)?.ext}
              </label>
              <CopyButton value={output} label="Copy" variant="outline" />
            </div>
            <pre className="rounded-lg border border-border bg-card p-4 font-mono text-xs overflow-auto max-h-[500px] whitespace-pre">
              {output}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Normalised curl</label>
              <CopyButton value={normalised} label="Copy" variant="outline" />
            </div>
            <pre className="rounded-lg border border-border bg-card/50 p-4 font-mono text-xs overflow-auto whitespace-pre">
              {normalised}
            </pre>
          </div>
        </>
      )}

      <AboutTool>
        <p>Paste any <code>curl</code> command and this tool parses it into a structured request (method, URL, headers, body, auth) then generates equivalent code in your chosen language — all in the browser with no network calls.</p>
        <p className="mt-2">Supported flags include <code>-X</code>, <code>-H</code>, <code>-d</code> / <code>--data-raw</code> / <code>--data-binary</code>, <code>-F</code> (form), <code>-u</code> (basic auth), <code>-k</code> (insecure), <code>--compressed</code>, <code>-L</code> (follow redirects), and the <code>--json</code> shorthand from curl 7.82+. Multi-line commands using <code>\</code> line continuations are supported.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default CurlConverter;
