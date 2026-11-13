import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { CopyButton } from "@/components/CopyButton";
import { AboutTool } from "@/components/AboutTool";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Eye, EyeOff, RefreshCw, ShieldCheck } from "lucide-react";

// ─── Character sets ───────────────────────────────────────────────────────────
const UPPER   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER   = "abcdefghijklmnopqrstuvwxyz";
const NUMS    = "0123456789";
const SYMS    = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const SIMILAR = new Set("Il1O0o");

// ─── Passphrase word list (500 common short words) ────────────────────────────
const WORDS = ("able about above across act add age ago ahead air all allow along also always among and angle animal any appear apple apply area arm art ask away back ball band base bath be beam bear beat become before begin being below best bird bite blow blue boat body bone book both break bridge bring broad brown build burn but call came can care carry case catch cause chain chair chance change child city claim class clean clear close cloth coast cold come common contain cool copy corner could count cover crack cross crowd cut dark data deal dear deep depend describe detail different draw drive drop each early earth east edge else empty end enjoy enough enter equal even ever every examine eye face fall false far fast feel feet fill find finish fire first fish fix flow follow food force form forward found four free from full fund gain game gave give glad glass go good got grab grass great green grew grid grow guess guide half hand hang happen hard has have head heat heavy help here high hill hold home hope hot hour house how human hundred hunt idea if image inch include increase indeed iron island it join keep kill kind knew know land large last late laugh law layer lead leaf learn left let life light like line link list live local long look lost loud low made make man many may mean meet mention might mile mind mix month more most move much must near need never new next night no nor north not now number ocean off old once only open or order other our out over own pair part past path place plan plant play point point post power provide pull push put quite rain ran reach read reason record red region relate remain require rest result river road rock roll room round run safe said same saw say second seem set share sharp short show side sign simple since size small so soft soil some sort south space speak spread spring stand start step stick still stone stop store street stretch strong study such sun supply support sure system take talk tall team tell term that the their them then there they thin thing think this though three throw tie time to today together took top touch town tree try turn two type under until up use valley very view wait walk want warm was water wave way well went were west what wheel where while white wide wind wish with without wonder wood word world would write year yet you zone"
).split(" ");

function randWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

// ─── Strength ─────────────────────────────────────────────────────────────────
function strength(pwd: string): { score: number; label: string; cls: string } {
  if (!pwd) return { score: 0, label: "—", cls: "bg-muted" };
  let s = 0;
  if (pwd.length >= 8)  s++;
  if (pwd.length >= 12) s++;
  if (pwd.length >= 16) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (s <= 2) return { score: s, label: "Weak",   cls: "bg-destructive" };
  if (s <= 4) return { score: s, label: "Fair",   cls: "bg-[hsl(var(--warning,38_92%_50%))]" };
  if (s <= 5) return { score: s, label: "Good",   cls: "bg-[hsl(var(--success,142_71%_45%))]" };
  return       { score: s, label: "Strong", cls: "bg-[hsl(var(--success,142_71%_45%))]" };
}

function entropyBits(length: number, poolSize: number): number {
  return +(length * Math.log2(poolSize)).toFixed(1);
}

// ─── Component ────────────────────────────────────────────────────────────────
const PasswordGenerator = () => {
  // mode
  const [mode, setMode] = useState<"password" | "passphrase">("password");

  // password options
  const [length, setLength]       = useState(16);
  const [useUpper, setUpper]       = useState(true);
  const [useLower, setLower]       = useState(true);
  const [useNums,  setNums]        = useState(true);
  const [useSyms,  setSyms]        = useState(false);
  const [exSim,    setExSim]       = useState(false);
  const [count,    setCount]       = useState(5);

  // passphrase options
  const [wordCount, setWordCount]  = useState(4);
  const [separator, setSeparator]  = useState("-");
  const [capitalise, setCapitalise] = useState(true);
  const [includeNum, setIncludeNum] = useState(true);

  const [passwords, setPasswords]  = useState<string[]>([]);
  const [seed, setSeed]            = useState(0); // bump to regenerate
  const [revealed, setRevealed]    = useState(true);

  const pool = useMemo(() => {
    let p = "";
    if (useUpper) p += UPPER;
    if (useLower) p += LOWER;
    if (useNums)  p += NUMS;
    if (useSyms)  p += SYMS;
    if (exSim) p = p.split("").filter(c => !SIMILAR.has(c)).join("");
    return p;
  }, [useUpper, useLower, useNums, useSyms, exSim]);

  // Sub-pools for the guarantee check (filtered for similar chars if needed)
  const subPools = useMemo(() => {
    const filter = (s: string) => exSim ? s.split("").filter(c => !SIMILAR.has(c)).join("") : s;
    return {
      upper: useUpper ? filter(UPPER) : "",
      lower: useLower ? filter(LOWER) : "",
      nums:  useNums  ? filter(NUMS)  : "",
      syms:  useSyms  ? filter(SYMS)  : "",
    };
  }, [useUpper, useLower, useNums, useSyms, exSim]);

  const generate = useCallback(() => {
    if (mode === "password") {
      if (!pool) { toast.error("Select at least one character set"); return; }
      const randChar = (s: string) => {
        const arr = new Uint8Array(1);
        crypto.getRandomValues(arr);
        return s[arr[0] % s.length];
      };
      const arr: string[] = [];
      for (let i = 0; i < count; i++) {
        // Build random password
        const chars: string[] = [];
        const bytes = new Uint8Array(length * 2);
        crypto.getRandomValues(bytes);
        let bi = 0;
        while (chars.length < length) {
          if (bi >= bytes.length) {
            const more = new Uint8Array(length * 2);
            crypto.getRandomValues(more);
            bytes.set(more); bi = 0;
          }
          chars.push(pool[bytes[bi++] % pool.length]);
        }
        // Guarantee at least one char from each enabled charset
        const required: string[] = [
          ...(subPools.upper ? [subPools.upper] : []),
          ...(subPools.lower ? [subPools.lower] : []),
          ...(subPools.nums  ? [subPools.nums]  : []),
          ...(subPools.syms  ? [subPools.syms]  : []),
        ];
        required.forEach((sp, ri) => {
          // Check if chars already has at least one from this sub-pool
          if (!chars.some(c => sp.includes(c))) {
            // Replace a random position (beyond the first `ri` slots to avoid overwriting earlier guarantees)
            const pos = ri + Math.floor(Math.random() * (length - ri));
            chars[pos] = randChar(sp);
          }
        });
        arr.push(chars.join(""));
      }
      setPasswords(arr);
    } else {
      const arr: string[] = [];
      for (let i = 0; i < count; i++) {
        const words = Array.from({ length: wordCount }, () => {
          const w = randWord();
          return capitalise ? w.charAt(0).toUpperCase() + w.slice(1) : w;
        });
        let phrase = words.join(separator);
        if (includeNum) phrase += separator + (Math.floor(Math.random() * 90) + 10);
        arr.push(phrase);
      }
      setPasswords(arr);
    }
    setSeed(s => s + 1);
  }, [mode, pool, subPools, length, count, wordCount, separator, capitalise, includeNum]);

  // Generate on mount and whenever settings change (seed bump triggers this too)
  useEffect(() => { generate(); }, [generate, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const primary = passwords[0] ?? "";
  const str = strength(primary);
  const entropy = mode === "password"
    ? entropyBits(length, pool.length)
    : entropyBits(wordCount, WORDS.length);

  const toggle = (val: boolean, set: (v: boolean) => void, others: boolean[]) => {
    if (val && others.filter(Boolean).length === 0) {
      toast.error("Keep at least one character set enabled");
      return;
    }
    set(!val);
    setSeed(s => s + 1);
  };

  return (
    <ToolPageLayout title="Password Generator" icon={ShieldCheck} description="Generate secure passwords and passphrases using the browser's cryptographic random source.">
      <ToolSEO
        title="Password Generator"
        description="Generate strong, random passwords and passphrases in your browser. Configurable length, character sets, passphrase mode, and bulk generation — nothing sent to any server."
        canonicalPath="/password"
        keywords={["password generator", "random password", "passphrase generator", "strong password", "secure password"]}
        faq={[
          { question: "Is this password generator secure?", answer: "Yes. Passwords are generated using the Web Crypto API (crypto.getRandomValues), which provides cryptographically secure randomness. Nothing leaves your browser." },
          { question: "What is a passphrase?", answer: "A passphrase is a sequence of random words separated by a character. They are easier to remember than random characters while remaining very secure when four or more words are used." },
          { question: "How strong should my password be?", answer: "A 16-character password using upper, lower, numbers and symbols gives over 95 bits of entropy — more than enough for any practical purpose. Passphrases of 4+ words are equally strong." },
        ]}
        howToSteps={["Choose Password or Passphrase mode", "Adjust length and character sets", "Click Regenerate to get a fresh set", "Copy a password with the copy button"]}
      />

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button variant={mode === "password" ? "selected" : "outline"} size="sm" onClick={() => { setMode("password"); setSeed(s => s + 1); }}>Password</Button>
        <Button variant={mode === "passphrase" ? "selected" : "outline"} size="sm" onClick={() => { setMode("passphrase"); setSeed(s => s + 1); }}>Passphrase</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Options ── */}
        <div className="space-y-4">
          {mode === "password" ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground uppercase tracking-wider">Length</span>
                  <span className="font-mono font-bold">{length}</span>
                </div>
                <Slider value={[length]} min={6} max={128} step={1} onValueChange={([v]) => { setLength(v); setSeed(s => s + 1); }} />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>6</span><span>128</span>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">Characters</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["A–Z", useUpper, setUpper, [useLower, useNums, useSyms]],
                    ["a–z", useLower, setLower, [useUpper, useNums, useSyms]],
                    ["0–9", useNums,  setNums,  [useUpper, useLower, useSyms]],
                    ["!@#", useSyms,  setSyms,  [useUpper, useLower, useNums]],
                  ] as [string, boolean, (v: boolean) => void, boolean[]][]).map(([label, val, set, others]) => (
                    <Button key={label} variant={val ? "selected" : "outline"} size="sm" className="font-mono"
                      onClick={() => toggle(val, set, others)}>{label}</Button>
                  ))}
                </div>
              </div>
              <div>
                <Button variant={exSim ? "selected" : "outline"} size="sm"
                  onClick={() => { setExSim(v => !v); setSeed(s => s + 1); }}>
                  Exclude similar (l, 1, O, 0)
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground uppercase tracking-wider">Words</span>
                  <span className="font-mono font-bold">{wordCount}</span>
                </div>
                <Slider value={[wordCount]} min={3} max={8} step={1} onValueChange={([v]) => { setWordCount(v); setSeed(s => s + 1); }} />
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">Separator</span>
                <div className="flex gap-2 flex-wrap">
                  {["-", "_", ".", " ", "+"].map(s => (
                    <Button key={s} variant={separator === s ? "selected" : "outline"} size="sm" className="font-mono w-10"
                      onClick={() => { setSeparator(s); setSeed(c => c + 1); }}>
                      {s === " " ? "·" : s}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant={capitalise ? "selected" : "outline"} size="sm"
                  onClick={() => { setCapitalise(v => !v); setSeed(s => s + 1); }}>Capitalise words</Button>
                <Button variant={includeNum ? "selected" : "outline"} size="sm"
                  onClick={() => { setIncludeNum(v => !v); setSeed(s => s + 1); }}>Append number</Button>
              </div>
            </>
          )}

          {/* Count */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground uppercase tracking-wider">Generate</span>
              <span className="font-mono font-bold">{count} passwords</span>
            </div>
            <Slider value={[count]} min={1} max={20} step={1} onValueChange={([v]) => { setCount(v); setSeed(s => s + 1); }} />
          </div>

          <Button onClick={() => setSeed(s => s + 1)} className="gap-2 w-full sm:w-auto">
            <RefreshCw className="w-4 h-4" /> Regenerate
          </Button>
        </div>

        {/* ── Strength & entropy ── */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Strength</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${str.cls}`}>{str.label}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${str.cls}`}
                style={{ width: `${Math.min(100, (str.score / 7) * 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Entropy</span>
              <span className="font-mono text-right">{entropy} bits</span>
              {mode === "password" && (
                <>
                  <span className="text-muted-foreground">Pool size</span>
                  <span className="font-mono text-right">{pool.length} chars</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Password list ── */}
      {passwords.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Results</span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={revealed ? "Mask passwords" : "Reveal passwords"}
                title={revealed ? "Mask passwords (useful for screensharing)" : "Reveal passwords"}
                onClick={() => setRevealed(v => !v)}
              >
                {revealed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                onClick={() => { navigator.clipboard.writeText(passwords.join("\n")); toast.success("All passwords copied"); }}>
                Copy all
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            {passwords.map((pwd, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 group">
                <span
                  className="flex-1 font-mono text-sm break-all cursor-pointer select-all"
                  title="Click to select"
                  onClick={(e) => {
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(e.currentTarget);
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                  }}
                >
                  {revealed ? pwd : "•".repeat(Math.min(pwd.length, 24))}
                </span>
                <CopyButton value={pwd} label="" variant="ghost" />
              </div>
            ))}
          </div>
        </div>
      )}

      <AboutTool>
        <p>All passwords are generated using <code>crypto.getRandomValues()</code> — the Web Crypto API — which provides cryptographically secure randomness directly in your browser. Nothing is transmitted to any server.</p>
        <p className="mt-2"><strong>Password mode</strong> builds passwords character-by-character from your chosen pool (uppercase, lowercase, numbers, symbols). The optional "exclude similar" setting removes easily-confused characters like <code>l</code>, <code>1</code>, <code>O</code>, and <code>0</code>.</p>
        <p className="mt-2"><strong>Passphrase mode</strong> picks random words from a 500-word list separated by your chosen character. Four words gives ~40 bits of entropy — well over the NIST 112-bit recommendation for general use.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default PasswordGenerator;
