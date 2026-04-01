import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface JsonTreeNodeProps {
  keyName?: string;
  value: any;
  defaultExpanded: boolean;
  searchTerm?: string;
}

const highlightMatch = (text: string, search: string) => {
  if (!search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-500/40 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
};

export const JsonTreeNode = ({ keyName, value, defaultExpanded, searchTerm = "" }: JsonTreeNodeProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const renderKey = (k: string) => searchTerm ? highlightMatch(k, searchTerm) : k;
  const renderVal = (v: string) => searchTerm ? highlightMatch(v, searchTerm) : v;

  if (value === null) return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-orange-400">null</span></div>;
  if (typeof value === "boolean") return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-yellow-400">{String(value)}</span></div>;
  if (typeof value === "number") return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-cyan-400">{value}</span></div>;
  if (typeof value === "string") return <div className="pl-4 font-mono text-sm"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-green-400">"{renderVal(value)}"</span></div>;

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v: any, i: number) => [String(i), v] as [string, any]) : Object.entries(value);
  const bracket = isArray ? ["[", "]"] : ["{", "}"];

  return (
    <div className="pl-4">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 font-mono text-sm hover:bg-accent/10 rounded px-1 -ml-1 transition-colors">
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span>
        {!expanded && <span className="text-muted-foreground">{bracket[0]} {entries.length} items {bracket[1]}</span>}
        {expanded && <span className="text-muted-foreground">{bracket[0]}</span>}
      </button>
      {expanded && (
        <div>
          {entries.map(([k, v]: [string, any]) => (
            <JsonTreeNode key={k} keyName={isArray ? undefined : k} value={v} defaultExpanded={defaultExpanded} searchTerm={searchTerm} />
          ))}
          <div className="pl-4 font-mono text-sm text-muted-foreground">{bracket[1]}</div>
        </div>
      )}
    </div>
  );
};
