import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

interface Props {
  payload: Record<string, any>;
}

export const ClaimsValidator = ({ payload }: Props) => {
  const [expectedIss, setExpectedIss] = useState("");
  const [expectedAud, setExpectedAud] = useState("");
  const [expectedSub, setExpectedSub] = useState("");
  const [results, setResults] = useState<{ claim: string; expected: string; actual: string; match: boolean }[] | null>(null);

  const validate = () => {
    const checks: typeof results = [];
    if (expectedIss) checks.push({ claim: "iss", expected: expectedIss, actual: payload.iss || "—", match: payload.iss === expectedIss });
    if (expectedAud) checks.push({ claim: "aud", expected: expectedAud, actual: String(payload.aud || "—"), match: String(payload.aud) === expectedAud || (Array.isArray(payload.aud) && payload.aud.includes(expectedAud)) });
    if (expectedSub) checks.push({ claim: "sub", expected: expectedSub, actual: payload.sub || "—", match: payload.sub === expectedSub });
    setResults(checks);
    const allPass = checks.every(c => c.match);
    toast[allPass ? "success" : "error"](allPass ? "All claims match" : "Some claims don't match");
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Input value={expectedIss} onChange={e => setExpectedIss(e.target.value)} placeholder="Expected iss" className="font-mono text-xs h-8" />
        <Input value={expectedAud} onChange={e => setExpectedAud(e.target.value)} placeholder="Expected aud" className="font-mono text-xs h-8" />
        <Input value={expectedSub} onChange={e => setExpectedSub(e.target.value)} placeholder="Expected sub" className="font-mono text-xs h-8" />
      </div>
      <Button size="sm" onClick={validate} disabled={!expectedIss && !expectedAud && !expectedSub}>
        Validate Claims
      </Button>
      {results && (
        <div className="space-y-1">
          {results.map(r => (
            <div key={r.claim} className="flex items-center gap-2 text-xs font-mono">
              {r.match ? <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--success-foreground))]" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              <span className="text-muted-foreground">{r.claim}:</span>
              <span className={r.match ? "text-[hsl(var(--success-foreground))]" : "text-destructive"}>{r.actual}</span>
              {!r.match && <span className="text-muted-foreground">expected: {r.expected}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
