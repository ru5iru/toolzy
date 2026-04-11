import { useState } from "react";
import { Copy, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CLAIM_TOOLTIPS } from "./jwtUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface JwtSectionProps {
  title: string;
  data: Record<string, any>;
  colorClass: string;
  borderClass: string;
}

export const JwtSection = ({ title, data, colorClass, borderClass }: JwtSectionProps) => {
  const [expanded, setExpanded] = useState(true);

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success(`${title} copied`);
  };

  return (
    <div className={`rounded-lg border ${borderClass} bg-card overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>{title}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); copy(); }}>
          <Copy className="w-3 h-3" />
        </Button>
      </button>
      {expanded && (
        <div className="px-3 pb-3 font-mono text-sm space-y-0.5">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 py-0.5 hover:bg-accent/5 rounded px-1 -mx-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`${colorClass} shrink-0 cursor-help`}>
                    "{key}"
                  </span>
                </TooltipTrigger>
                {CLAIM_TOOLTIPS[key] && (
                  <TooltipContent side="left" className="max-w-[250px]">
                    <p className="text-xs">{CLAIM_TOOLTIPS[key]}</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <span className="text-muted-foreground">:</span>
              <span className="text-foreground break-all">
                {typeof value === "string" ? `"${value}"` : JSON.stringify(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
