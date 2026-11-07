import { ShieldCheck } from "lucide-react";

export const PrivacyBadge = () => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/20 text-[hsl(var(--success-foreground))] text-xs font-mono">
    <ShieldCheck className="w-3.5 h-3.5" />
    <span>100% browser-side — no data sent to any server</span>
  </div>
);
