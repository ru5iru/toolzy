import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Copy, Clock, ArrowRightLeft, Calendar, Timer, Search } from "lucide-react";

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

const copyText = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
};

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

const DateTimeTool = () => {
  const [timestamp, setTimestamp] = useState(String(Math.floor(Date.now() / 1000)));
  const [dateStr, setDateStr] = useState("");
  const [tz1, setTz1] = useState("UTC");
  const [tz2, setTz2] = useState("America/New_York");
  const [tzSearch1, setTzSearch1] = useState("");
  const [tzSearch2, setTzSearch2] = useState("");
  const [tzInput, setTzInput] = useState(new Date().toISOString().slice(0, 16));
  const [cron, setCron] = useState("0 * * * *");
  const [liveNow, setLiveNow] = useState(new Date());

  useEffect(() => {
    const ts = Number(timestamp);
    if (!isNaN(ts) && ts > 0) {
      setDateStr(new Date(ts * 1000).toISOString());
    }
  }, [timestamp]);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setLiveNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nowTs = () => {
    setTimestamp(String(Math.floor(Date.now() / 1000)));
    toast.success("Set to now");
  };

  const fromDate = () => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) throw new Error();
      setTimestamp(String(Math.floor(d.getTime() / 1000)));
      toast.success("Converted");
    } catch {
      toast.error("Invalid date");
    }
  };

  const ts = Number(timestamp);
  const tsDate = !isNaN(ts) && ts > 0 ? new Date(ts * 1000) : null;
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

  const utcOffset = (tz: string) => {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
      const parts = fmt.formatToParts(liveNow);
      return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch { return ""; }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ToolSEO title="Date & Time Toolkit" description="Convert Unix timestamps to human dates, compare timezones, and build cron expressions with a visual cron generator. Free online date/time tools." canonicalPath="/datetime" keywords={["Unix timestamp converter", "timezone converter", "cron expression generator", "epoch converter", "date time tool"]} faq={[{question:"How do I convert a Unix timestamp?",answer:"Enter a Unix timestamp (seconds since epoch) and click Convert to see the human-readable date, or enter a date to get the Unix timestamp."},{question:"What is a cron expression?",answer:"A cron expression defines a schedule using five fields: minute, hour, day of month, month, and day of week. This tool helps you build and visualize cron schedules."}]} howToSteps={["Enter a Unix timestamp or date to convert","Use the timezone section to compare times across zones","Build cron expressions using the interactive generator"]} />

      {/* Header with live clock */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-mono font-bold text-foreground">Date & Time Toolkit</h1>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground border border-border rounded-md px-3 py-1.5 bg-card">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{liveNow.toISOString().replace("T", " ").slice(0, 19)} UTC</span>
        </div>
      </div>

      {/* Unix ↔ Human */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Unix Timestamp ↔ Date</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Unix Timestamp (seconds)</label>
            <div className="flex gap-1.5">
              <Input value={timestamp} onChange={(e) => setTimestamp(e.target.value)} className="bg-background border-border font-mono text-sm" />
              <Button variant="secondary" size="sm" className="h-10 px-3 shrink-0" onClick={nowTs}>Now</Button>
              <Button variant="ghost" size="sm" className="h-10 px-2 shrink-0" onClick={() => copyText(timestamp, "Timestamp")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">ISO 8601 Date</label>
            <div className="flex gap-1.5">
              <Input value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="bg-background border-border font-mono text-sm" />
              <Button variant="outline" size="sm" className="h-10 px-3 shrink-0" onClick={fromDate}>→ TS</Button>
              <Button variant="ghost" size="sm" className="h-10 px-2 shrink-0" onClick={() => copyText(dateStr, "Date")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
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
              ms: {ts * 1000}
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
            <span className="ml-2 text-[10px] font-normal opacity-60">({allTimezones.length} timezones)</span>
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
              <span className="text-[10px] text-primary font-mono">{utcOffset(tz1)}</span>
            </div>
            <div className="font-mono text-sm text-foreground">{convertedTz1}</div>
          </div>
          <div className="border border-border rounded-lg p-3 bg-background">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">{tz2}</span>
              <span className="text-[10px] text-primary font-mono">{utcOffset(tz2)}</span>
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
            <Button key={c.expr} variant={cron === c.expr ? "default" : "secondary"} size="sm" className="h-7 text-xs" onClick={() => setCron(c.expr)}>
              {c.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Input value={cron} onChange={(e) => setCron(e.target.value)} className="w-56 bg-background border-border font-mono text-sm" placeholder="* * * * *" />
          <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => copyText(cron, "Cron")}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Visual cron breakdown */}
        <div className="grid grid-cols-5 gap-1.5">
          {cron.trim().split(/\s+/).slice(0, 5).map((part, i) => (
            <div key={i} className="border border-border rounded p-2 bg-background text-center">
              <div className="text-[10px] text-muted-foreground mb-1">{cronFields[i]}</div>
              <div className="font-mono text-sm text-primary font-semibold">{part}</div>
            </div>
          ))}
        </div>
        <div className="border border-border rounded-lg p-3 bg-background font-mono text-xs text-muted-foreground">
          {describeCron(cron)}
        </div>
      </section>
    </div>
  );
};

export default DateTimeTool;
