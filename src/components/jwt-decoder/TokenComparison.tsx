import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { decodeJwt } from "./jwtUtils";
import { toast } from "sonner";

export const TokenComparison = ({ currentToken }: { currentToken: string }) => {
  const [compareToken, setCompareToken] = useState("");
  const [diff, setDiff] = useState<{ headerDiffs: [string, any, any][]; payloadDiffs: [string, any, any][] } | null>(null);

  const compare = () => {
    try {
      const a = decodeJwt(currentToken);
      const b = decodeJwt(compareToken.trim());

      const diffObj = (o1: Record<string, any>, o2: Record<string, any>): [string, any, any][] => {
        const allKeys = new Set([...Object.keys(o1), ...Object.keys(o2)]);
        const diffs: [string, any, any][] = [];
        allKeys.forEach(k => {
          if (JSON.stringify(o1[k]) !== JSON.stringify(o2[k])) {
            diffs.push([k, o1[k], o2[k]]);
          }
        });
        return diffs;
      };

      setDiff({
        headerDiffs: diffObj(a.header, b.header),
        payloadDiffs: diffObj(a.payload, b.payload),
      });

      if (diffObj(a.header, b.header).length === 0 && diffObj(a.payload, b.payload).length === 0) {
        toast.info("Tokens are identical");
      } else {
        toast.success("Differences found");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const renderDiffs = (diffs: [string, any, any][], label: string) => {
    if (diffs.length === 0) return <p className="text-xs text-muted-foreground">No differences in {label}</p>;
    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {diffs.map(([key, v1, v2]) => (
          <div key={key} className="grid grid-cols-3 gap-2 text-xs font-mono rounded bg-muted/30 p-1.5">
            <span className="text-foreground font-medium">{key}</span>
            <span className="text-destructive break-all">{v1 === undefined ? "—" : JSON.stringify(v1)}</span>
            <span className="text-green-500 break-all">{v2 === undefined ? "—" : JSON.stringify(v2)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={compareToken}
        onChange={e => setCompareToken(e.target.value)}
        placeholder="Paste second JWT to compare..."
        className="min-h-[60px] font-mono text-xs bg-card border-border resize-none"
      />
      <Button size="sm" onClick={compare} disabled={!compareToken.trim() || !currentToken.trim()}>
        Compare Tokens
      </Button>
      {diff && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1.5">
            <span>Claim</span><span>Token A</span><span>Token B</span>
          </div>
          {renderDiffs(diff.headerDiffs, "Header")}
          {renderDiffs(diff.payloadDiffs, "Payload")}
        </div>
      )}
    </div>
  );
};
