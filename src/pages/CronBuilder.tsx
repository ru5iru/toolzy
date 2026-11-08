import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { AboutTool } from "@/components/AboutTool";
import cronstrue from "cronstrue";

type Platform = "standard" | "aws" | "github";

const FIELD_DEFS = [
  { name: "minute",     label: "Minute",      min: 0, max: 59, placeholder: "0-59, */5, 0,30" },
  { name: "hour",       label: "Hour",        min: 0, max: 23, placeholder: "0-23, */2, 9-17" },
  { name: "dayOfMonth", label: "Day of Month",min: 1, max: 31, placeholder: "1-31, */7, 1,15" },
  { name: "month",      label: "Month",       min: 1, max: 12, placeholder: "1-12, */3, 1,7" },
  { name: "dayOfWeek",  label: "Day of Week", min: 0, max: 7,  placeholder: "0-7, 1-5, MON-FRI" },
] as const;

type FieldName = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

const PRESETS: { label: string; expr: string; note?: string }[] = [
  { label: "Every minute",         expr: "* * * * *" },
  { label: "Every 5 minutes",      expr: "*/5 * * * *" },
  { label: "Every hour",           expr: "0 * * * *" },
  { label: "Every day at midnight",expr: "0 0 * * *" },
  { label: "Every day at noon",    expr: "0 12 * * *" },
  { label: "Weekdays at 9 AM",     expr: "0 9 * * 1-5" },
  { label: "Mondays at 9 AM",      expr: "0 9 * * 1" },
  { label: "Every Sunday midnight",expr: "0 0 * * 0" },
  { label: "1st of every month",   expr: "0 0 1 * *" },
  { label: "Every 15 minutes",     expr: "*/15 * * * *" },
  { label: "Twice a day",          expr: "0 0,12 * * *" },
  { label: "Every 30 minutes, 9-5",expr: "*/30 9-17 * * 1-5" },
];

function parseExpr(expr: string): Record<FieldName, string> | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return {
    minute:     parts[0],
    hour:       parts[1],
    dayOfMonth: parts[2],
    month:      parts[3],
    dayOfWeek:  parts[4],
  };
}

function fieldsToExpr(f: Record<FieldName, string>): string {
  return `${f.minute} ${f.hour} ${f.dayOfMonth} ${f.month} ${f.dayOfWeek}`;
}

function toGitHubActions(expr: string): string {
  // GitHub Actions cron is the same 5-field format
  return expr;
}

function toAWSEventBridge(expr: string): string {
  // AWS uses: minute hour day-of-month month day-of-week year
  // day-of-week: ? means "no value"; either DOM or DOW must be ?
  const parts = expr.split(/\s+/);
  if (parts.length !== 5) return expr;
  let [min, hr, dom, mon, dow] = parts;
  // If both dom and dow are *, set one to ?
  if (dom === "*" && dow === "*") dom = "?";
  else if (dom !== "*" && dow === "*") dow = "?";
  else if (dom === "*" && dow !== "*") dom = "?";
  return `cron(${min} ${hr} ${dom} ${mon} ${dow} *)`;
}

/** Compute next N run times from now */
function getNextRuns(expr: string, count = 10): string[] {
  try {
    cronstrue.toString(expr); // throws if invalid
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return [];
    const [minPart, hrPart, domPart, monPart, dowPart] = parts;

    // Simple next-run generator for standard cron patterns
    // We'll iterate over the next 525,600 minutes (1 year) max
    const now = new Date();
    const results: string[] = [];
    const start = new Date(now);
    start.setSeconds(0, 0);
    start.setMinutes(start.getMinutes() + 1); // start from next minute

    for (let i = 0; i < 525600 && results.length < count; i++) {
      const d = new Date(start.getTime() + i * 60000);
      if (matchesCron(d, parts)) {
        results.push(formatDate(d));
      }
    }
    return results;
  } catch {
    return [];
  }
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (part.startsWith("*/")) {
      const step = parseInt(part.slice(2));
      if (!isNaN(step) && (value - min) % step === 0) return true;
    } else if (part.includes("/")) {
      const [rangeStr, stepStr] = part.split("/");
      const step = parseInt(stepStr);
      let lo = min, hi = max;
      if (rangeStr !== "*" && rangeStr.includes("-")) {
        [lo, hi] = rangeStr.split("-").map(Number);
      } else if (rangeStr !== "*") {
        lo = parseInt(rangeStr);
      }
      if (!isNaN(step) && value >= lo && value <= hi && (value - lo) % step === 0) return true;
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (value >= lo && value <= hi) return true;
    } else {
      if (parseInt(part) === value) return true;
    }
  }
  return false;
}

function matchesCron(d: Date, parts: string[]): boolean {
  const [minP, hrP, domP, monP, dowP] = parts;
  const dow = d.getDay(); // 0=Sunday
  return (
    matchField(minP, d.getMinutes(), 0, 59) &&
    matchField(hrP,  d.getHours(),   0, 23) &&
    matchField(domP, d.getDate(),    1, 31) &&
    matchField(monP, d.getMonth() + 1, 1, 12) &&
    (matchField(dowP, dow, 0, 7) || matchField(dowP, dow === 0 ? 7 : dow, 0, 7))
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

const FIELD_NAMES: FieldName[] = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

const CronBuilder = () => {
  const [fields, setFields] = useState<Record<FieldName, string>>({
    minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1-5",
  });
  const [rawExpr, setRawExpr] = useState("");
  const [platform, setPlatform] = useState<Platform>("standard");

  const expr = useMemo(() => fieldsToExpr(fields), [fields]);

  const description = useMemo(() => {
    try { return cronstrue.toString(expr); } catch { return null; }
  }, [expr]);

  const nextRuns = useMemo(() => getNextRuns(expr), [expr]);

  const isValid = description !== null;

  const handleFieldChange = (name: FieldName, val: string) => {
    setFields((f) => ({ ...f, [name]: val || "*" }));
  };

  const handleRawApply = () => {
    const parsed = parseExpr(rawExpr);
    if (!parsed) { toast.error("Invalid expression — expected 5 fields"); return; }
    try { cronstrue.toString(rawExpr); } catch { toast.error("Invalid cron expression"); return; }
    setFields(parsed);
    setRawExpr("");
    toast.success("Expression loaded");
  };

  const handlePreset = (e: string) => {
    const parsed = parseExpr(e);
    if (parsed) setFields(parsed);
  };

  const outputExpr = platform === "aws" ? toAWSEventBridge(expr)
    : platform === "github" ? `schedule:\n  - cron: '${toGitHubActions(expr)}'`
    : expr;

  return (
    <ToolPageLayout
      title="Cron Expression Builder"
      description="Build and decode cron schedules — with plain-English explanations and next run times"
      maxWidth="wide"
    >
      <ToolSEO
        title="Cron Expression Builder — Free Online Cron Generator"
        description="Build cron expressions visually. See plain-English descriptions and next 10 run times. Supports standard cron, AWS EventBridge, and GitHub Actions."
        canonicalPath="/cron"
        keywords={["cron builder", "cron expression", "cron generator", "cron editor", "aws eventbridge cron", "github actions cron", "crontab"]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="space-y-3">
          {/* Field editors */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Fields</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {FIELD_DEFS.map((fd) => (
                <div key={fd.name}>
                  <label className="mb-1 block text-xs text-muted-foreground">{fd.label}</label>
                  <input
                    type="text"
                    value={fields[fd.name]}
                    onChange={(e) => handleFieldChange(fd.name, e.target.value)}
                    placeholder={fd.placeholder}
                    spellCheck={false}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground min-w-[180px]">
                {expr}
              </code>
              <CopyButton value={expr} size="sm" />
            </div>
          </div>

          {/* Plain English */}
          <div className={`rounded-lg border p-4 ${isValid ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"}`}>
            <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Meaning</h2>
            {isValid ? (
              <p className="text-sm text-foreground font-medium">{description}</p>
            ) : (
              <p className="text-sm text-destructive" role="alert">Invalid expression — check the fields above</p>
            )}
          </div>

          {/* Platform output */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Platform syntax</h2>
              <div className="flex items-center gap-1">
                {(["standard", "aws", "github"] as Platform[]).map((p) => (
                  <Button
                    key={p}
                    variant={platform === p ? "selected" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPlatform(p)}
                  >
                    {p === "standard" ? "cron" : p === "aws" ? "AWS" : "GitHub Actions"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <pre className="flex-1 rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground whitespace-pre-wrap break-all">{outputExpr}</pre>
              <CopyButton value={outputExpr} size="sm" className="mt-0.5" />
            </div>
            {platform === "aws" && (
              <p className="mt-2 text-xs text-muted-foreground">AWS EventBridge adds a year field (<code>*</code>) and requires either day-of-month or day-of-week to be <code>?</code>.</p>
            )}
            {platform === "github" && (
              <p className="mt-2 text-xs text-muted-foreground">GitHub Actions uses standard 5-field cron in UTC inside a <code>schedule</code> trigger.</p>
            )}
          </div>

          {/* Load from expression */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Load expression</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={rawExpr}
                onChange={(e) => setRawExpr(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRawApply(); }}
                placeholder="Paste a cron expression…"
                spellCheck={false}
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="sm" className="h-9 shrink-0" onClick={handleRawApply} disabled={!rawExpr.trim()}>
                Load
              </Button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {/* Presets */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Presets</h2>
            <div className="flex flex-col gap-1">
              {PRESETS.map(({ label, expr: e }) => (
                <button
                  key={e}
                  onClick={() => handlePreset(e)}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary group"
                >
                  <span className="text-xs text-foreground">{label}</span>
                  <code className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">{e}</code>
                </button>
              ))}
            </div>
          </div>

          {/* Next runs */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Next 10 runs</h2>
            {nextRuns.length > 0 ? (
              <ol className="space-y-1">
                {nextRuns.map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-[11px] tabular-nums text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-mono text-xs text-foreground">{r}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">Fix the expression to see upcoming runs</p>
            )}
          </div>
        </div>
      </div>

      <AboutTool>
        <p>Cron expressions control scheduled task execution. They use 5 space-separated fields: minute (0–59), hour (0–23), day of month (1–31), month (1–12), and day of week (0–7, where both 0 and 7 mean Sunday).</p>
        <p className="mt-2">Special values: <code>*</code> means "every", <code>*/n</code> means "every n-th", <code>a-b</code> is a range, and <code>a,b</code> is a list. For example, <code>0 9 * * 1-5</code> runs at 9:00 AM every weekday.</p>
        <p className="mt-2">AWS EventBridge and GitHub Actions both use standard 5-field cron syntax, with minor differences. AWS requires a 6th "year" field and uses <code>?</code> for unspecified day fields. Everything runs in your browser.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default CronBuilder;
