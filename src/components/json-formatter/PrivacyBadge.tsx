import { ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Compact "Local only" chip; the full promise is in the tooltip. */
export const PrivacyBadge = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        tabIndex={0}
        className="inline-flex h-6 cursor-default items-center gap-1.5 rounded-full border border-[hsl(var(--success))]/25 bg-[hsl(var(--success))]/10 px-2.5 font-mono text-[11px] text-[hsl(var(--success-foreground))] transition-colors hover:bg-[hsl(var(--success))]/15"
      >
        <ShieldCheck className="h-3 w-3" aria-hidden />
        Local only
      </span>
    </TooltipTrigger>
    <TooltipContent>Runs in your browser. Nothing is uploaded.</TooltipContent>
  </Tooltip>
);
