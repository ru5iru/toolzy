import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

const timezones = (Intl as any).supportedValuesOf?.("timeZone")?.slice(0, 50) ?? [
  "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin",
  "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney", "America/Chicago", "Asia/Kolkata",
];

const DateTimeTool = () => {
  const [timestamp, setTimestamp] = useState(String(Math.floor(Date.now() / 1000)));
  const [dateStr, setDateStr] = useState("");
  const [tz1, setTz1] = useState("UTC");
  const [tz2, setTz2] = useState("America/New_York");
  const [tzInput, setTzInput] = useState(new Date().toISOString().slice(0, 16));
  const [cron, setCron] = useState("0 * * * *");

  useEffect(() => {
    const ts = Number(timestamp);
    if (!isNaN(ts) && ts > 0) {
      setDateStr(new Date(ts * 1000).toISOString());
    }
  }, [timestamp]);

  const nowTs = () => {
    setTimestamp(String(Math.floor(Date.now() / 1000)));
    toast.success("Set to now");
  };

  const fromDate = () => {
    try {
      const d = new Date(dateStr);
      setTimestamp(String(Math.floor(d.getTime() / 1000)));
      toast.success("Converted");
    } catch { toast.error("Invalid date"); }
  };

  const convertedTz1 = new Date(tzInput).toLocaleString("en-US", { timeZone: tz1, dateStyle: "full", timeStyle: "long" });
  const convertedTz2 = new Date(tzInput).toLocaleString("en-US", { timeZone: tz2, dateStyle: "full", timeStyle: "long" });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-mono font-bold text-foreground">Date & Time Toolkit</h1>

      {/* Unix ↔ Human */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Unix Timestamp ↔ Date</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Unix Timestamp</label>
            <Input value={timestamp} onChange={(e) => setTimestamp(e.target.value)} className="w-48 bg-card border-border font-mono" />
          </div>
          <Button variant="secondary" size="sm" onClick={nowTs}>Now</Button>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ISO Date</label>
            <Input value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-64 bg-card border-border font-mono" />
          </div>
          <Button variant="outline" size="sm" onClick={fromDate}>→ Timestamp</Button>
        </div>
      </section>

      {/* Timezone converter */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Timezone Converter</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date/Time</label>
            <Input type="datetime-local" value={tzInput} onChange={(e) => setTzInput(e.target.value)} className="bg-card border-border font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <select value={tz1} onChange={(e) => setTz1(e.target.value)} className="h-10 rounded-md border border-border bg-card px-2 text-sm font-mono text-foreground">
              {timezones.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <select value={tz2} onChange={(e) => setTz2(e.target.value)} className="h-10 rounded-md border border-border bg-card px-2 text-sm font-mono text-foreground">
              {timezones.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-border rounded-lg p-3 bg-card">
            <div className="text-xs text-muted-foreground mb-1">{tz1}</div>
            <div className="font-mono text-sm text-foreground">{convertedTz1}</div>
          </div>
          <div className="border border-border rounded-lg p-3 bg-card">
            <div className="text-xs text-muted-foreground mb-1">{tz2}</div>
            <div className="font-mono text-sm text-foreground">{convertedTz2}</div>
          </div>
        </div>
      </section>

      {/* Cron */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Cron Expression</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {commonCrons.map((c) => (
            <Button key={c.expr} variant="secondary" size="sm" onClick={() => setCron(c.expr)}>{c.label}</Button>
          ))}
        </div>
        <Input value={cron} onChange={(e) => setCron(e.target.value)} className="w-64 bg-card border-border font-mono" placeholder="* * * * *" />
        <div className="border border-border rounded-lg p-3 bg-card font-mono text-sm text-foreground">
          {describeCron(cron)}
        </div>
      </section>
    </div>
  );
};

export default DateTimeTool;
