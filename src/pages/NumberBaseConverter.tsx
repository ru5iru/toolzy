import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ToolSEO } from "@/components/ToolSEO";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { AboutTool } from "@/components/AboutTool";

type Base = 2 | 8 | 10 | 16;

interface BaseField {
  base: Base;
  label: string;
  prefix: string;
  placeholder: string;
}

const BASE_FIELDS: BaseField[] = [
  { base: 10, label: "Decimal", prefix: "", placeholder: "255" },
  { base: 2,  label: "Binary",  prefix: "0b", placeholder: "11111111" },
  { base: 8,  label: "Octal",   prefix: "0o", placeholder: "377" },
  { base: 16, label: "Hex",     prefix: "0x", placeholder: "FF" },
];

const BITWISE_OPS = [
  { label: "AND",  op: (a: bigint, b: bigint) => a & b },
  { label: "OR",   op: (a: bigint, b: bigint) => a | b },
  { label: "XOR",  op: (a: bigint, b: bigint) => a ^ b },
  { label: "NOT A", op: (a: bigint) => ~a },
  { label: "LSH",  op: (a: bigint, b: bigint) => a << b },
  { label: "RSH",  op: (a: bigint, b: bigint) => a >> b },
];

function toBigInt(val: string, base: Base): bigint | null {
  try {
    const v = val.trim();
    if (!v) return null;
    if (base === 10) {
      if (!/^-?[0-9]+$/.test(v)) return null;
      return BigInt(v);
    }
    if (base === 2  && /^[01]+$/.test(v))  return BigInt("0b" + v);
    if (base === 8  && /^[0-7]+$/.test(v)) return BigInt("0o" + v);
    if (base === 16 && /^[0-9a-fA-F]+$/.test(v)) return BigInt("0x" + v);
    return null;
  } catch {
    return null;
  }
}

function fromBigInt(n: bigint, base: Base): string {
  if (n < 0n) {
    if (base === 10) return n.toString();
    return "−" + (-n).toString(base).toUpperCase();
  }
  return n.toString(base).toUpperCase();
}

function groupBinary(s: string): string {
  return s.replace(/(.{1,4})(?=(.{4})+$)/g, "$1 ");
}

/** Convert a hex string to ASCII — returns null if any byte is non-printable. */
function hexToAscii(hex: string): string | null {
  const h = hex.replace(/\s/g, "");
  if (!h || h.length % 2 !== 0) return null;
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    const code = parseInt(h.slice(i, i + 2), 16);
    if (code < 0x20 || code > 0x7e) return null;
    out += String.fromCharCode(code);
  }
  return out || null;
}

/** Convert ASCII string to hex. */
function asciiToHex(s: string): string {
  return Array.from(s)
    .map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))
    .join("");
}

/** Render a binary string with alternating nibble colors. */
function NibblePattern({ bin }: { bin: string }) {
  if (!bin) return null;
  // pad to multiple of 4
  const padded = bin.padStart(Math.ceil(bin.length / 4) * 4, "0");
  const nibbles: string[] = [];
  for (let i = 0; i < padded.length; i += 4) nibbles.push(padded.slice(i, i + 4));
  return (
    <span className="font-mono text-sm tracking-widest break-all leading-relaxed">
      {nibbles.map((n, i) => (
        <span key={i} className={i % 2 === 0 ? "text-foreground" : "text-primary"}>
          {n}
          {i < nibbles.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

const NumberBaseConverter = () => {
  const [values, setValues] = useState<Record<Base, string>>({ 2: "", 8: "", 10: "", 16: "" });
  const [bitwiseA, setBitwiseA] = useState("");
  const [bitwiseB, setBitwiseB] = useState("");
  const [asciiInput, setAsciiInput] = useState("");

  const handleChange = useCallback((base: Base, raw: string) => {
    const v = raw.trim();
    if (!v) {
      setValues({ 2: "", 8: "", 10: "", 16: "" });
      return;
    }
    const n = toBigInt(v, base);
    if (n === null) return;
    const next: Record<Base, string> = { 2: "", 8: "", 10: "", 16: "" };
    next[base] = v.toUpperCase();
    ([2, 8, 10, 16] as Base[]).forEach((b) => {
      if (b !== base) next[b] = fromBigInt(n, b);
    });
    setValues(next);
  }, []);

  const handleClear = () => {
    setValues({ 2: "", 8: "", 10: "", 16: "" });
    setBitwiseA("");
    setBitwiseB("");
    setAsciiInput("");
  };

  const handleLoadSample = () => {
    handleChange(10, "255");
  };

  // Live bitwise — recomputes on every A/B change, no button needed
  const bitwiseResults = useMemo(() => {
    const a = toBigInt(bitwiseA.trim(), 10);
    if (a === null) return [];
    const b = toBigInt(bitwiseB.trim(), 10);
    return BITWISE_OPS.map(({ label, op }) => {
      try {
        let res: bigint;
        if (label === "NOT A") {
          res = op(a, 0n);
          const mask = (1n << 64n) - 1n;
          res = res & mask;
        } else {
          if (b === null) return null;
          res = op(a, b);
          if (res < 0n) {
            const mask = (1n << 64n) - 1n;
            res = res & mask;
          }
        }
        return {
          label,
          dec: res.toString(10),
          hex: res.toString(16).toUpperCase(),
          bin: groupBinary(res.toString(2)),
        };
      } catch {
        return null;
      }
    }).filter(Boolean) as { label: string; dec: string; hex: string; bin: string }[];
  }, [bitwiseA, bitwiseB]);

  const binValue = values[2];
  const hexValue = values[16];
  const showBitPattern = binValue.length > 0 && binValue.length <= 64;

  // ASCII decode of current hex value
  const hexAscii = hexValue ? hexToAscii(hexValue) : null;

  // Handle ASCII field → update hex + all bases
  const handleAsciiChange = (s: string) => {
    setAsciiInput(s);
    if (!s) {
      setValues({ 2: "", 8: "", 10: "", 16: "" });
      return;
    }
    const hex = asciiToHex(s);
    handleChange(16, hex);
  };

  return (
    <ToolPageLayout
      title="Number Base Converter"
      description="Convert between binary, octal, decimal and hexadecimal — with bitwise operations"
      maxWidth="narrow"
    >
      <ToolSEO
        title="Number Base Converter — Binary Decimal Hex Octal"
        description="Convert numbers between binary, octal, decimal and hexadecimal instantly. Includes live bitwise AND, OR, XOR, NOT, shifts, and hex↔ASCII conversion. Free, browser-only."
        canonicalPath="/number-base"
        keywords={["number base converter", "binary to decimal", "hex to binary", "decimal to hex", "octal converter", "bitwise calculator", "hex to ascii"]}
      />

      <div className="space-y-3">
        {/* Base conversion grid */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Base Converter</h2>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleLoadSample}>
                Sample
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            {BASE_FIELDS.map(({ base, label, prefix, placeholder }) => (
              <div key={base} className="flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                  {prefix && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{prefix}</span>}
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="text"
                    value={values[base]}
                    onChange={(e) => handleChange(base, e.target.value)}
                    placeholder={placeholder}
                    spellCheck={false}
                    className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <CopyButton value={values[base]} disabled={!values[base]} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Bit pattern visualization with nibble coloring */}
        {showBitPattern && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Bit Pattern</h2>
            <NibblePattern bin={binValue} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {binValue.length} bit{binValue.length !== 1 ? "s" : ""}
              {binValue.length <= 8 && " · 8-bit"}
              {binValue.length > 8 && binValue.length <= 16 && " · 16-bit"}
              {binValue.length > 16 && binValue.length <= 32 && " · 32-bit"}
              {binValue.length > 32 && " · 64-bit"}
              {" · alternating nibbles colored"}
            </p>
          </div>
        )}

        {/* Hex ↔ ASCII */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Hex ↔ ASCII</h2>
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <span className="text-xs font-semibold text-foreground">Hex</span>
              </div>
              <div className="flex-1 font-mono text-sm text-foreground min-h-[36px] flex items-center px-3 rounded-md border border-border/50 bg-muted/30">
                {hexValue || <span className="text-muted-foreground/50">—</span>}
              </div>
              {hexAscii && <CopyButton value={hexValue} size="sm" />}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <span className="text-xs font-semibold text-foreground">ASCII</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={asciiInput || hexAscii || ""}
                  onChange={(e) => handleAsciiChange(e.target.value)}
                  placeholder="Type ASCII to encode, or convert from hex above"
                  spellCheck={false}
                  className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {(asciiInput || hexAscii) && <CopyButton value={asciiInput || hexAscii || ""} size="sm" />}
            </div>
            {hexValue && !hexAscii && !asciiInput && (
              <p className="text-xs text-muted-foreground pl-[92px]">Hex value contains non-printable bytes — no ASCII representation</p>
            )}
          </div>
        </div>

        {/* Live bitwise operations */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bitwise Operations</h2>
            {bitwiseResults.length > 0 && (
              <span className="text-[10px] text-muted-foreground">updates live</span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="mb-1 block text-xs text-muted-foreground">A (decimal)</label>
              <input
                type="text"
                inputMode="numeric"
                value={bitwiseA}
                onChange={(e) => setBitwiseA(e.target.value)}
                placeholder="255"
                className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="mb-1 block text-xs text-muted-foreground">B (decimal)</label>
              <input
                type="text"
                inputMode="numeric"
                value={bitwiseB}
                onChange={(e) => setBitwiseB(e.target.value)}
                placeholder="170"
                className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {bitwiseResults.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground pr-4">Op</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground pr-4">Decimal</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground pr-4">Hex</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Binary</th>
                  </tr>
                </thead>
                <tbody>
                  {bitwiseResults.map((r) => (
                    <tr key={r.label} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 pr-4 font-semibold text-primary">{r.label}</td>
                      <td className="py-1.5 pr-4 font-mono">{r.dec}</td>
                      <td className="py-1.5 pr-4 font-mono">{r.hex}</td>
                      <td className="py-1.5 font-mono tracking-wider text-muted-foreground break-all">{r.bin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!bitwiseA.trim() && (
            <p className="mt-2 text-xs text-muted-foreground">Enter a decimal value for A to see results instantly.</p>
          )}
        </div>
      </div>

      <AboutTool>
        <p>Converts integers between binary (base 2), octal (base 8), decimal (base 10), and hexadecimal (base 16). Uses JavaScript's native <code>BigInt</code> for arbitrary-precision integers — handles values well beyond 32-bit or 64-bit limits.</p>
        <p className="mt-2">The bit pattern view color-codes alternating 4-bit nibbles for quick visual parsing. The hex↔ASCII panel converts printable ASCII strings to and from hex encoding. The bitwise section computes AND, OR, XOR, NOT, left-shift (LSH) and right-shift (RSH) live as you type — no button needed. Everything runs in your browser.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default NumberBaseConverter;
