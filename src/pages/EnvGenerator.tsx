import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { CopyButton } from "@/components/CopyButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { envToJson, jsonToEnv, parseEnv, toExample } from "@/lib/env/envUtils";

// ─── .env diff logic ──────────────────────────────────────────────────────────
interface EnvEntry { key: string; value: string; }
type DiffKind = "added" | "removed" | "changed" | "unchanged";
interface DiffRow { key: string; kind: DiffKind; before?: string; after?: string; }

function parseEnvPairs(text: string): EnvEntry[] {
  return text.split("\n").flatMap((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return [];
    const eq = t.indexOf("=");
    if (eq < 0) return [];
    return [{ key: t.slice(0, eq).trim(), value: t.slice(eq + 1).trim() }];
  });
}

function diffEnv(before: string, after: string): DiffRow[] {
  const aMap = new Map(parseEnvPairs(before).map((e) => [e.key, e.value]));
  const bMap = new Map(parseEnvPairs(after).map((e) => [e.key, e.value]));
  const rows: DiffRow[] = [];
  // removed or changed
  aMap.forEach((aVal, key) => {
    if (!bMap.has(key)) rows.push({ key, kind: "removed", before: aVal });
    else if (bMap.get(key) !== aVal) rows.push({ key, kind: "changed", before: aVal, after: bMap.get(key) });
    else rows.push({ key, kind: "unchanged", before: aVal, after: aVal });
  });
  // added
  bMap.forEach((bVal, key) => {
    if (!aMap.has(key)) rows.push({ key, kind: "added", after: bVal });
  });
  rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
  return rows;
}

const DIFF_STYLES: Record<DiffKind, { badge: string; row: string }> = {
  added:     { badge: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30", row: "bg-[hsl(var(--success))]/5" },
  removed:   { badge: "bg-destructive/10 text-destructive border-destructive/30", row: "bg-destructive/5" },
  changed:   { badge: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30", row: "bg-[hsl(var(--warning))]/5" },
  unchanged: { badge: "bg-muted text-muted-foreground border-transparent", row: "" },
};

const templates: Record<string, string> = {
  Node: `NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug`,
  Laravel: `APP_NAME=Laravel
APP_ENV=local
APP_KEY=base64:generated-key-here
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=smtp
MAIL_HOST=mailhog
MAIL_PORT=1025`,
  "Spring Boot": `SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mydb
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=password
SPRING_JPA_HIBERNATE_DDL_AUTO=update
SPRING_JPA_SHOW_SQL=true
JWT_SECRET=your-secret-key
JWT_EXPIRATION=86400000`,
  "React (Vite)": `VITE_API_URL=http://localhost:3000/api
VITE_APP_TITLE=My App
VITE_ENABLE_ANALYTICS=false`,
  Django: `DEBUG=True
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`,
};

/** Keys whose values should be masked when secret-masking is on. */
const SECRET_PATTERN = /SECRET|KEY|TOKEN|PASSWORD|PASS|PRIVATE|CREDENTIAL|AUTH|API_/i;

/** Mask secret values in .env content for display. */
function maskSecrets(text: string): string {
  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    const eq = t.indexOf("=");
    if (eq < 0) return line;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (SECRET_PATTERN.test(key) && val) {
      return `${key}=${"*".repeat(Math.min(val.length, 12))}`;
    }
    return line;
  }).join("\n");
}

const EnvGenerator = () => {
  const [content, setContent] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [maskMode, setMaskMode] = useState(false);

  // Diff state
  const [diffA, setDiffA] = useState("");
  const [diffB, setDiffB] = useState("");
  const diffRows = useMemo(() => (diffA || diffB) ? diffEnv(diffA, diffB) : [], [diffA, diffB]);
  const diffSummary = useMemo(() => ({
    added: diffRows.filter((r) => r.kind === "added").length,
    removed: diffRows.filter((r) => r.kind === "removed").length,
    changed: diffRows.filter((r) => r.kind === "changed").length,
    unchanged: diffRows.filter((r) => r.kind === "unchanged").length,
  }), [diffRows]);

  const loadTemplate = (name: string) => {
    setContent(templates[name]);
    toast.success(`Loaded ${name} template`);
  };

  const addVar = () => {
    if (!newKey.trim()) return;
    const line = `${newKey.trim().toUpperCase()}=${newVal}`;
    setContent((prev) => (prev ? prev + "\n" + line : line));
    setNewKey("");
    setNewVal("");
    toast.success("Variable added");
  };

  const displayContent = maskMode ? maskSecrets(content) : content;

  const issues = useMemo(() => parseEnv(content).issues, [content]);
  const convert = (fn: () => string, done: string) => {
    try { setContent(fn()); toast.success(done); } catch (e) { toast.error(e instanceof Error ? e.message : "Conversion failed"); }
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded .env file");
  };

  return (
    <ToolPageLayout title="Environment Generator" description="Build and validate .env files from templates · Compare .env files side-by-side">
      <ToolSEO title="Environment File Generator" description="Build .env configuration files with pre-built templates for Node.js, Laravel, Spring Boot, React, and Django. Compare two .env files with key-level diff." canonicalPath="/env" keywords={[".env generator", "environment variables", "dotenv builder", "env file template", "config generator", ".env diff"]} faq={[{question:"What .env templates are available?",answer:"Templates for Node.js, Laravel, Spring Boot, React, and Django with common environment variables pre-filled."},{question:"Can I add custom variables?",answer:"Yes. Add custom key-value pairs using the form below the template selector, or edit the textarea directly."},{question:"Is my configuration data uploaded anywhere?",answer:"No. The .env file is built entirely in your browser — secrets and values never leave your machine."},{question:"How does the .env diff work?",answer:"Paste two .env files and the diff compares them key-by-key, showing added, removed, changed, and unchanged variables."}]} howToSteps={["Select a template (Node, Laravel, Spring Boot, React, Django)","Add custom variables using the key-value form","Copy to clipboard or download as a .env file","Use the Diff tab to compare two .env files"]} />

      <Tabs defaultValue="build" className="w-full">
        <TabsList>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="diff">Diff</TabsTrigger>
        </TabsList>

        {/* ── Build tab ── */}
        <TabsContent value="build" className="space-y-4 mt-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Templates</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(templates).map((t) => (
                <Button key={t} variant="secondary" size="sm" onClick={() => loadTemplate(t)}>{t}</Button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Key</label>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="MY_VAR" className="w-40 bg-card border-border font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Value</label>
              <Input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVar(); } }}
                placeholder="value (Enter to add)"
                className="w-56 bg-card border-border font-mono"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addVar}>Add</Button>
          </div>
          <div className="relative">
            <Textarea
              value={displayContent}
              onChange={(e) => { if (!maskMode) setContent(e.target.value); }}
              readOnly={maskMode}
              placeholder="KEY=value"
              className="code-surface h-[clamp(240px,calc(100dvh-420px),800px)] resize-y bg-card"
            />
            {content && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-70 hover:opacity-100"
                aria-label={maskMode ? "Show secret values" : "Mask secret values"}
                onClick={() => setMaskMode((v) => !v)}
                title={maskMode ? "Show secret values" : "Mask values matching SECRET/KEY/TOKEN/PASSWORD"}
              >
                {maskMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <CopyButton value={content} label="Copy" variant="default" disabled={!content} />
            <Button variant="secondary" size="sm" onClick={download} disabled={!content}>Download .env</Button>
            <span className="mx-1 hidden w-px bg-border sm:block" aria-hidden />
            <Button variant="outline" size="sm" disabled={!content} onClick={() => convert(() => toExample(content), "Secret values cleared")} title="Blank secrets, tokens and URLs with credentials">Make .env.example</Button>
            <Button variant="outline" size="sm" disabled={!content} onClick={() => convert(() => envToJson(content), "Converted to JSON")}>To JSON</Button>
            <Button variant="outline" size="sm" disabled={!content} onClick={() => convert(() => jsonToEnv(content), "Converted to .env")}>From JSON</Button>
          </div>
          {issues.length > 0 && (
            <ul role="status" className="space-y-0.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {issues.slice(0, 6).map((i) => <li key={i}>{i}</li>)}
              {issues.length > 6 && <li>…and {issues.length - 6} more</li>}
            </ul>
          )}
        </TabsContent>

        {/* ── Diff tab ── */}
        <TabsContent value="diff" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block">Before</label>
              <Textarea
                value={diffA}
                onChange={(e) => setDiffA(e.target.value)}
                placeholder={"KEY=old_value\nDB_HOST=localhost"}
                className="code-surface h-56 resize-y bg-card font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block">After</label>
              <Textarea
                value={diffB}
                onChange={(e) => setDiffB(e.target.value)}
                placeholder={"KEY=new_value\nDB_HOST=db.prod.example.com"}
                className="code-surface h-56 resize-y bg-card font-mono text-sm"
              />
            </div>
          </div>

          {diffRows.length > 0 && (
            <div className="space-y-3">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                {diffSummary.added > 0 && (
                  <Badge variant="outline" className={DIFF_STYLES.added.badge}>+{diffSummary.added} added</Badge>
                )}
                {diffSummary.removed > 0 && (
                  <Badge variant="outline" className={DIFF_STYLES.removed.badge}>−{diffSummary.removed} removed</Badge>
                )}
                {diffSummary.changed > 0 && (
                  <Badge variant="outline" className={DIFF_STYLES.changed.badge}>~ {diffSummary.changed} changed</Badge>
                )}
                {diffSummary.unchanged > 0 && (
                  <Badge variant="outline" className={DIFF_STYLES.unchanged.badge}>{diffSummary.unchanged} unchanged</Badge>
                )}
              </div>

              {/* Diff table */}
              <div className="rounded-md border border-border overflow-hidden text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium w-8">Status</th>
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Key</th>
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Before</th>
                      <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffRows.map((row) => (
                      <tr key={row.key} className={`border-b border-border last:border-0 ${DIFF_STYLES[row.kind].row}`}>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${DIFF_STYLES[row.kind].badge}`}>
                            {row.kind === "added" ? "+" : row.kind === "removed" ? "−" : row.kind === "changed" ? "~" : "="}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs font-medium">{row.key}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                          {row.kind === "added" ? <span className="italic opacity-50">—</span> : row.before}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs max-w-[200px] truncate">
                          {row.kind === "removed" ? <span className="italic opacity-50">—</span> : row.after}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(diffA || diffB) && diffRows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No parseable key=value pairs found.</p>
          )}
        </TabsContent>
      </Tabs>
    </ToolPageLayout>
  );
};

export default EnvGenerator;
