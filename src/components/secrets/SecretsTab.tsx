import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FORMATS, MAX_BYTES, MAX_COUNT, MIN_BYTES, PRESETS, entropyBits, generateSecrets,
  type SecretFormat, type SecretPreset,
} from "./secretsUtils";

export const SecretsTab = () => {
  const [bytes, setBytes] = useState("32");
  const [count, setCount] = useState("1");
  const [format, setFormat] = useState<SecretFormat>("base64url");
  const [note, setNote] = useState<string>();
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const run = useCallback((next: { bytes: string; count: string; format: SecretFormat }) => {
    try {
      setValues(generateSecrets({ bytes: Number(next.bytes), count: Number(next.count), format: next.format }));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(e instanceof Error ? e.message : "Could not generate secrets.");
    }
  }, []);

  // Generate once on first view so the tab is never empty.
  useEffect(() => { run({ bytes: "32", count: "1", format: "base64url" }); }, [run]);

  const applyPreset = (preset: SecretPreset) => {
    const next = { bytes: String(preset.bytes), count: "1", format: preset.format };
    setBytes(next.bytes); setCount(next.count); setFormat(next.format); setNote(preset.note);
    run(next);
  };

  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); toast.success(label); }
    catch { toast.error("Clipboard access failed. Select and copy the value manually."); }
  };

  const bytesNumber = Number(bytes);
  return (
    <div className="space-y-5">
      <section aria-labelledby="secrets-presets" className="space-y-2">
        <h2 id="secrets-presets" className="font-mono text-sm font-semibold">Presets</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button key={preset.id} size="sm" variant="outline" onClick={() => applyPreset(preset)}>{preset.label}</Button>
          ))}
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </section>

      <section aria-labelledby="secrets-options" className="space-y-3">
        <h2 id="secrets-options" className="font-mono text-sm font-semibold">Options</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
          <div className="space-y-1.5">
            <Label htmlFor="secret-bytes" className="text-xs text-muted-foreground">Length (bytes, {MIN_BYTES}-{MAX_BYTES})</Label>
            <Input id="secret-bytes" type="number" inputMode="numeric" min={MIN_BYTES} max={MAX_BYTES} value={bytes} onChange={(e) => { setBytes(e.target.value); setNote(undefined); }} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secret-format" className="text-xs text-muted-foreground">Encoding</Label>
            <Select value={format} onValueChange={(value) => { setFormat(value as SecretFormat); setNote(undefined); }}>
              <SelectTrigger id="secret-format" className="font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FORMATS.map((f) => <SelectItem key={f.value} value={f.value} className="font-mono text-xs">{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secret-count" className="text-xs text-muted-foreground">How many (1-{MAX_COUNT})</Label>
            <Input id="secret-count" type="number" inputMode="numeric" min={1} max={MAX_COUNT} value={count} onChange={(e) => setCount(e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <Button onClick={() => run({ bytes, count, format })}><RefreshCw />Generate</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>

      {values.length > 0 && (
        <section aria-labelledby="secrets-output" className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 id="secrets-output" className="font-mono text-sm font-semibold">
              Generated ({values.length}) <span className="text-muted-foreground font-normal">· {bytesNumber} bytes · {entropyBits(bytesNumber)} bits of randomness each</span>
            </h2>
            {values.length > 1 && <Button size="sm" variant="outline" onClick={() => copy(values.join("\n"), "All values copied")}><Copy />Copy all</Button>}
          </div>
          <ul className="border border-border rounded-lg divide-y divide-border" aria-label="Generated secrets">
            {values.map((value, index) => (
              <li key={`${index}-${value}`} className="flex items-start gap-2 px-3 py-2">
                <code className="flex-1 min-w-0 text-xs font-mono break-all select-all">{value}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Copy" aria-label={`Copy value ${index + 1}`} onClick={() => copy(value, "Copied to clipboard")}><Copy /></Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Generated with your browser's secure random source (crypto.getRandomValues), shown only on this page, never stored or sent anywhere. Treat anything you copy as a real secret.</p>
        </section>
      )}
    </div>
  );
};
