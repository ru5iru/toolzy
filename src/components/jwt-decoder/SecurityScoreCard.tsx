import { SecurityScore } from "./jwtUtils";
import { ShieldCheck, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const SecurityScoreCard = ({ score }: { score: SecurityScore }) => (
  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {score.score >= 80 ? <ShieldCheck className="w-5 h-5 text-green-500" /> : <ShieldAlert className="w-5 h-5 text-yellow-500" />}
        <span className="text-sm font-medium text-foreground">Security Score</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-2xl font-bold font-mono ${score.color}`}>{score.score}</span>
        <span className={`text-xs font-medium ${score.color}`}>{score.label}</span>
      </div>
    </div>
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${score.score >= 80 ? "bg-green-500" : score.score >= 60 ? "bg-blue-400" : score.score >= 40 ? "bg-yellow-500" : "bg-destructive"}`}
        style={{ width: `${score.score}%` }}
      />
    </div>
    {score.issues.length > 0 && (
      <div className="space-y-1.5 max-h-[200px] overflow-auto">
        {score.issues.map((issue, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {issue.severity === "critical" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            ) : issue.severity === "warning" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <span className="text-muted-foreground">{issue.message}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
