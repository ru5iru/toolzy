/** Pure text helpers for the Text Utilities tool. No DOM access. */

const words = (s: string): string[] =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export type CaseKind = "upper" | "lower" | "title" | "sentence" | "camel" | "pascal" | "snake" | "kebab" | "constant" | "dot";

export const convertCase = (input: string, kind: CaseKind): string => {
  switch (kind) {
    case "upper": return input.toUpperCase();
    case "lower": return input.toLowerCase();
    case "title": return input.toLowerCase().replace(/(^|[\s\-_])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    case "sentence": return input.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    default: {
      // Identifier cases convert each line on its own so lists of names keep their shape.
      return input.split("\n").map((line) => {
        const w = words(line);
        if (!w.length) return "";
        switch (kind) {
          case "camel": return w.map((x, i) => (i ? cap(x) : x.toLowerCase())).join("");
          case "pascal": return w.map(cap).join("");
          case "snake": return w.map((x) => x.toLowerCase()).join("_");
          case "kebab": return w.map((x) => x.toLowerCase()).join("-");
          case "constant": return w.map((x) => x.toUpperCase()).join("_");
          default: return w.map((x) => x.toLowerCase()).join(".");
        }
      }).join("\n");
    }
  }
};

export const slugify = (input: string): string =>
  input.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export interface LineOptions { caseSensitive?: boolean; numeric?: boolean; descending?: boolean }

export const sortLines = (input: string, o: LineOptions = {}): string => {
  const lines = input.split("\n");
  const cmp = o.numeric
    ? (a: string, b: string) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b)
    : (a: string, b: string) => (o.caseSensitive ? (a < b ? -1 : a > b ? 1 : 0) : a.localeCompare(b, undefined, { sensitivity: "base" }));
  lines.sort(cmp);
  if (o.descending) lines.reverse();
  return lines.join("\n");
};

export const dedupeLines = (input: string, caseSensitive = true): string => {
  const seen = new Set<string>();
  return input.split("\n").filter((l) => {
    const k = caseSensitive ? l : l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join("\n");
};

export const trimLines = (input: string, dropEmpty = false): string => {
  const lines = input.split("\n").map((l) => l.trim());
  return (dropEmpty ? lines.filter(Boolean) : lines).join("\n");
};

export const reverseLines = (input: string): string => input.split("\n").reverse().join("\n");

export const numberLines = (input: string): string => {
  const lines = input.split("\n");
  const w = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(w, " ")}  ${l}`).join("\n");
};

export const textStats = (input: string) => {
  const trimmed = input.trim();
  return {
    characters: [...input].length,
    charactersNoSpaces: [...input.replace(/\s/g, "")].length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: input ? input.split("\n").length : 0,
    bytes: new TextEncoder().encode(input).length,
    readingMinutes: Math.max(trimmed ? 1 : 0, Math.round((trimmed ? trimmed.split(/\s+/).length : 0) / 220)),
  };
};
