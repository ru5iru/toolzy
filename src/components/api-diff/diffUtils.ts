export type DiffType = "added" | "removed" | "changed" | "type_changed" | "unchanged";

export interface DiffEntry {
  path: string;
  type: DiffType;
  left?: string;
  right?: string;
  leftType?: string;
  rightType?: string;
  children?: DiffEntry[];
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  typeChanged: number;
  unchanged: number;
}

export function detectFormat(input: string): "json" | "xml" | "html" | "text" {
  const trimmed = input.trim();
  if (!trimmed) return "text";
  try { JSON.parse(trimmed); return "json"; } catch {}
  if (/^<\?xml/i.test(trimmed) || /^<[a-z]/i.test(trimmed) && /<\/[a-z]+>$/i.test(trimmed)) {
    if (/<html/i.test(trimmed)) return "html";
    return "xml";
  }
  return "text";
}

export function prettify(input: string, format: string): string {
  if (format === "json") {
    try { return JSON.stringify(JSON.parse(input), null, 2); } catch { return input; }
  }
  return input;
}

function getType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function shouldIgnore(path: string, ignoreRules: string[]): boolean {
  return ignoreRules.some(rule => {
    if (rule.startsWith("/") && rule.endsWith("/")) {
      try { return new RegExp(rule.slice(1, -1)).test(path); } catch { return false; }
    }
    // Support wildcard paths like data.items[].createdAt
    const pattern = rule.replace(/\[\]/g, "\\[\\d+\\]").replace(/\./g, "\\.");
    return new RegExp(`^${pattern}$`).test(path) || path.endsWith(`.${rule}`) || rule === path;
  });
}

export function deepDiff(
  a: unknown, b: unknown, path = "",
  opts: { ignoreOrder?: boolean; ignoreRules?: string[]; jsonPathFilter?: string } = {}
): DiffEntry[] {
  const { ignoreOrder = true, ignoreRules = [] } = opts;
  if (shouldIgnore(path, ignoreRules)) return [];

  const diffs: DiffEntry[] = [];
  const currentPath = path || "(root)";

  const typeA = getType(a);
  const typeB = getType(b);

  if (typeA !== typeB) {
    diffs.push({
      path: currentPath, type: "type_changed",
      left: JSON.stringify(a), right: JSON.stringify(b),
      leftType: typeA, rightType: typeB
    });
    return diffs;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (ignoreOrder) {
      const sortFn = (x: unknown, y: unknown) => JSON.stringify(x).localeCompare(JSON.stringify(y));
      const sa = [...a].sort(sortFn);
      const sb = [...b].sort(sortFn);
      const max = Math.max(sa.length, sb.length);
      for (let i = 0; i < max; i++) {
        const p = `${path}[${i}]`;
        if (i >= sa.length) diffs.push({ path: p, type: "added", right: JSON.stringify(sb[i]) });
        else if (i >= sb.length) diffs.push({ path: p, type: "removed", left: JSON.stringify(sa[i]) });
        else diffs.push(...deepDiff(sa[i], sb[i], p, opts));
      }
    } else {
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i++) {
        const p = `${path}[${i}]`;
        if (i >= a.length) diffs.push({ path: p, type: "added", right: JSON.stringify(b[i]) });
        else if (i >= b.length) diffs.push({ path: p, type: "removed", left: JSON.stringify(a[i]) });
        else diffs.push(...deepDiff(a[i], b[i], p, opts));
      }
    }
    return diffs;
  }

  if (typeA === "object" && a !== null && b !== null) {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (shouldIgnore(p, ignoreRules)) continue;
      if (!(k in objA)) diffs.push({ path: p, type: "added", right: JSON.stringify(objB[k]) });
      else if (!(k in objB)) diffs.push({ path: p, type: "removed", left: JSON.stringify(objA[k]) });
      else diffs.push(...deepDiff(objA[k], objB[k], p, opts));
    }
    return diffs;
  }

  if (a !== b) {
    diffs.push({ path: currentPath, type: "changed", left: JSON.stringify(a), right: JSON.stringify(b) });
  }

  return diffs;
}

export function getDiffSummary(diffs: DiffEntry[]): DiffSummary {
  return diffs.reduce((s, d) => {
    if (d.type === "added") s.added++;
    else if (d.type === "removed") s.removed++;
    else if (d.type === "changed") s.changed++;
    else if (d.type === "type_changed") s.typeChanged++;
    return s;
  }, { added: 0, removed: 0, changed: 0, typeChanged: 0, unchanged: 0 });
}

export function exportAsMarkdown(diffs: DiffEntry[]): string {
  const summary = getDiffSummary(diffs);
  let md = `# API Response Diff Report\n\n`;
  md += `## Summary\n- Added: ${summary.added}\n- Removed: ${summary.removed}\n- Changed: ${summary.changed}\n- Type Changed: ${summary.typeChanged}\n\n`;
  md += `## Details\n\n`;
  for (const d of diffs) {
    const icon = d.type === "added" ? "🟢" : d.type === "removed" ? "🔴" : d.type === "type_changed" ? "🟠" : "🟡";
    md += `${icon} **${d.path}** — ${d.type.toUpperCase()}\n`;
    if (d.left !== undefined) md += `  - Left: \`${d.left}\`\n`;
    if (d.right !== undefined) md += `  - Right: \`${d.right}\`\n`;
    md += "\n";
  }
  return md;
}

export function exportAsJson(diffs: DiffEntry[]): string {
  return JSON.stringify({ summary: getDiffSummary(diffs), differences: diffs }, null, 2);
}

export interface DiffHistoryEntry {
  id: string;
  timestamp: number;
  leftPreview: string;
  rightPreview: string;
  diffCount: number;
}

const HISTORY_KEY = "toolzy_diff_history";
const MAX_HISTORY = 10;

export function loadDiffHistory(): DiffHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

export function saveDiffHistory(entry: DiffHistoryEntry) {
  const history = loadDiffHistory();
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}
