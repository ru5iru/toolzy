import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface JsonTreeNodeProps {
  keyName?: string;
  value: any;
  defaultExpanded: boolean;
  searchTerm?: string;
  path?: string;
}

const highlightMatch = (text: string, search: string) => {
  if (!search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[hsl(var(--syntax-highlight)/0.4)] text-inherit rounded-sm px-0.5">{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
};

const copyPath = (path: string) => {
  navigator.clipboard.writeText(path);
  toast.success(`Copied: ${path}`);
};

const PathButton = ({ path }: { path: string }) => (
  <button
    onClick={(e) => { e.stopPropagation(); copyPath(path); }}
    className="opacity-0 group-hover/node:opacity-100 ml-2 text-[10px] text-muted-foreground hover:text-primary font-mono transition-opacity"
    title={`Copy path: ${path}`}
  >
    {path}
  </button>
);

export const JsonTreeNode = ({ keyName, value, defaultExpanded, searchTerm = "", path = "$" }: JsonTreeNodeProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const currentPath = keyName !== undefined
    ? (/^\d+$/.test(keyName) ? `${path}[${keyName}]` : `${path}.${keyName}`)
    : path;

  const renderKey = (k: string) => searchTerm ? highlightMatch(k, searchTerm) : k;
  const renderVal = (v: string) => searchTerm ? highlightMatch(v, searchTerm) : v;

  if (value === null) return <div className="pl-4 font-mono text-sm group/node"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-[hsl(var(--syntax-null))]">null</span><PathButton path={currentPath} /></div>;
  if (typeof value === "boolean") return <div className="pl-4 font-mono text-sm group/node"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-[hsl(var(--syntax-boolean))]">{String(value)}</span><PathButton path={currentPath} /></div>;
  if (typeof value === "number") return <div className="pl-4 font-mono text-sm group/node"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-[hsl(var(--syntax-number))]">{value}</span><PathButton path={currentPath} /></div>;
  if (typeof value === "string") return <div className="pl-4 font-mono text-sm group/node"><span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span><span className="text-[hsl(var(--syntax-string))]">"{renderVal(value)}"</span><PathButton path={currentPath} /></div>;

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v: any, i: number) => [String(i), v] as [string, any]) : Object.entries(value);
  const bracket = isArray ? ["[", "]"] : ["{", "}"];

  return (
    <div className="pl-4">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 font-mono text-sm hover:bg-accent/10 rounded px-1 -ml-1 transition-colors group/node">
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-muted-foreground">{keyName && <>{renderKey(keyName)}: </>}</span>
        {!expanded && <span className="text-muted-foreground">{bracket[0]} {entries.length} items {bracket[1]}</span>}
        {expanded && <span className="text-muted-foreground">{bracket[0]}</span>}
        <PathButton path={currentPath} />
      </button>
      {expanded && (
        <div>
          {entries.map(([k, v]: [string, any]) => (
            <JsonTreeNode key={k} keyName={isArray ? k : k} value={v} defaultExpanded={defaultExpanded} searchTerm={searchTerm} path={currentPath} />
          ))}
          <div className="pl-4 font-mono text-sm text-muted-foreground">{bracket[1]}</div>
        </div>
      )}
    </div>
  );
};
