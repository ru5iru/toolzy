import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

function decodeJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT: must have 3 parts");
  const decode = (s: string) => {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded));
  };
  const header = decode(parts[0]);
  const payload = decode(parts[1]);
  return { header, payload };
}

function formatExp(exp: number) {
  const d = new Date(exp * 1000);
  const now = Date.now();
  const diff = exp * 1000 - now;
  const expired = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  let relative = "";
  if (days > 0) relative = `${days}d ${hrs % 24}h`;
  else if (hrs > 0) relative = `${hrs}h ${mins % 60}m`;
  else relative = `${mins}m`;
  return { date: d.toISOString(), expired, relative };
}

const JwtDecoder = () => {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<{ header: any; payload: any } | null>(null);
  const [error, setError] = useState("");

  const decode = () => {
    try {
      setError("");
      const r = decodeJwt(token.trim());
      setResult(r);
      toast.success("JWT decoded");
    } catch (e: any) {
      setResult(null);
      setError(e.message);
      toast.error("Invalid JWT");
    }
  };

  const exp = result?.payload?.exp ? formatExp(result.payload.exp) : null;
  const iat = result?.payload?.iat ? new Date(result.payload.iat * 1000).toISOString() : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-mono font-bold text-foreground">JWT Decoder</h1>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Paste JWT</label>
        <Textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOi..."
          className="min-h-[100px] font-mono text-sm bg-card border-border resize-none"
        />
        <Button onClick={decode}>Decode</Button>
      </div>
      {error && <p className="text-destructive font-mono text-sm">{error}</p>}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Header</label>
            <pre className="bg-card border border-border rounded-lg p-4 font-mono text-sm overflow-auto max-h-[300px]">
              {JSON.stringify(result.header, null, 2)}
            </pre>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Payload</label>
            <pre className="bg-card border border-border rounded-lg p-4 font-mono text-sm overflow-auto max-h-[300px]">
              {JSON.stringify(result.payload, null, 2)}
            </pre>
          </div>
          {(exp || iat) && (
            <div className="md:col-span-2 flex flex-wrap gap-4">
              {iat && (
                <div className="rounded-lg border border-border bg-card p-4 flex-1 min-w-[200px]">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Issued At</div>
                  <div className="font-mono text-sm text-foreground">{iat}</div>
                </div>
              )}
              {exp && (
                <div className={`rounded-lg border p-4 flex-1 min-w-[200px] ${exp.expired ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10"}`}>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Expiry</div>
                  <div className="font-mono text-sm text-foreground">{exp.date}</div>
                  <div className={`text-xs mt-1 font-medium ${exp.expired ? "text-destructive" : "text-primary"}`}>
                    {exp.expired ? `Expired ${exp.relative} ago` : `Expires in ${exp.relative}`}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JwtDecoder;
