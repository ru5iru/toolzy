import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

type DiffEntry = { path: string; type: "added" | "removed" | "changed"; left?: string; right?: string };

function deepDiff(a: any, b: any, path = "", ignoreOrder: boolean): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  if (Array.isArray(a) && Array.isArray(b) && ignoreOrder) {
    const sa = JSON.stringify([...a].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
    const sb = JSON.stringify([...b].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
    if (sa !== sb) {
      diffs.push({ path: path || "(root)", type: "changed", left: JSON.stringify(a), right: JSON.stringify(b) });
    }
    return diffs;
  }
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    diffs.push({ path: path || "(root)", type: "changed", left: JSON.stringify(a), right: JSON.stringify(b) });
    return diffs;
  }
  if (typeof a === "object" && a !== null && b !== null) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in a)) diffs.push({ path: p, type: "added", right: JSON.stringify(b[k]) });
      else if (!(k in b)) diffs.push({ path: p, type: "removed", left: JSON.stringify(a[k]) });
      else diffs.push(...deepDiff(a[k], b[k], p, ignoreOrder));
    }
  } else if (a !== b) {
    diffs.push({ path: path || "(root)", type: "changed", left: JSON.stringify(a), right: JSON.stringify(b) });
  }
  return diffs;
}

const colorMap = { added: "text-primary", removed: "text-destructive", changed: "text-yellow-400" };
const labelMap = { added: "ADDED", removed: "REMOVED", changed: "CHANGED" };

const ApiDiffTool = () => {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [ignoreOrder, setIgnoreOrder] = useState(true);
  const [compared, setCompared] = useState(false);

  const compare = () => {
    try {
      const a = JSON.parse(left);
      const b = JSON.parse(right);
      const d = deepDiff(a, b, "", ignoreOrder);
      setDiffs(d);
      setCompared(true);
      toast.success(d.length === 0 ? "No differences" : `${d.length} difference(s) found`);
    } catch (e: any) {
      toast.error("Invalid JSON: " + e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-mono font-bold text-foreground">API Response Diff</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Response A</label>
          <Textarea value={left} onChange={(e) => setLeft(e.target.value)} placeholder='{"id":1}' className="min-h-[300px] font-mono text-sm bg-card border-border resize-none" />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Response B</label>
          <Textarea value={right} onChange={(e) => setRight(e.target.value)} placeholder='{"id":2}' className="min-h-[300px] font-mono text-sm bg-card border-border resize-none" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button onClick={compare}>Compare</Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={ignoreOrder} onChange={(e) => setIgnoreOrder(e.target.checked)} className="accent-primary" />
          Ignore array order
        </label>
      </div>
      {compared && (
        <div className="space-y-2">
          {diffs.length === 0 ? (
            <p className="text-primary font-mono text-sm">✓ Responses are identical</p>
          ) : (
            diffs.map((d, i) => (
              <div key={i} className="border border-border rounded-lg p-3 bg-card font-mono text-sm">
                <span className={`font-bold ${colorMap[d.type]}`}>[{labelMap[d.type]}]</span>{" "}
                <span className="text-foreground">{d.path}</span>
                {d.left !== undefined && <div className="text-destructive ml-4">- {d.left}</div>}
                {d.right !== undefined && <div className="text-primary ml-4">+ {d.right}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ApiDiffTool;
