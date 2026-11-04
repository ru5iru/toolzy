import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HASHES, algorithmById, type HashName } from "./algorithms";
import { copyText, shortFingerprint } from "./browserUtils";
import type { KeyRecord } from "./keyUtils";

export const KeySelect = ({ id, label, keys, value, onChange, placeholder }: {
  id: string; label: string; keys: KeyRecord[]; value: string; onChange: (id: string) => void; placeholder: string;
}) => (
  <div className="space-y-1.5 min-w-0">
    <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={keys.length === 0}>
      <SelectTrigger id={id} className="font-mono text-xs"><SelectValue placeholder={keys.length ? placeholder : "No keys yet"} /></SelectTrigger>
      <SelectContent>
        {keys.map((key) => (
          <SelectItem key={key.id} value={key.id} className="font-mono text-xs">
            {key.name} · {algorithmById(key.algorithm).label} · {shortFingerprint(key.fingerprint).slice(0, 14)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export const HashSelect = ({ id, value, onChange, label = "Hash algorithm" }: { id: string; value: HashName; onChange: (hash: HashName) => void; label?: string }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value} onValueChange={(next) => onChange(next as HashName)}>
      <SelectTrigger id={id} className="font-mono text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{HASHES.map((hash) => <SelectItem key={hash} value={hash} className="font-mono text-xs">{hash}</SelectItem>)}</SelectContent>
    </Select>
  </div>
);

/** One label/value line in a code-style metadata panel, with a copy button. */
export const MetaRow = ({ label, value, copyable = true, badge }: { label: string; value: string; copyable?: boolean; badge?: ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_28px] sm:grid-cols-[180px_minmax(0,1fr)_28px] gap-x-3 gap-y-0.5 py-2 border-b border-border last:border-b-0 items-start">
    <div className="text-xs text-muted-foreground col-span-2 sm:col-span-1 space-y-1"><div>{label}</div>{badge}</div>
    <div className="text-xs font-mono break-all min-w-0">{value}</div>
    {copyable ? (
      <Button variant="ghost" size="icon" className="h-6 w-6" title={`Copy ${label}`} aria-label={`Copy ${label}`} onClick={() => copyText(value)}><Copy /></Button>
    ) : <span />}
  </div>
);
