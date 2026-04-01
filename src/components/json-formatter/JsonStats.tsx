import { FileText, Layers, Key } from "lucide-react";

interface JsonStatsProps {
  input: string;
  parsedData: any;
}

const getDepth = (obj: any, current = 0): number => {
  if (obj === null || typeof obj !== "object") return current;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return current + 1;
    return Math.max(...obj.map((item) => getDepth(item, current + 1)));
  }
  const values = Object.values(obj);
  if (values.length === 0) return current + 1;
  return Math.max(...values.map((v) => getDepth(v, current + 1)));
};

const countKeys = (obj: any): number => {
  if (obj === null || typeof obj !== "object") return 0;
  if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countKeys(item), 0);
  return Object.keys(obj).length + Object.values(obj).reduce((sum: number, v) => sum + countKeys(v), 0);
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const JsonStats = ({ input, parsedData }: JsonStatsProps) => {
  if (!parsedData) return null;

  const size = new Blob([input]).size;
  const depth = getDepth(parsedData);
  const keys = countKeys(parsedData);

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {formatBytes(size)}</span>
      <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Depth: {depth}</span>
      <span className="flex items-center gap-1"><Key className="w-3 h-3" /> Keys: {keys}</span>
    </div>
  );
};
