/** Minimal recursive-descent regex parser → AST  */

export type RN =
  | { k: "lit";    v: string }
  | { k: "dot" }
  | { k: "cls";    raw: string; neg: boolean }
  | { k: "esc";    v: string }             // \d, \w, \s, etc.
  | { k: "anchor"; v: string }             // ^ $ \b \B
  | { k: "seq";    ch: RN[] }
  | { k: "alt";    ch: RN[] }
  | { k: "quant";  ch: RN; min: number; max: number | null; lazy: boolean }
  | { k: "group";  ch: RN; cap: boolean; name?: string; look?: string }
  | { k: "empty" }

class RParser {
  s = ""; i = 0; g = 0;

  run(src: string): RN {
    this.s = src; this.i = 0; this.g = 0;
    const r = this.alt();
    return r;
  }

  private c(): string { return this.s[this.i] ?? ""; }
  private eat(): string { return this.s[this.i++] ?? ""; }
  private end(): boolean { return this.i >= this.s.length; }

  private alt(): RN {
    const a: RN[] = [this.seq()];
    while (!this.end() && this.c() === "|") { this.i++; a.push(this.seq()); }
    return a.length === 1 ? a[0] : { k: "alt", ch: a };
  }

  private seq(): RN {
    const a: RN[] = [];
    while (!this.end() && this.c() !== ")" && this.c() !== "|") {
      const n = this.atom(); if (n) a.push(n);
    }
    if (!a.length) return { k: "empty" };
    return a.length === 1 ? a[0] : { k: "seq", ch: a };
  }

  private atom(): RN | null {
    const c = this.c(); if (!c) return null;
    let n: RN;
    if      (c === "(") n = this.group();
    else if (c === "[") n = this.cls();
    else if (c === "\\") n = this.esc();
    else if (c === ".")  { this.i++; n = { k: "dot" }; }
    else if (c === "^" || c === "$") { this.i++; n = { k: "anchor", v: c }; }
    else                 { this.i++; n = { k: "lit", v: c }; }
    return this.quant(n);
  }

  private quant(n: RN): RN {
    const c = this.c();
    let min = 0, max: number | null = 1;
    if      (c === "?") this.i++;
    else if (c === "*") { this.i++; max = null; }
    else if (c === "+") { this.i++; min = 1; max = null; }
    else if (c === "{") {
      const saved = this.i; this.i++;
      const s1 = this.i;
      while (!this.end() && /\d/.test(this.c())) this.i++;
      if (this.i === s1) { this.i = saved; return n; }
      const n1 = +this.s.slice(s1, this.i);
      if (this.c() === "}") { this.i++; min = n1; max = n1; }
      else if (this.c() === ",") {
        this.i++;
        if (this.c() === "}") { this.i++; min = n1; max = null; }
        else {
          const s2 = this.i;
          while (!this.end() && /\d/.test(this.c())) this.i++;
          const n2 = +this.s.slice(s2, this.i);
          if (this.c() === "}") { this.i++; min = n1; max = n2; }
          else { this.i = saved; return n; }
        }
      } else { this.i = saved; return n; }
    } else return n;
    const lazy = this.c() === "?" ? (this.i++, true) : false;
    return { k: "quant", ch: n, min, max, lazy };
  }

  private group(): RN {
    this.i++;                // consume (
    let cap = true, name: string | undefined, look: string | undefined;
    if (this.c() === "?") {
      this.i++;
      const s = this.c();
      if      (s === ":")  { this.i++; cap = false; }
      else if (s === "=")  { this.i++; cap = false; look = "(?=…)"; }
      else if (s === "!")  { this.i++; cap = false; look = "(?!…)"; }
      else if (s === "<")  {
        this.i++;
        if      (this.c() === "=") { this.i++; cap = false; look = "(?<=…)"; }
        else if (this.c() === "!") { this.i++; cap = false; look = "(?<!…)"; }
        else {
          const st = this.i;
          while (!this.end() && this.c() !== ">") this.i++;
          name = this.s.slice(st, this.i);
          if (this.c() === ">") this.i++;
        }
      }
    } else { this.g++; }
    const inner = this.alt();
    if (this.c() === ")") this.i++;
    return { k: "group", ch: inner, cap, name, look };
  }

  private cls(): RN {
    const st = this.i; this.i++;
    const neg = this.c() === "^" ? (this.i++, true) : false;
    while (!this.end() && !(this.c() === "]" && this.i > st + 1)) {
      if (this.c() === "\\") this.i++;
      this.i++;
    }
    if (this.c() === "]") this.i++;
    return { k: "cls", raw: this.s.slice(st, this.i), neg };
  }

  private esc(): RN {
    this.i++;
    const c = this.eat();
    if (c === "b") return { k: "anchor", v: "\\b" };
    if (c === "B") return { k: "anchor", v: "\\B" };
    if (/[dDwWsS]/.test(c)) return { k: "esc", v: `\\${c}` };
    if (/\d/.test(c)) return { k: "lit", v: `\\${c}` };     // backreference
    return { k: "lit", v: c };
  }
}

const P = new RParser();
export function parseRegex(src: string): RN {
  try { return P.run(src); }
  catch { return { k: "lit", v: src }; }
}
