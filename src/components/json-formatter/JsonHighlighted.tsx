import { useMemo } from "react";

// Tokenizes a JSON string into colored spans using semantic syntax tokens.
const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

export const JsonHighlighted = ({ code }: { code: string }) => {
  const parts = useMemo(() => {
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(code)) !== null) {
      if (m.index > last) out.push(code.slice(last, m.index));
      const [full, str, colon, bool, nul, num] = m;
      if (str !== undefined) {
        out.push(
          <span key={i++} className={colon ? "text-[hsl(var(--syntax-key))]" : "text-[hsl(var(--syntax-string))]"}>
            {str}
          </span>
        );
        if (colon) out.push(colon);
      } else if (bool !== undefined) {
        out.push(<span key={i++} className="text-[hsl(var(--syntax-boolean))]">{bool}</span>);
      } else if (nul !== undefined) {
        out.push(<span key={i++} className="text-[hsl(var(--syntax-null))]">{nul}</span>);
      } else if (num !== undefined) {
        out.push(<span key={i++} className="text-[hsl(var(--syntax-number))]">{num}</span>);
      }
      last = m.index + full.length;
    }
    if (last < code.length) out.push(code.slice(last));
    return out;
  }, [code]);

  return (
    <pre className="flex-1 min-h-0 p-3 overflow-auto font-mono text-sm text-foreground whitespace-pre-wrap break-all">
      {parts}
    </pre>
  );
};
