import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CopyButton } from "@/components/CopyButton";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Regex, Share2 } from "lucide-react";
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

  type MatchEntry = { match: string; index: number; groups?: Record<string, string> };
  const { matches, error, segments } = useMemo<{
    matches: MatchEntry[];
    error: string;
    segments: Array<{ text: string; highlight: boolean }>;
  }>(() => {
    if (!debouncedPattern) return { matches: [], error: "", segments: [{ text: debouncedText, highlight: false }] };
    try {
      const re = new RegExp(debouncedPattern, flags);
      const m: MatchEntry[] = [];
      let match;
      if (flags.includes("g")) {
        while ((match = re.exec(debouncedText)) !== null) {
          m.push({ match: match[0], index: match.index, groups: match.groups as Record<string, string> | undefined });
          if (match[0].length === 0) re.lastIndex++;
        }
      } else {
        match = re.exec(debouncedText);
        if (match) m.push({ match: match[0], index: match.index, groups: match.groups as Record<string, string> | undefined });
      }

      // Build segments for highlight rendering
      const segs: Array<{ text: string; highlight: boolean }> = [];
      let last = 0;
      for (const mt of m) {
        if (mt.index > last) segs.push({ text: debouncedText.slice(last, mt.index), highlight: false });
        segs.push({ text: mt.match, highlight: true });
        last = mt.index + mt.match.length;
      }
      if (last < debouncedText.length) segs.push({ text: debouncedText.slice(last), highlight: false });

      return { matches: m, error: "", segments: segs };
    } catch (e: any) {
      return { matches: [], error: e.message, segments: [{ text: debouncedText, highlight: false }] };
    }
  }, [debouncedPattern, flags, debouncedText]);

  const [replacement, setReplacement] = useState("");
  const replaced = useMemo(() => {
    if (!debouncedPattern || error || !replacement) return null;
    try { return debouncedText.replace(new RegExp(debouncedPattern, flags), replacement); } catch { return null; }
  }, [debouncedPattern, flags, debouncedText, replacement, error]);

  const loadSnippet = (s: typeof snippets[0]) => {
    setPattern(s.pattern);
    setFlags(s.flags);
    toast.success(`Loaded ${s.label} pattern`);
  };

  return (
    <ToolPageLayout title="Regex Playground" icon={Regex} description="Live regex tester with real-time match highlighting, capture groups, replace preview, and a snippet library.">
      <ToolSEO title="Regex Playground" description="Live regex tester with real-time match highlighting, capture groups, and a library of common patterns. Test regular expressions online instantly." canonicalPath="/regex" keywords={["regex tester", "regex playground", "regular expression tester", "regex match highlighter", "test regex online"]} faq={[{question:"How do I test a regex?",answer:"Enter your regular expression pattern and flags, then type or paste test text below. Matches are highlighted in real-time as you type."},{question:"What common regex patterns are included?",answer:"Pre-built patterns for emails, URLs, IPv4 addresses, phone numbers, hex colors, and ISO dates — click any to load it instantly."},{question:"Can I share a regex test with a colleague?",answer:"Yes. Click Share to copy a link with your pattern, flags, and test text encoded in the URL."},{question:"Does the regex tester show capture groups?",answer:"Yes. Named capture groups are displayed for every match, along with each match's position in the test string."}]} howToSteps={["Enter a regex pattern and flags (e.g., g, i, m)","Type or paste test text in the text area","View highlighted matches and match details in real-time","Use the common patterns library for quick access"]} />

      {/* Snippet bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">Snippets</span>
        {snippets.map((s) => (
          <Button key={s.label} variant="secondary" size="sm" className="h-7 text-xs" onClick={() => loadSnippet(s)}>{s.label}</Button>
        ))}
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={shareLink} disabled={!pattern}>
          <Share2 className="w-3 h-3 mr-1" />Share
        </Button>
      </div>

      {/* Pattern + flags row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Pattern</label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-muted-foreground font-mono text-sm select-none">/</span>
            <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="[a-z]+" className="bg-card border-border font-mono pl-6 pr-6" />
            <span className="absolute right-3 text-muted-foreground font-mono text-sm select-none">/{flags}</span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Flags</label>
          <Input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="g" className="w-20 bg-card border-border font-mono" />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="regex-replace" className="text-xs text-muted-foreground uppercase tracking-wider">Replace with (optional)</label>
        <Input id="regex-replace" value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="$1, $<name>, $&" className="bg-card border-border font-mono" />
      </div>

      {error && (
        <p className="text-destructive font-mono text-sm bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>
      )}

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Test String</label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text to test against…" className="min-h-[150px] font-mono text-sm bg-card border-border resize-none" />
      </div>

      {pattern && text && (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Highlighted Matches</label>
              {matches.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-mono text-primary">
                  {matches.length} match{matches.length !== 1 ? "es" : ""}
                </span>
              )}
              {pattern && !error && matches.length === 0 && (
                <span className="text-xs text-muted-foreground">— no matches</span>
              )}
            </div>
            <pre className="bg-card border border-border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[300px] leading-relaxed">
              {segments.map((seg, i) =>
                seg.highlight ? (
                  <mark key={i} className="bg-primary/25 text-primary font-semibold rounded-sm px-0.5 not-italic">{seg.text}</mark>
                ) : (
                  <span key={i} className="text-foreground">{seg.text}</span>
                )
              )}
            </pre>
          </div>

          {replaced !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Replaced text</label>
                <CopyButton value={replaced} label="Copy" variant="outline" />
              </div>
              <pre className="code-surface max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-4">{replaced}</pre>
            </div>
          )}

          {matches.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Match details</label>
              <div className="space-y-1">
                {matches.slice(0, 50).map((m, i) => (
                  <div key={i} className="border border-border rounded p-2 bg-card font-mono text-sm flex flex-wrap gap-x-4 gap-y-1 items-baseline">
                    <span className="text-muted-foreground text-xs">#{i + 1}</span>
                    <span className="text-primary font-medium">{m.match || <em className="not-italic text-muted-foreground">empty</em>}</span>
                    <span className="text-muted-foreground text-xs">@{m.index}</span>
                    {m.groups && Object.keys(m.groups).length > 0 && (
                      <span className="text-muted-foreground text-xs">groups: {JSON.stringify(m.groups)}</span>
                    )}
                  </div>
                ))}
                {matches.length > 50 && (
                  <p className="text-xs text-muted-foreground">… and {matches.length - 50} more matches</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </ToolPageLayout>
  );
};

export default RegexPlayground;
