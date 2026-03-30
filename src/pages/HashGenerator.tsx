import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

async function hash(algo: string, text: string) {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest(algo, buf);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const algos = [
  { label: "SHA-1", algo: "SHA-1" },
  { label: "SHA-256", algo: "SHA-256" },
  { label: "SHA-384", algo: "SHA-384" },
  { label: "SHA-512", algo: "SHA-512" },
];

const HashGenerator = () => {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});

  const generate = async () => {
    if (!input) return;
    const r: Record<string, string> = {};
    for (const a of algos) {
      r[a.label] = await hash(a.algo, input);
    }
    setResults(r);
    toast.success("Hashes generated");
  };

  const copyHash = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("Copied");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-mono font-bold text-foreground">Hash Generator</h1>
      <p className="text-xs text-muted-foreground">MD5 is not available in browser Web Crypto API. bcrypt requires a server. SHA family is supported natively.</p>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Input</label>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text to hash…" className="min-h-[120px] font-mono text-sm bg-card border-border resize-none" />
        <Button onClick={generate}>Generate Hashes</Button>
      </div>
      {Object.keys(results).length > 0 && (
        <div className="space-y-3">
          {algos.map((a) => (
            <div key={a.label} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{a.label}</span>
                <Button variant="ghost" size="sm" onClick={() => copyHash(results[a.label])}>Copy</Button>
              </div>
              <p className="font-mono text-sm text-foreground break-all">{results[a.label]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HashGenerator;
