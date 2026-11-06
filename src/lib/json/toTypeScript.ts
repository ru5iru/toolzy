/** Infer TypeScript interfaces from a parsed JSON value. Pure, no DOM. */

const isIdent = (k: string) => /^[A-Za-z_$][\w$]*$/.test(k);
const key = (k: string) => (isIdent(k) ? k : JSON.stringify(k));
const pascal = (s: string) => {
  const p = s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return /^[A-Za-z_]/.test(p) ? p : `T${p}`;
};
const singular = (s: string) => (s.length > 3 && s.endsWith("ies") ? s.slice(0, -3) + "y" : s.length > 2 && s.endsWith("s") && !s.endsWith("ss") ? s.slice(0, -1) : s);

export const jsonToTypeScript = (value: unknown, rootName = "Root"): string => {
  const decls: string[] = [];
  const used = new Set<string>();
  const uniqueName = (base: string) => {
    let n = pascal(base) || "Item", i = 2;
    const start = n;
    while (used.has(n)) n = `${start}${i++}`;
    used.add(n);
    return n;
  };

  const typeOf = (v: unknown, hint: string): string => {
    if (v === null) return "null";
    if (Array.isArray(v)) {
      if (!v.length) return "unknown[]";
      const types = [...new Set(v.map((x) => (x && typeof x === "object" && !Array.isArray(x) ? "__obj" : typeOf(x, hint))))];
      const objs = v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
      const parts = types.filter((t) => t !== "__obj");
      if (objs.length) parts.push(declare(mergeObjects(objs), singular(hint)));
      const u = parts.join(" | ");
      return parts.length > 1 ? `(${u})[]` : `${u}[]`;
    }
    if (typeof v === "object") return declare(v as Record<string, unknown>, hint);
    return typeof v === "bigint" ? "number" : typeof v;
  };

  // Objects in one array become one interface; keys missing from some become optional.
  const optionalKeys = new WeakMap<object, Set<string>>();
  const mergeObjects = (objs: Record<string, unknown>[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    const counts: Record<string, number> = {};
    for (const o of objs) for (const [k, val] of Object.entries(o)) {
      counts[k] = (counts[k] ?? 0) + 1;
      if (!(k in out) || out[k] === null) out[k] = val;
    }
    optionalKeys.set(out, new Set(Object.keys(counts).filter((k) => counts[k] < objs.length)));
    return out;
  };

  const declare = (o: Record<string, unknown>, hint: string): string => {
    const name = uniqueName(hint);
    const opt = optionalKeys.get(o) ?? new Set<string>();
    const lines = Object.entries(o).map(([k, val]) => `  ${key(k)}${opt.has(k) ? "?" : ""}: ${typeOf(val, k)};`);
    decls.push(`export interface ${name} {\n${lines.join("\n")}\n}`);
    return name;
  };

  if (value && typeof value === "object" && !Array.isArray(value)) {
    declare(value as Record<string, unknown>, rootName);
  } else {
    decls.push(`export type ${pascal(rootName)} = ${typeOf(value, rootName)};`);
  }
  // Root first, nested after.
  const [rootDecl, ...rest] = [...decls].reverse().length ? [decls[decls.length - 1], ...decls.slice(0, -1)] : [""];
  return [rootDecl, ...rest].join("\n\n");
};
