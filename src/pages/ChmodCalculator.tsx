import { useState, useMemo } from "react";
import { CopyButton } from "@/components/CopyButton";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { AboutTool } from "@/components/AboutTool";
import { toast } from "sonner";

type PermBit = "r" | "w" | "x";
type Entity = "owner" | "group" | "other";

interface Perms {
  r: boolean;
  w: boolean;
  x: boolean;
}

interface Special {
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

const ENTITIES: { key: Entity; label: string; short: string }[] = [
  { key: "owner", label: "Owner (u)", short: "u" },
  { key: "group", label: "Group (g)", short: "g" },
  { key: "other", label: "Others (o)", short: "o" },
];

const SPECIAL_BITS: { key: keyof Special; label: string; sym: string; desc: string }[] = [
  { key: "setuid", label: "setuid", sym: "s/S", desc: "Run as file owner (owner exec → s, else S)" },
  { key: "setgid", label: "setgid", sym: "s/S", desc: "Run as group / inherit group in dirs (group exec → s, else S)" },
  { key: "sticky", label: "sticky", sym: "t/T", desc: "Only owner can delete in directory (others exec → t, else T)" },
];

const PRESETS: { label: string; octal: string; note: string }[] = [
  { label: "644",  octal: "644",  note: "Files — owner read/write, rest read-only" },
  { label: "755",  octal: "755",  note: "Executables/dirs — owner all, rest read+exec" },
  { label: "600",  octal: "600",  note: "Private files — owner read/write only" },
  { label: "700",  octal: "700",  note: "Private dir/script — owner only" },
  { label: "666",  octal: "666",  note: "World-writable file (not recommended)" },
  { label: "777",  octal: "777",  note: "World-writable dir (not recommended)" },
  { label: "400",  octal: "400",  note: "Read-only (SSH key)" },
  { label: "711",  octal: "711",  note: "Executables — owner all, rest exec only" },
  { label: "4755", octal: "4755", note: "setuid + 755 (e.g. sudo, ping)" },
  { label: "2755", octal: "2755", note: "setgid + 755 (shared dir, inherit group)" },
  { label: "1777", octal: "1777", note: "sticky + 777 (e.g. /tmp)" },
];

type PermState = Record<Entity, Perms>;

function permsToOctal(perms: PermState, special: Special): string {
  const digit = (p: Perms) => ((p.r ? 4 : 0) + (p.w ? 2 : 0) + (p.x ? 1 : 0)).toString();
  const sp = (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0);
  const base = digit(perms.owner) + digit(perms.group) + digit(perms.other);
  return sp ? sp.toString() + base : base;
}

function octalToPerms(oct: string): { perms: PermState; special: Special } | null {
  if (!/^[0-7]{3,4}$/.test(oct)) return null;
  const padded = oct.padStart(4, "0");
  const sp = parseInt(padded[0]);
  const parse = (d: string): Perms => {
    const n = parseInt(d);
    return { r: (n & 4) !== 0, w: (n & 2) !== 0, x: (n & 1) !== 0 };
  };
  return {
    perms:   { owner: parse(padded[1]), group: parse(padded[2]), other: parse(padded[3]) },
    special: { setuid: (sp & 4) !== 0, setgid: (sp & 2) !== 0, sticky: (sp & 1) !== 0 },
  };
}

function permsToSymbolic(perms: PermState, special: Special, isDir: boolean): string {
  const ownerX  = special.setuid ? (perms.owner.x ? "s" : "S") : (perms.owner.x ? "x" : "-");
  const groupX  = special.setgid ? (perms.group.x ? "s" : "S") : (perms.group.x ? "x" : "-");
  const otherX  = special.sticky ? (perms.other.x ? "t" : "T") : (perms.other.x ? "x" : "-");
  const owner   = `${perms.owner.r ? "r" : "-"}${perms.owner.w ? "w" : "-"}${ownerX}`;
  const group   = `${perms.group.r ? "r" : "-"}${perms.group.w ? "w" : "-"}${groupX}`;
  const other   = `${perms.other.r ? "r" : "-"}${perms.other.w ? "w" : "-"}${otherX}`;
  return `${isDir ? "d" : "-"}${owner}${group}${other}`;
}

function initialPerms(): PermState {
  return { owner: { r: true, w: true, x: false }, group: { r: true, w: false, x: false }, other: { r: true, w: false, x: false } };
}

function initialSpecial(): Special {
  return { setuid: false, setgid: false, sticky: false };
}

const ChmodCalculator = () => {
  const [perms, setPerms] = useState<PermState>(initialPerms());
  const [special, setSpecial] = useState<Special>(initialSpecial());
  const [octalInput, setOctalInput] = useState("");
  const [octalError, setOctalError] = useState(false);
  const [isDir, setIsDir] = useState(false);

  const octal    = useMemo(() => permsToOctal(perms, special), [perms, special]);
  const symbolic = useMemo(() => permsToSymbolic(perms, special, isDir), [perms, special, isDir]);
  const chmodCmd = `chmod ${octal} filename`;

  const toggle = (entity: Entity, bit: PermBit) => {
    setPerms((prev) => ({ ...prev, [entity]: { ...prev[entity], [bit]: !prev[entity][bit] } }));
  };

  const toggleSpecial = (key: keyof Special) => {
    setSpecial((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOctalChange = (val: string) => {
    setOctalInput(val);
    if (val.length === 0) { setOctalError(false); return; }
    const parsed = octalToPerms(val);
    if (parsed) {
      setPerms(parsed.perms);
      setSpecial(parsed.special);
      setOctalError(false);
    } else {
      setOctalError(true);
    }
  };

  const applyPreset = (oct: string) => {
    const parsed = octalToPerms(oct);
    if (parsed) { setPerms(parsed.perms); setSpecial(parsed.special); setOctalInput(""); toast.success(`Applied ${oct}`); }
  };

  const permBg = (on: boolean, bit: PermBit): string => {
    if (!on) return "bg-card text-muted-foreground border-border";
    if (bit === "r") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (bit === "w") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-green-500/15 text-green-400 border-green-500/30";
  };

  return (
    <ToolPageLayout
      title="chmod Calculator"
      description="Compute Unix file permission octals and symbolic notation interactively"
      maxWidth="narrow"
    >
      <ToolSEO
        title="chmod Calculator — Unix File Permission Calculator"
        description="Calculate Unix/Linux file permissions. Toggle checkboxes to build chmod octals and symbolic notation. Free, browser-only."
        canonicalPath="/chmod"
        keywords={["chmod calculator", "unix permissions", "linux file permissions", "octal permissions", "chmod 755", "chmod 644", "file permission calculator"]}
      />

      <div className="space-y-3">
        {/* Permission grid */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Permissions</h2>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={isDir}
                onChange={(e) => setIsDir(e.target.checked)}
                className="rounded border-border"
              />
              Directory
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground pr-4">Entity</th>
                  <th className="pb-2 text-center text-xs font-medium text-muted-foreground px-2 w-24">Read (4)</th>
                  <th className="pb-2 text-center text-xs font-medium text-muted-foreground px-2 w-24">Write (2)</th>
                  <th className="pb-2 text-center text-xs font-medium text-muted-foreground px-2 w-24">Execute (1)</th>
                  <th className="pb-2 text-right text-xs font-medium text-muted-foreground pl-4">Octal</th>
                </tr>
              </thead>
              <tbody>
                {ENTITIES.map(({ key, label }) => {
                  const p = perms[key];
                  const digit = (p.r ? 4 : 0) + (p.w ? 2 : 0) + (p.x ? 1 : 0);
                  return (
                    <tr key={key} className="border-t border-border/40">
                      <td className="py-2 pr-4 text-xs font-semibold text-foreground">{label}</td>
                      {(["r", "w", "x"] as PermBit[]).map((bit) => (
                        <td key={bit} className="py-2 px-2 text-center">
                          <button
                            onClick={() => toggle(key, bit)}
                            className={`inline-flex h-8 w-16 items-center justify-center rounded-md border text-xs font-mono font-semibold transition-all ${permBg(p[bit], bit)}`}
                            aria-label={`Toggle ${bit} for ${key}`}
                            aria-pressed={p[bit]}
                          >
                            {p[bit] ? bit : "−"}
                          </button>
                        </td>
                      ))}
                      <td className="py-2 pl-4 text-right font-mono text-lg font-bold text-foreground tabular-nums">
                        {digit}
                      </td>
                    </tr>
                  );
                })}
                {/* Special bits row */}
                <tr className="border-t border-border/40">
                  <td className="py-2 pr-4 text-xs font-semibold text-foreground">Special</td>
                  <td className="py-2 px-2 text-center" colSpan={3}>
                    <div className="flex justify-center gap-2">
                      {SPECIAL_BITS.map(({ key, label, sym, desc }) => (
                        <button
                          key={key}
                          onClick={() => toggleSpecial(key)}
                          title={desc}
                          aria-label={`Toggle ${label}`}
                          aria-pressed={special[key]}
                          className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-mono font-semibold transition-all ${special[key] ? "bg-purple-500/15 text-purple-400 border-purple-500/30" : "bg-card text-muted-foreground border-border"}`}
                        >
                          {label}&nbsp;<span className="opacity-60">{sym}</span>
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pl-4 text-right font-mono text-lg font-bold text-foreground tabular-nums">
                    {(special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0) || <span className="text-muted-foreground text-sm">—</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Result summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-1 text-xs text-muted-foreground">Octal</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-3xl font-bold text-foreground tracking-widest">{octal}</span>
              <CopyButton value={octal} size="sm" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-1 text-xs text-muted-foreground">Symbolic</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-foreground tracking-wider">{symbolic}</span>
              <CopyButton value={symbolic} size="sm" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-1 text-xs text-muted-foreground">Command</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate font-mono text-xs text-foreground">{chmodCmd}</code>
              <CopyButton value={chmodCmd} size="sm" />
            </div>
          </div>
        </div>

        {/* Octal input */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Load from octal</h2>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={octalInput}
              onChange={(e) => handleOctalChange(e.target.value)}
              placeholder="e.g. 755 or 4755"
              className={`h-9 w-36 rounded-md border px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring ${octalError ? "border-destructive bg-destructive/5" : "border-border bg-background hover:border-primary/40"}`}
            />
            {octalError && <p className="self-center text-xs text-destructive">Use 3–4 octal digits (0–7)</p>}
          </div>
        </div>

        {/* Presets */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Common presets</h2>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PRESETS.map(({ label, octal: oct, note }) => (
              <button
                key={`${label}-${oct}`}
                onClick={() => applyPreset(oct)}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-secondary group"
              >
                <code className="text-sm font-bold font-mono text-primary w-8 shrink-0">{oct}</code>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">{note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <AboutTool>
        <p>Unix file permissions are represented as three octal digits — one each for the owner, group, and others. Each digit is the sum of <strong>Read (4)</strong>, <strong>Write (2)</strong>, and <strong>Execute (1)</strong>. For example, <code>755</code> means owner has all three (4+2+1=7), and group/others have read+execute (4+1=5).</p>
        <p className="mt-2">A fourth leading digit encodes the <strong>special bits</strong>: <strong>setuid (4)</strong> makes an executable run as the file owner; <strong>setgid (2)</strong> runs as the group (and makes new files in a directory inherit the group); <strong>sticky (1)</strong> on a directory prevents users from deleting others' files (classic use: <code>/tmp</code>). In symbolic notation, the execute position shows <code>s</code> (setuid/setgid with exec), <code>S</code> (without exec), <code>t</code> (sticky with exec), or <code>T</code> (sticky without exec).</p>
        <p className="mt-2">Symbolic notation uses <code>rwx</code> for each set, with <code>-</code> for absent permissions. <code>-rwxr-xr-x</code> is equivalent to <code>755</code>. The leading character is <code>-</code> for files and <code>d</code> for directories. All computation is done in your browser.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default ChmodCalculator;
