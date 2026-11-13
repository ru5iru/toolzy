import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Clock, ArrowRightLeft, Calendar, Timer, Search, Plus, X, Globe, Briefcase, Users } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const commonCrons = [
  { label: "Every minute", expr: "* * * * *" },
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every day at midnight", expr: "0 0 * * *" },
  { label: "Every Monday 9 AM", expr: "0 9 * * 1" },
  { label: "Every 5 minutes", expr: "*/5 * * * *" },
  { label: "1st of month", expr: "0 0 1 * *" },
];

const cronFields = ["Minute", "Hour", "Day of Month", "Month", "Day of Week"];

function describeCron(expr: string) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression (need 5 fields)";
  return parts.map((p, i) => `${cronFields[i]}: ${p}`).join(" | ");
}

// Get ALL timezones from Intl API, no slicing
const allTimezones: string[] = (() => {
  try {
    return (Intl as any).supportedValuesOf("timeZone") as string[];
  } catch {
    return [
      "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "America/Anchorage", "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "America/Mexico_City",
      "America/Toronto", "America/Vancouver", "Europe/London", "Europe/Berlin", "Europe/Paris",
      "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Moscow", "Europe/Istanbul",
      "Europe/Warsaw", "Europe/Zurich", "Europe/Stockholm", "Asia/Tokyo", "Asia/Shanghai",
      "Asia/Hong_Kong", "Asia/Singapore", "Asia/Seoul", "Asia/Kolkata", "Asia/Dubai",
      "Asia/Bangkok", "Asia/Jakarta", "Asia/Karachi", "Asia/Dhaka", "Asia/Taipei",
      "Australia/Sydney", "Australia/Melbourne", "Australia/Perth", "Australia/Brisbane",
      "Pacific/Auckland", "Pacific/Honolulu", "Pacific/Fiji", "Africa/Cairo",
      "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
    ];
  }
})();

// Group timezones by region
function groupTimezones(tzList: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const tz of tzList) {
    const region = tz.includes("/") ? tz.split("/")[0] : "Other";
    if (!groups[region]) groups[region] = [];
    groups[region].push(tz);
  }
  return groups;
}


const TimezoneSelect = ({
  value,
  onChange,
  search,
  onSearchChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  label: string;
}) => {
  const filtered = useMemo(() => {
    if (!search) return allTimezones;
    const q = search.toLowerCase();
    return allTimezones.filter((tz) => tz.toLowerCase().includes(q));
  }, [search]);

  const grouped = useMemo(() => groupTimezones(filtered), [filtered]);

  return (
    <div className="space-y-1.5 min-w-[220px]">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search timezone..."
          className="pl-7 h-8 text-xs bg-card border-border font-mono"
        />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-border bg-card px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        size={1}
      >
        {Object.entries(grouped).map(([region, tzs]) => (
          <optgroup key={region} label={region}>
            {tzs.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

// ─── Business days helpers ─────────────────────────────────────────────────
function countBusinessDays(start: Date, end: Date): number {
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const s = new Date(Math.min(start.getTime(), end.getTime()));
  const e = new Date(Math.max(start.getTime(), end.getTime()));
  s.setHours(0, 0, 0, 0); e.setHours(0, 0, 0, 0);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function addBusinessDays(start: Date, days: number): Date {
  if (isNaN(start.getTime())) return start;
  const result = new Date(start);
  let added = 0;
  const inc = days >= 0 ? 1 : -1;
  const target = Math.abs(days);
  while (added < target) {
    result.setDate(result.getDate() + inc);
    if (result.getDay() !== 0 && result.getDay() !== 6) added++;
  }
  return result;
}

// ─── Meeting planner helpers ───────────────────────────────────────────────
function getHourInTz(date: Date, tz: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(date);
    return parseInt(h, 10);
  } catch { return -1; }
}

function workHoursBadge(hour: number): { label: string; cls: string } {
  if (hour >= 9 && hour < 17) return { label: "Work hours", cls: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30" };
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 20)) return { label: "Early/Late", cls: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30" };
  return { label: "Off hours", cls: "bg-destructive/10 text-destructive border-destructive/20" };
}

// Default world clock zones
const DEFAULT_WORLD_CLOCKS = ["UTC","America/New_York","Europe/London","Asia/Kolkata","Asia/Tokyo","Australia/Sydney"];

const DateTimeTool = () => {
  const [timestamp, setTimestamp] = useState(String(Math.floor(Date.now() / 1000)));
  const [tsUnit, setTsUnit] = useState<"s" | "ms">("s");
  const [dateStr, setDateStr] = useState("");
  const [tz1, setTz1] = useState("UTC");
  const [tz2, setTz2] = useState("America/New_York");
  const [tzSearch1, setTzSearch1] = useState("");
  const [tzSearch2, setTzSearch2] = useState("");
  const [tzInput, setTzInput] = useState(new Date().toISOString().slice(0, 16));
  const [cron, setCron] = useState("0 * * * *");
  const [liveNow, setLiveNow] = useState(new Date());
  const [diffStart, setDiffStart] = useState(new Date().toISOString().slice(0, 16));
  const [diffEnd, setDiffEnd] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));

  // World clock
  const [worldClocks, setWorldClocks] = useState<string[]>(DEFAULT_WORLD_CLOCKS);
  const [wcSearch, setWcSearch] = useState("");
  const [wcAddVal, setWcAddVal] = useState(allTimezones[0] ?? "UTC");

  // Business days
  const [bizStart, setBizStart] = useState(new Date().toISOString().slice(0, 10));
  const [bizEnd, setBizEnd] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [bizAddDaysInput, setBizAddDaysInput] = useState("5");

  // Meeting planner
  const [meetingZones, setMeetingZones] = useState(["America/New_York","Europe/London","Asia/Kolkata"]);
  const [meetingTime, setMeetingTime] = useState(new Date().toISOString().slice(0, 16));
  const [meetAddZone, setMeetAddZone] = useState("Asia/Tokyo");
  const [meetSearch, setMeetSearch] = useState("");

  const dateDiff = useMemo(() => {
    const a = new Date(diffStart).getTime();
    const b = new Date(diffEnd).getTime();
    if (isNaN(a) || isNaN(b)) return null;
    const ms = Math.abs(b - a);
    const totalMinutes = Math.floor(ms / 60000);
    const totalHours = Math.floor(ms / 3600000);
    const totalDays = Math.floor(ms / 86400000);
    const days = totalDays;
    const hours = totalHours % 24;
    const mins = totalMinutes % 60;
    return {
      label: `${days}d ${hours}h ${mins}m`,
      totalDays: totalDays.toLocaleString(),
      totalHours: totalHours.toLocaleString(),
      totalMinutes: totalMinutes.toLocaleString(),
    };
  }, [diffStart, diffEnd]);

  useEffect(() => {
    const ts = Number(timestamp);
    if (!isNaN(ts) && ts > 0) {
      const ms = tsUnit === "ms" ? ts : ts * 1000;
      setDateStr(new Date(ms).toISOString());
    }
  }, [timestamp, tsUnit]);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setLiveNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nowTs = () => {
    setTimestamp(tsUnit === "ms" ? String(Date.now()) : String(Math.floor(Date.now() / 1000)));
    toast.success("Set to now");
  };

  const fromDate = () => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) throw new Error();
      setTimestamp(tsUnit === "ms" ? String(d.getTime()) : String(Math.floor(d.getTime() / 1000)));
      toast.success("Converted");
    } catch {
      toast.error("Invalid date");
    }
  };

  const ts = Number(timestamp);
  const tsMs = !isNaN(ts) && ts > 0 ? (tsUnit === "ms" ? ts : ts * 1000) : null;
  const tsDate = tsMs !== null ? new Date(tsMs) : null;
  const relativeTime = tsDate
    ? (() => {
        const diff = tsDate.getTime() - Date.now();
        const absDiff = Math.abs(diff);
        const mins = Math.floor(absDiff / 60000);
        const hours = Math.floor(absDiff / 3600000);
        const days = Math.floor(absDiff / 86400000);
        const label = days > 0 ? `${days}d ${hours % 24}h` : hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
        return diff > 0 ? `in ${label}` : `${label} ago`;
      })()
    : null;

  const convertedTz1 = (() => {
    try {
      return new Date(tzInput).toLocaleString("en-US", { timeZone: tz1, dateStyle: "full", timeStyle: "long" });
    } catch { return "Invalid timezone"; }
  })();
  const convertedTz2 = (() => {
    try {
      return new Date(tzInput).toLocaleString("en-US", { timeZone: tz2, dateStyle: "full", timeStyle: "long" });
    } catch { return "Invalid timezone"; }
  })();

  // Business days computations
  const bizResult = useMemo(() => {
    const s = new Date(bizStart); const e = new Date(bizEnd);
    const days = countBusinessDays(s, e);
    const calDays = Math.abs(Math.round((e.getTime() - s.getTime()) / 86400000));
    const addDays = addBusinessDays(s, parseInt(bizAddDaysInput) || 0);
    return { days, calDays, addDays: isNaN(addDays.getTime()) ? null : addDays.toISOString().slice(0, 10) };
  }, [bizStart, bizEnd, bizAddDaysInput]);

  // World clock formatter
  const formatWorldClock = useCallback((tz: string) => {
    try {
      const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(liveNow);
      const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(liveNow);
      const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(liveNow).find(p => p.type === "timeZoneName")?.value ?? "";
      return { time, date, offset };
    } catch { return { time: "--:--:--", date: "--", offset: "" }; }
  }, [liveNow]);

  const utcOffset = (tz: string) => {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
      const parts = fmt.formatToParts(liveNow);
      return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch { return ""; }
  };

  return (
    <ToolPageLayout title="Date & Time Toolkit" description="Unix timestamps, timezone conversion and cron expression builder" toolbar={<div className="flex items-center gap-2 text-xs font-mono text-muted-foreground border border-border rounded-md px-3 py-1.5 bg-card">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{liveNow.toISOString().replace("T", " ").slice(0, 19)} UTC</span>
        </div>}>
      <ToolSEO title="Date & Time Toolkit" description="Convert Unix timestamps to human dates, compare timezones, and build cron expressions with a visual cron generator. Free online date/time tools." canonicalPath="/datetime" keywords={["Unix timestamp converter", "timezone converter", "cron expression generator", "epoch converter", "date time tool"]} faq={[{question:"How do I convert a Unix timestamp?",answer:"Enter a Unix timestamp (seconds since epoch) and click Convert to see the human-readable date, or enter a date to get the Unix timestamp."},{question:"What is a cron expression?",answer:"A cron expression defines a schedule using five fields: minute, hour, day of month, month, and day of week. This tool helps you build and visualize cron schedules."},{question:"How do I calculate the difference between two dates?",answer:"Use the Date Difference section: pick a start and end date and instantly see the gap in days, hours, and minutes."},{question:"Which timezones are supported?",answer:"All IANA timezones supported by your browser — over 400 zones, searchable and grouped by region, with live UTC offsets."}]} howToSteps={["Enter a Unix timestamp or date to convert","Use the timezone section to compare times across zones","Build cron expressions using the interactive generator"]} />


      {/* Unix ↔ Human */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Unix Timestamp ↔ Date</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium">Unix Timestamp</label>
              <div className="flex gap-0.5">
                {(["s", "ms"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => {
                      if (u === tsUnit) return;
                      const n = Number(timestamp);
                      if (!isNaN(n) && n > 0) {
                        setTimestamp(u === "ms" ? String(n * 1000) : String(Math.floor(n / 1000)));
                      }
                      setTsUnit(u);
                    }}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${tsUnit === u ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5">
              <Input value={timestamp} onChange={(e) => setTimestamp(e.target.value)} className="bg-background border-border font-mono text-sm" />
              <Button variant="secondary" size="sm" className="h-9 px-3 shrink-0" onClick={nowTs}>Now</Button>
              <CopyButton value={timestamp} message="Timestamp copied" ariaLabel="Copy timestamp" variant="ghost" size="sm" className="h-9 px-2 shrink-0" />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">ISO 8601 Date</label>
            <div className="flex gap-1.5">
              <Input value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="bg-background border-border font-mono text-sm" />
              <Button variant="outline" size="sm" className="h-9 px-3 shrink-0" onClick={fromDate}>→ TS</Button>
              <CopyButton value={dateStr} message="Date copied" ariaLabel="Copy date" variant="ghost" size="sm" className="h-9 px-2 shrink-0" />
            </div>
          </div>
        </div>

        {/* Relative time & human readable */}
        {tsDate && (
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            <span className="border border-border rounded px-2 py-1 bg-background text-foreground">
              {tsDate.toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" })}
            </span>
            <span className="border border-border rounded px-2 py-1 bg-background text-primary font-semibold">
              {relativeTime}
            </span>
            <span className="border border-border rounded px-2 py-1 bg-background text-muted-foreground">
              {tsUnit === "ms" ? `s: ${Math.floor(ts / 1000)}` : `ms: ${ts * 1000}`}
            </span>
          </div>
        )}
      </section>

      {/* Timezone converter */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">
            Timezone Converter
            <span className="ml-2 text-xs font-normal opacity-60">({allTimezones.length} timezones)</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] items-start gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Date/Time</label>
            <Input type="datetime-local" value={tzInput} onChange={(e) => setTzInput(e.target.value)} className="bg-background border-border font-mono text-sm h-9" />
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setTzInput(new Date().toISOString().slice(0, 16))}>
              Set to now
            </Button>
          </div>

          <TimezoneSelect label="From" value={tz1} onChange={setTz1} search={tzSearch1} onSearchChange={setTzSearch1} />
          <TimezoneSelect label="To" value={tz2} onChange={setTz2} search={tzSearch2} onSearchChange={setTzSearch2} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-border rounded-lg p-3 bg-background">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">{tz1}</span>
              <span className="text-xs text-primary font-mono">{utcOffset(tz1)}</span>
            </div>
            <div className="font-mono text-sm text-foreground">{convertedTz1}</div>
          </div>
          <div className="border border-border rounded-lg p-3 bg-background">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">{tz2}</span>
              <span className="text-xs text-primary font-mono">{utcOffset(tz2)}</span>
            </div>
            <div className="font-mono text-sm text-foreground">{convertedTz2}</div>
          </div>
        </div>
      </section>

      {/* Cron */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Cron Expression</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {commonCrons.map((c) => (
            <Button key={c.expr} variant={cron === c.expr ? "selected" : "secondary"} size="sm" className="h-7 text-xs" onClick={() => setCron(c.expr)}>
              {c.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Input value={cron} onChange={(e) => setCron(e.target.value)} className="w-56 bg-background border-border font-mono text-sm" placeholder="* * * * *" />
          <CopyButton value={cron} message="Cron copied" ariaLabel="Copy cron expression" variant="ghost" size="sm" className="h-9 px-2" />
        </div>

        {/* Visual cron breakdown */}
        <div className="grid grid-cols-5 gap-1.5">
          {cron.trim().split(/\s+/).slice(0, 5).map((part, i) => (
            <div key={i} className="border border-border rounded p-2 bg-background text-center">
              <div className="text-xs text-muted-foreground mb-1">{cronFields[i]}</div>
              <div className="font-mono text-sm text-primary font-semibold">{part}</div>
            </div>
          ))}
        </div>
        <div className="border border-border rounded-lg p-3 bg-background font-mono text-xs text-muted-foreground">
          {describeCron(cron)}
        </div>
      </section>

      {/* Date difference calculator */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Date Difference</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Start date</label>
            <Input type="datetime-local" value={diffStart} onChange={(e) => setDiffStart(e.target.value)} className="bg-background border-border font-mono text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">End date</label>
            <Input type="datetime-local" value={diffEnd} onChange={(e) => setDiffEnd(e.target.value)} className="bg-background border-border font-mono text-sm h-9" />
          </div>
        </div>
        {dateDiff && (
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            <span className="border border-border rounded px-2 py-1 bg-background text-primary font-semibold">{dateDiff.label}</span>
            <span className="border border-border rounded px-2 py-1 bg-background text-muted-foreground">{dateDiff.totalDays} days</span>
            <span className="border border-border rounded px-2 py-1 bg-background text-muted-foreground">{dateDiff.totalHours} hours</span>
            <span className="border border-border rounded px-2 py-1 bg-background text-muted-foreground">{dateDiff.totalMinutes} minutes</span>
          </div>
        )}
      </section>

      {/* ── WORLD CLOCK ── */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">World Clock</h2>
          </div>
        </div>

        {/* Clock grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {worldClocks.map((tz) => {
            const { time, date, offset } = formatWorldClock(tz);
            const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
            return (
              <div key={tz} className="border border-border rounded-lg p-3 bg-background relative group">
                <button
                  onClick={() => setWorldClocks((c) => c.filter((z) => z !== tz))}
                  className="absolute top-1.5 right-1.5 h-5 w-5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-muted"
                  aria-label={`Remove ${tz}`}
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
                <div className="text-xs text-muted-foreground truncate pr-5">{tz.replace(/_/g, " ")}</div>
                <div className="font-mono font-semibold text-xl mt-0.5 tabular-nums">{time}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{date}</span>
                  <span className="text-xs font-mono text-primary">{offset}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add timezone */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Add timezone</label>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={wcSearch} onChange={(e) => setWcSearch(e.target.value)} placeholder="Search…" className="pl-7 h-8 text-xs font-mono" />
              </div>
              <select
                value={wcAddVal}
                onChange={(e) => setWcAddVal(e.target.value)}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs font-mono text-foreground focus:outline-none flex-1 min-w-[140px]"
              >
                {allTimezones.filter((tz) => !wcSearch || tz.toLowerCase().includes(wcSearch.toLowerCase())).map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs shrink-0"
                onClick={() => { if (!worldClocks.includes(wcAddVal)) setWorldClocks((c) => [...c, wcAddVal]); else toast.info("Already added"); }}
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => setWorldClocks(DEFAULT_WORLD_CLOCKS)}>Reset</Button>
        </div>
      </section>

      {/* ── BUSINESS DAYS ── */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Business Days Calculator</h2>
        </div>

        {/* Count between dates */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Count business days between two dates</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Start date</label>
              <Input type="date" value={bizStart} onChange={(e) => setBizStart(e.target.value)} className="bg-background border-border font-mono text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">End date</label>
              <Input type="date" value={bizEnd} onChange={(e) => setBizEnd(e.target.value)} className="bg-background border-border font-mono text-sm h-9" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <span className="border border-border rounded px-2 py-1 bg-background text-primary font-semibold">{bizResult.days} business days</span>
            <span className="border border-border rounded px-2 py-1 bg-background text-muted-foreground">{bizResult.calDays} calendar days total</span>
            <span className="border border-border rounded px-2 py-1 bg-background text-muted-foreground">{bizResult.calDays - bizResult.days} weekend days excluded</span>
          </div>
        </div>

        {/* Add N business days */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Add business days to a date</p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Start from</label>
              <Input type="date" value={bizStart} onChange={(e) => setBizStart(e.target.value)} className="bg-background border-border font-mono text-sm h-9 w-40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Business days to add</label>
              <Input type="number" value={bizAddDaysInput} onChange={(e) => setBizAddDaysInput(e.target.value)} className="bg-background border-border font-mono text-sm h-9 w-24" />
            </div>
            {bizResult.addDays && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Result</label>
                <div className="flex items-center gap-2 h-9">
                  <span className="border border-border rounded px-3 py-1.5 bg-background font-mono text-sm text-primary">{bizResult.addDays}</span>
                  <CopyButton value={bizResult.addDays} message="Copied!" variant="ghost" size="icon" className="h-7 w-7" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── MEETING TIME PLANNER ── */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Meeting Time Planner</h2>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">Proposed meeting time (your local time)</label>
          <Input type="datetime-local" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} className="bg-background border-border font-mono text-sm h-9 max-w-xs" />
        </div>

        {/* Timezone cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {meetingZones.map((tz) => {
            const d = new Date(meetingTime);
            const isValid = !isNaN(d.getTime());
            const localTime = isValid ? (() => {
              try {
                return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(d);
              } catch { return "—"; }
            })() : "—";
            const hour = isValid ? getHourInTz(d, tz) : -1;
            const badge = hour >= 0 ? workHoursBadge(hour) : null;
            const offset = (() => {
              try {
                return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(d).find(p => p.type === "timeZoneName")?.value ?? "";
              } catch { return ""; }
            })();

            return (
              <div key={tz} className="border border-border rounded-lg p-3 bg-background relative group space-y-1">
                <button
                  onClick={() => setMeetingZones((z) => z.filter((x) => x !== tz))}
                  className="absolute top-1.5 right-1.5 h-5 w-5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-muted"
                  aria-label={`Remove ${tz}`}
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
                <div className="text-xs text-muted-foreground truncate pr-5">{tz.replace(/_/g, " ")} <span className="font-mono text-primary">{offset}</span></div>
                <div className="font-mono text-sm font-semibold">{localTime}</div>
                {badge && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Add timezone to meeting */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Add participant timezone</label>
            <div className="flex gap-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={meetSearch} onChange={(e) => setMeetSearch(e.target.value)} placeholder="Search…" className="pl-7 h-8 text-xs font-mono w-32" />
              </div>
              <select
                value={meetAddZone}
                onChange={(e) => setMeetAddZone(e.target.value)}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs font-mono text-foreground focus:outline-none flex-1 min-w-[140px]"
              >
                {allTimezones.filter((tz) => !meetSearch || tz.toLowerCase().includes(meetSearch.toLowerCase())).map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs shrink-0"
                onClick={() => { if (!meetingZones.includes(meetAddZone)) setMeetingZones((z) => [...z, meetAddZone]); else toast.info("Already added"); }}
                disabled={meetingZones.length >= 8}
              >
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">Green = 9–17 (business hours) · Yellow = 7–9 or 17–20 (early/late) · Red = outside work hours</p>
      </section>
    </ToolPageLayout>
  );
};

export default DateTimeTool;
