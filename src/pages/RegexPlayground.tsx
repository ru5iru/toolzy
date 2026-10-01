import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Share2 } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const encodeShare = (pattern: string, flags: string, text: string) =>
  btoa(unescape(encodeURIComponent(JSON.stringify({ p: pattern, f: flags, t: text }))));

const decodeShare = (): { p: string; f: string; t: string } | null => {
  try {
    const d = new URLSearchParams(window.location.search).get("d");
    if (!d) return null;
    return JSON.parse(decodeURIComponent(escape(atob(d))));
  } catch {
    return null;
  }
};

const snippets = [
  { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", flags: "g" },
  { label: "URL", pattern: "https?:\\/\\/[^\\s]+", flags: "g" },
  { label: "IPv4", pattern: "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b", flags: "g" },
  { label: "Phone", pattern: "\\+?\\d[\\d\\s\\-()]{7,}", flags: "g" },
  { label: "Hex Color", pattern: "#[0-9a-fA-F]{3,8}\\b", flags: "gi" },
  { label: "ISO Date", pattern: "\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}:\\d{2})?", flags: "g" },
];

const RegexPlayground = () => {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("");

  // Load shared state from URL on mount
  useEffect(() => {
    const shared = decodeShare();
    if (shared) {
      setPattern(shared.p);
      setFlags(shared.f);
      setText(shared.t);
      toast.success("Loaded regex from shared link");
    }
  }, []);

  const shareLink = () => {
    if (!pattern) { toast.error("Enter a pattern to share"); return; }
    const url = new URL(window.location.href);
    url.searchParams.set("d", encodeShare(pattern, flags, text));
    if (url.toString().length > 8000) { toast.error("Text too large for URL sharing"); return; }
    navigator.clipboard.writeText(url.toString());
    window.history.replaceState(null, "", url.toString());
    toast.success("Shareable link copied to clipboard!");
  };

  const debouncedPattern = useDebouncedValue(pattern, 300);
  const debouncedText = useDebouncedValue(text, 300);

  const { matches, error, highlighted } = useMemo(() => {
    if (!debouncedPattern) return { matches: [], error: "", highlighted: debouncedText };
    try {
      const re = new RegExp(pattern, flags);
      const m: { match: string; index: number; groups?: Record<string, string> }[] = [];
      let match;
      if (flags.includes("g")) {
        while ((match = re.exec(text)) !== null) {
          m.push({ match: match[0], index: match.index, groups: match.groups });
          if (match[0].length === 0) re.lastIndex++;
        }
      } else {
        match = re.exec(text);
        if (match) m.push({ match: match[0], index: match.index, groups: match.groups });
      }

      // Build highlighted string
      let hl = "";
      let last = 0;
      for (const mt of m) {
        hl += text.slice(last, mt.index);
        hl += `【${mt.match}】`;
        last = mt.index + mt.match.length;
      }
      hl += text.slice(last);

      return { matches: m, error: "", highlighted: hl };
    } catch (e: any) {
      return { matches: [], error: e.message, highlighted: text };
    }
  }, [pattern, flags, text]);

  const loadSnippet = (s: typeof snippets[0]) => {
    setPattern(s.pattern);
    setFlags(s.flags);
    toast.success(`Loaded ${s.label} pattern`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ToolSEO title="Regex Playground" description="Live regex tester with real-time match highlighting, capture groups, and a library of common patterns. Test regular expressions online instantly." canonicalPath="/regex" keywords={["regex tester", "regex playground", "regular expression tester", "regex match highlighter", "test regex online"]} faq={[{question:"How do I test a regex?",answer:"Enter your regular expression pattern and flags, then type or paste test text below. Matches are highlighted in real-time as you type."},{question:"What common regex patterns are included?",answer:"Pre-built patterns for emails, URLs, IPv4 addresses, phone numbers, hex colors, and ISO dates — click any to load it instantly."}]} howToSteps={["Enter a regex pattern and flags (e.g., g, i, m)","Type or paste test text in the text area","View highlighted matches and match details in real-time","Use the common patterns library for quick access"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground">Regex Playground</h1>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Common Patterns</label>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={shareLink} disabled={!pattern}>
            <Share2 className="w-3 h-3 mr-1" />Share
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {snippets.map((s) => (
            <Button key={s.label} variant="secondary" size="sm" onClick={() => loadSnippet(s)}>{s.label}</Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Pattern</label>
          <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="[a-z]+" className="bg-card border-border font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Flags</label>
          <Input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="g" className="w-20 bg-card border-border font-mono" />
        </div>
      </div>

      {error && <p className="text-destructive font-mono text-sm">{error}</p>}

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Test String</label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text to test against…" className="min-h-[150px] font-mono text-sm bg-card border-border resize-none" />
      </div>

      {pattern && text && (
        <>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Highlighted Matches</label>
            <pre className="bg-card border border-border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[300px]">
              {highlighted.split(/【|】/).map((part, i) =>
                i % 2 === 1 ? (
                  <span key={i} className="bg-primary/30 text-primary font-bold rounded px-0.5">{part}</span>
                ) : (
                  <span key={i} className="text-foreground">{part}</span>
                )
              )}
            </pre>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Matches ({matches.length})
            </label>
            {matches.length === 0 ? (
              <p className="text-muted-foreground font-mono text-sm">No matches</p>
            ) : (
              <div className="space-y-1">
                {matches.slice(0, 50).map((m, i) => (
                  <div key={i} className="border border-border rounded p-2 bg-card font-mono text-sm flex gap-4">
                    <span className="text-muted-foreground">#{i + 1}</span>
                    <span className="text-primary">{m.match}</span>
                    <span className="text-muted-foreground">@{m.index}</span>
                    {m.groups && Object.keys(m.groups).length > 0 && (
                      <span className="text-muted-foreground">groups: {JSON.stringify(m.groups)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RegexPlayground;
