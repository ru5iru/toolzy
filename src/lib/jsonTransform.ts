/**
 * Lightweight jq-like JSON transformer — runs entirely in the browser.
 * Supports a subset of jq syntax: path access, array ops, pipes, etc.
 */

export interface TransformResult {
  output: string;
  error?: string;
}

// ─── Tiny jq-subset evaluator ─────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Evaluate a single filter expression against a value */
function evalFilter(filter: string, input: unknown): unknown {
  filter = filter.trim();

  // Identity
  if (filter === ".") return input;

  // keys, values, length, type, has, in
  if (filter === "keys") {
    if (isObj(input)) return Object.keys(input).sort();
    if (Array.isArray(input)) return input.map((_, i) => i);
    throw new Error("keys requires an object or array");
  }
  if (filter === "keys_unsorted") {
    if (isObj(input)) return Object.keys(input);
    if (Array.isArray(input)) return input.map((_, i) => i);
    throw new Error("keys_unsorted requires an object or array");
  }
  if (filter === "values") {
    if (isObj(input)) return Object.values(input);
    if (Array.isArray(input)) return [...input];
    throw new Error("values requires an object or array");
  }
  if (filter === "length") {
    if (input === null) return 0;
    if (typeof input === "string" || Array.isArray(input)) return input.length;
    if (isObj(input)) return Object.keys(input).length;
    if (typeof input === "number") return Math.abs(input);
    throw new Error("length not supported for type " + typeof input);
  }
  if (filter === "type") {
    if (input === null) return "null";
    if (Array.isArray(input)) return "array";
    return typeof input;
  }
  if (filter === "not") return !input;
  if (filter === "empty") return undefined; // signals no output
  if (filter === "null") return null;
  if (filter === "true") return true;
  if (filter === "false") return false;
  if (filter === "ascii_downcase") {
    if (typeof input !== "string") throw new Error("ascii_downcase requires string");
    return input.toLowerCase();
  }
  if (filter === "ascii_upcase") {
    if (typeof input !== "string") throw new Error("ascii_upcase requires string");
    return input.toUpperCase();
  }
  if (filter === "ltrimstr" || filter === "rtrimstr") throw new Error(`${filter} requires argument`);
  if (filter === "tostring") return JSON.stringify(input);
  if (filter === "tonumber") {
    const n = Number(input);
    if (isNaN(n)) throw new Error("cannot convert to number: " + JSON.stringify(input));
    return n;
  }
  if (filter === "tojson") return JSON.stringify(input);
  if (filter === "fromjson") {
    if (typeof input !== "string") throw new Error("fromjson requires string");
    return JSON.parse(input);
  }
  if (filter === "flatten") {
    if (!Array.isArray(input)) throw new Error("flatten requires array");
    return flattenDeep(input);
  }
  if (filter === "unique") {
    if (!Array.isArray(input)) throw new Error("unique requires array");
    const seen = new Set<string>();
    return input.filter(v => { const k = JSON.stringify(v); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  if (filter === "sort") {
    if (!Array.isArray(input)) throw new Error("sort requires array");
    return [...input].sort((a, b) => {
      if (typeof a === typeof b && (typeof a === "string" || typeof a === "number")) return a < b ? -1 : a > b ? 1 : 0;
      return String(a).localeCompare(String(b));
    });
  }
  if (filter === "reverse") {
    if (!Array.isArray(input)) throw new Error("reverse requires array");
    return [...input].reverse();
  }
  if (filter === "min") {
    if (!Array.isArray(input) || !input.length) throw new Error("min requires non-empty array");
    return input.reduce((a, b) => (a as number) < (b as number) ? a : b);
  }
  if (filter === "max") {
    if (!Array.isArray(input) || !input.length) throw new Error("max requires non-empty array");
    return input.reduce((a, b) => (a as number) > (b as number) ? a : b);
  }
  if (filter === "add") {
    if (!Array.isArray(input)) throw new Error("add requires array");
    if (!input.length) return null;
    return input.reduce((a, b) => {
      if (typeof a === "number" && typeof b === "number") return a + b;
      if (typeof a === "string" && typeof b === "string") return a + b;
      if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
      if (isObj(a) && isObj(b)) return { ...a, ...b };
      throw new Error("add: incompatible types");
    });
  }
  if (filter === "any") {
    if (!Array.isArray(input)) throw new Error("any requires array");
    return input.some(Boolean);
  }
  if (filter === "all") {
    if (!Array.isArray(input)) throw new Error("all requires array");
    return input.every(Boolean);
  }

  // String interpolation / literal strings
  if (filter.startsWith('"') && filter.endsWith('"')) return filter.slice(1, -1);
  if (filter.startsWith("'") && filter.endsWith("'")) return filter.slice(1, -1);

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(filter)) return Number(filter);

  // Array literal: [expr, expr, ...]
  if (filter.startsWith("[") && filter.endsWith("]")) {
    const inner = filter.slice(1, -1).trim();
    if (!inner) return [];
    // Try as array construction
    const parts = splitTopLevel(inner, ",");
    return parts.map(p => evalFilter(p.trim(), input));
  }

  // Object construction: {key: expr, ...} or {key, ...}
  if (filter.startsWith("{") && filter.endsWith("}")) {
    const inner = filter.slice(1, -1).trim();
    if (!inner) return {};
    const pairs = splitTopLevel(inner, ",");
    const result: Record<string, unknown> = {};
    for (const pair of pairs) {
      const colonIdx = pair.indexOf(":");
      if (colonIdx === -1) {
        // shorthand: {foo} means {foo: .foo}
        const key = pair.trim().replace(/^["']|["']$/g, "");
        result[key] = evalFilter(`.${key}`, input);
      } else {
        const rawKey = pair.slice(0, colonIdx).trim().replace(/^["']|["']$/g, "");
        const valExpr = pair.slice(colonIdx + 1).trim();
        result[rawKey] = evalFilter(valExpr, input);
      }
    }
    return result;
  }

  // Pipe: split on top-level |
  const pipeIdx = topLevelIndexOf(filter, "|");
  if (pipeIdx !== -1) {
    const left = filter.slice(0, pipeIdx).trim();
    const right = filter.slice(pipeIdx + 1).trim();
    const mid = evalFilter(left, input);
    return evalFilter(right, mid);
  }

  // Comma (multiple outputs — return array)
  const commaIdx = topLevelIndexOf(filter, ",");
  if (commaIdx !== -1) {
    const parts = splitTopLevel(filter, ",");
    return parts.map(p => evalFilter(p.trim(), input));
  }

  // Comparison operators
  for (const op of ["==", "!=", ">=", "<=", ">", "<"]) {
    const idx = topLevelIndexOf(filter, op);
    if (idx !== -1) {
      const lhs = evalFilter(filter.slice(0, idx).trim(), input);
      const rhs = evalFilter(filter.slice(idx + op.length).trim(), input);
      switch (op) {
        case "==": return JSON.stringify(lhs) === JSON.stringify(rhs);
        case "!=": return JSON.stringify(lhs) !== JSON.stringify(rhs);
        case ">=": return (lhs as number) >= (rhs as number);
        case "<=": return (lhs as number) <= (rhs as number);
        case ">":  return (lhs as number) > (rhs as number);
        case "<":  return (lhs as number) < (rhs as number);
      }
    }
  }

  // and / or
  const andIdx = topLevelIndexOf(filter, " and ");
  if (andIdx !== -1) {
    return !!evalFilter(filter.slice(0, andIdx).trim(), input) &&
           !!evalFilter(filter.slice(andIdx + 5).trim(), input);
  }
  const orIdx = topLevelIndexOf(filter, " or ");
  if (orIdx !== -1) {
    return !!evalFilter(filter.slice(0, orIdx).trim(), input) ||
           !!evalFilter(filter.slice(orIdx + 4).trim(), input);
  }

  // Arithmetic
  for (const op of ["+", "-", "*", "/"]) {
    const idx = findArithOp(filter, op);
    if (idx !== -1) {
      const lhs = evalFilter(filter.slice(0, idx).trim(), input);
      const rhs = evalFilter(filter.slice(idx + 1).trim(), input);
      switch (op) {
        case "+": return (lhs as number) + (rhs as number);
        case "-": return (lhs as number) - (rhs as number);
        case "*": return (lhs as number) * (rhs as number);
        case "/": return (lhs as number) / (rhs as number);
      }
    }
  }

  // select(cond)
  const selectM = filter.match(/^select\((.+)\)$/s);
  if (selectM) {
    const cond = evalFilter(selectM[1].trim(), input);
    if (cond) return input;
    return undefined; // filtered out
  }

  // map(expr)
  const mapM = filter.match(/^map\((.+)\)$/s);
  if (mapM) {
    if (!Array.isArray(input)) throw new Error("map requires array");
    const results = input.map(item => evalFilter(mapM[1].trim(), item));
    return results.filter(r => r !== undefined);
  }

  // map_values(expr)
  const mapvM = filter.match(/^map_values\((.+)\)$/s);
  if (mapvM) {
    if (isObj(input)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) out[k] = evalFilter(mapvM[1].trim(), v);
      return out;
    }
    if (Array.isArray(input)) return input.map(v => evalFilter(mapvM[1].trim(), v));
    throw new Error("map_values requires object or array");
  }

  // to_entries
  if (filter === "to_entries") {
    if (!isObj(input)) throw new Error("to_entries requires object");
    return Object.entries(input).map(([k, v]) => ({ key: k, value: v }));
  }

  // from_entries
  if (filter === "from_entries") {
    if (!Array.isArray(input)) throw new Error("from_entries requires array");
    const out: Record<string, unknown> = {};
    for (const e of input) {
      if (isObj(e)) out[String((e as any).key ?? (e as any).name ?? "")] = (e as any).value;
    }
    return out;
  }

  // with_entries(expr)
  const weM = filter.match(/^with_entries\((.+)\)$/s);
  if (weM) {
    if (!isObj(input)) throw new Error("with_entries requires object");
    const entries = Object.entries(input).map(([k, v]) => ({ key: k, value: v }));
    const mapped = entries.map(e => evalFilter(weM[1].trim(), e));
    const out: Record<string, unknown> = {};
    for (const e of mapped) if (isObj(e)) out[String((e as any).key ?? "")] = (e as any).value;
    return out;
  }

  // group_by(.field)
  const gbM = filter.match(/^group_by\((.+)\)$/s);
  if (gbM) {
    if (!Array.isArray(input)) throw new Error("group_by requires array");
    const groups = new Map<string, unknown[]>();
    for (const item of input) {
      const key = JSON.stringify(evalFilter(gbM[1].trim(), item));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.values()];
  }

  // unique_by(.field)
  const ubM = filter.match(/^unique_by\((.+)\)$/s);
  if (ubM) {
    if (!Array.isArray(input)) throw new Error("unique_by requires array");
    const seen = new Set<string>();
    return input.filter(item => {
      const key = JSON.stringify(evalFilter(ubM[1].trim(), item));
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  // sort_by(.field)
  const sbM = filter.match(/^sort_by\((.+)\)$/s);
  if (sbM) {
    if (!Array.isArray(input)) throw new Error("sort_by requires array");
    const expr = sbM[1].trim();
    return [...input].sort((a, b) => {
      const av = evalFilter(expr, a);
      const bv = evalFilter(expr, b);
      if (typeof av === typeof bv && (typeof av === "string" || typeof av === "number")) return av < bv ? -1 : av > bv ? 1 : 0;
      return String(av).localeCompare(String(bv));
    });
  }

  // min_by / max_by
  const minbM = filter.match(/^min_by\((.+)\)$/s);
  if (minbM) {
    if (!Array.isArray(input) || !input.length) throw new Error("min_by requires non-empty array");
    const expr = minbM[1].trim();
    return input.reduce((a, b) => { const av = evalFilter(expr, a) as number; const bv = evalFilter(expr, b) as number; return av <= bv ? a : b; });
  }
  const maxbM = filter.match(/^max_by\((.+)\)$/s);
  if (maxbM) {
    if (!Array.isArray(input) || !input.length) throw new Error("max_by requires non-empty array");
    const expr = maxbM[1].trim();
    return input.reduce((a, b) => { const av = evalFilter(expr, a) as number; const bv = evalFilter(expr, b) as number; return av >= bv ? a : b; });
  }

  // flatten(depth)
  const flatM = filter.match(/^flatten\((\d+)\)$/);
  if (flatM) {
    if (!Array.isArray(input)) throw new Error("flatten requires array");
    return input.flat(Number(flatM[1]));
  }

  // first / last
  if (filter === "first") {
    if (Array.isArray(input)) return input[0] ?? null;
    throw new Error("first requires array");
  }
  if (filter === "last") {
    if (Array.isArray(input)) return input[input.length - 1] ?? null;
    throw new Error("last requires array");
  }

  // has("key")
  const hasM = filter.match(/^has\((".*?"|'.*?'|\d+)\)$/);
  if (hasM) {
    const key = hasM[1].replace(/^["']|["']$/g, "");
    if (isObj(input)) return key in input;
    if (Array.isArray(input)) return Number(key) < input.length;
    return false;
  }

  // in operator (via has)
  const inM = filter.match(/^in\((.+)\)$/s);
  if (inM) {
    const obj = evalFilter(inM[1].trim(), input);
    if (isObj(obj)) return JSON.stringify(input) in obj;
    return false;
  }

  // contains(val)
  const containsM = filter.match(/^contains\((.+)\)$/s);
  if (containsM) {
    const val = evalFilter(containsM[1].trim(), input);
    if (typeof input === "string" && typeof val === "string") return input.includes(val);
    if (Array.isArray(input)) return JSON.stringify(input).includes(JSON.stringify(val).slice(1, -1));
    return false;
  }

  // split("sep")
  const splitM = filter.match(/^split\((".*?"|'.*?')\)$/);
  if (splitM) {
    if (typeof input !== "string") throw new Error("split requires string");
    const sep = splitM[1].slice(1, -1);
    return input.split(sep);
  }

  // join("sep")
  const joinM = filter.match(/^join\((".*?"|'.*?')\)$/);
  if (joinM) {
    if (!Array.isArray(input)) throw new Error("join requires array");
    const sep = joinM[1].slice(1, -1);
    return input.join(sep);
  }

  // ltrimstr / rtrimstr
  const ltrimM = filter.match(/^ltrimstr\((".*?"|'.*?')\)$/);
  if (ltrimM) {
    if (typeof input !== "string") return input;
    const s = ltrimM[1].slice(1, -1);
    return input.startsWith(s) ? input.slice(s.length) : input;
  }
  const rtrimM = filter.match(/^rtrimstr\((".*?"|'.*?')\)$/);
  if (rtrimM) {
    if (typeof input !== "string") return input;
    const s = rtrimM[1].slice(1, -1);
    return input.endsWith(s) ? input.slice(0, -s.length) : input;
  }

  // startswith / endswith
  const swM = filter.match(/^startswith\((".*?"|'.*?')\)$/);
  if (swM) {
    if (typeof input !== "string") return false;
    return input.startsWith(swM[1].slice(1, -1));
  }
  const ewM = filter.match(/^endswith\((".*?"|'.*?')\)$/);
  if (ewM) {
    if (typeof input !== "string") return false;
    return input.endsWith(ewM[1].slice(1, -1));
  }

  // test("regex")
  const testM = filter.match(/^test\((".*?"|'.*?')\)$/);
  if (testM) {
    if (typeof input !== "string") return false;
    return new RegExp(testM[1].slice(1, -1)).test(input);
  }

  // limit(n; expr) — simplified
  const limitM = filter.match(/^limit\((\d+);\s*(.+)\)$/s);
  if (limitM) {
    const n = Number(limitM[1]);
    const result = evalFilter(limitM[2].trim(), input);
    if (Array.isArray(result)) return result.slice(0, n);
    return result;
  }

  // indices("str") / index("str") / rindex("str")
  const indexM = filter.match(/^(r?index|indices)\((".*?"|'.*?')\)$/);
  if (indexM) {
    const s = indexM[2].slice(1, -1);
    if (typeof input !== "string") throw new Error("index/indices requires string");
    if (indexM[1] === "index") return input.indexOf(s);
    if (indexM[1] === "rindex") return input.lastIndexOf(s);
    // indices: all positions
    const positions: number[] = [];
    let pos = 0;
    while ((pos = input.indexOf(s, pos)) !== -1) { positions.push(pos); pos += s.length; }
    return positions;
  }

  // env — not supported in browser
  if (filter === "env") throw new Error("env is not supported in the browser");

  // path starting with . — field access chain
  if (filter.startsWith(".")) {
    return evalPath(filter, input);
  }

  throw new Error(`Unknown filter: ${JSON.stringify(filter)}`);
}

function evalPath(path: string, input: unknown): unknown {
  // .foo.bar, .foo[0], .["key"], .[0], .[]
  let cur = input;
  let rest = path.slice(1); // strip leading .

  while (rest.length > 0) {
    if (rest.startsWith("?")) { rest = rest.slice(1); continue; } // optional

    if (rest.startsWith("[")) {
      // find matching ]
      let depth = 0; let end = -1;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "[") depth++;
        else if (rest[i] === "]") { depth--; if (!depth) { end = i; break; } }
      }
      if (end === -1) throw new Error("Unmatched [");
      const inner = rest.slice(1, end).trim();
      rest = rest.slice(end + 1);
      if (rest.startsWith(".")) rest = rest.slice(1);

      if (inner === "") {
        // .[] — iterate
        if (Array.isArray(cur)) return cur.map(v => evalPath("." + rest, v)).filter(v => v !== undefined);
        if (isObj(cur)) return Object.values(cur).map(v => evalPath("." + rest, v)).filter(v => v !== undefined);
        throw new Error(".[] requires array or object");
      } else if (inner.startsWith(":") || inner.endsWith(":") || inner.includes(":")) {
        // slice [a:b]
        if (!Array.isArray(cur) && typeof cur !== "string") throw new Error("slice requires array or string");
        const parts = inner.split(":").map(p => p.trim() ? Number(p.trim()) : undefined);
        const len = (cur as string | unknown[]).length;
        const start = parts[0] !== undefined ? (parts[0] < 0 ? len + parts[0] : parts[0]) : 0;
        const end2 = parts[1] !== undefined ? (parts[1] < 0 ? len + parts[1] : parts[1]) : len;
        cur = Array.isArray(cur) ? cur.slice(start, end2) : (cur as string).slice(start, end2);
      } else if (/^-?\d+$/.test(inner)) {
        const idx = Number(inner);
        if (!Array.isArray(cur)) throw new Error(`Expected array, got ${typeof cur}`);
        cur = idx < 0 ? cur[cur.length + idx] : cur[idx];
      } else {
        // string key
        const key = inner.replace(/^["']|["']$/g, "");
        if (!isObj(cur)) { cur = undefined; continue; }
        cur = (cur as Record<string, unknown>)[key];
      }
    } else {
      // .identifier
      const m = rest.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (!m) throw new Error(`Invalid path: .${rest}`);
      const key = m[1];
      rest = rest.slice(key.length);
      if (rest.startsWith(".")) rest = rest.slice(1);
      else if (rest.startsWith("?")) rest = rest.slice(1);
      if (cur === null || cur === undefined) { cur = undefined; continue; }
      if (!isObj(cur)) { cur = undefined; continue; }
      cur = (cur as Record<string, unknown>)[key];
    }
  }
  return cur;
}

function flattenDeep(arr: unknown[]): unknown[] {
  const result: unknown[] = [];
  const walk = (a: unknown[]) => { for (const v of a) Array.isArray(v) ? walk(v) : result.push(v); };
  walk(arr); return result;
}

/** Find top-level (non-nested) index of needle in str */
function topLevelIndexOf(str: string, needle: string): number {
  let depth = 0;
  let inS = false, inD = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (!inS && !inD) {
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if (depth === 0 && str.startsWith(needle, i)) return i;
    }
    if (c === "'" && !inD) inS = !inS;
    if (c === '"' && !inS) inD = !inD;
  }
  return -1;
}

function splitTopLevel(str: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = "", inS = false, inD = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "'" && !inD) { inS = !inS; cur += c; continue; }
    if (c === '"' && !inS) { inD = !inD; cur += c; continue; }
    if (!inS && !inD) {
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if (depth === 0 && str.startsWith(sep, i)) {
        parts.push(cur); cur = ""; i += sep.length - 1; continue;
      }
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function findArithOp(str: string, op: string): number {
  // only find + or - or * or / that aren't part of a path or string
  let depth = 0, inS = false, inD = false;
  for (let i = str.length - 1; i >= 0; i--) {
    const c = str[i];
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '(' || c === '[' || c === '{') depth--;
    if (c === '"' && !inS) inD = !inD;
    if (c === "'" && !inD) inS = !inS;
    if (!inS && !inD && depth === 0 && c === op && i > 0 && str[i-1] !== '.') return i;
  }
  return -1;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runTransform(json: string, filter: string, indent: number): TransformResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e: any) {
    return { output: "", error: "Invalid JSON: " + e.message };
  }

  try {
    const f = filter.trim() || ".";
    const result = evalFilter(f, parsed);
    if (result === undefined) return { output: "" };
    const out = Array.isArray(result) && result.some(r => r !== undefined)
      ? result.map(r => JSON.stringify(r, null, indent)).join("\n")
      : JSON.stringify(result, null, indent);
    return { output: out };
  } catch (e: any) {
    return { output: "", error: e.message };
  }
}
