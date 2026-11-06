/** Pure helpers for .env text. */

export interface EnvEntry { key: string; value: string; line: number }

const unquote = (v: string): string => {
  const t = v.trim();
  const q = t[0];
  if (q === '"' || q === "'") {
    const end = t.indexOf(q, 1);
    if (end > 0) return t.slice(1, end);
  }
  // Unquoted values may carry a trailing " # comment".
  return t.replace(/\s+#.*$/, "");
};

export const parseEnv = (text: string): { entries: EnvEntry[]; issues: string[] } => {
  const entries: EnvEntry[] = [];
  const issues: string[] = [];
  const seen = new Map<string, number>();
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const m = line.replace(/^export\s+/, "").match(/^([^=\s]+)\s*=(.*)$/);
    if (!m) { issues.push(`Line ${i + 1}: expected KEY=value`); return; }
    const [, key, rest] = m;
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) issues.push(`Line ${i + 1}: "${key}" is not a portable variable name`);
    if (seen.has(key)) issues.push(`Line ${i + 1}: "${key}" repeats line ${seen.get(key)}`);
    else seen.set(key, i + 1);
    entries.push({ key, value: unquote(rest), line: i + 1 });
  });
  return { entries, issues };
};

const secretLike = /(SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|API_?KEY|KEY|CREDENTIAL|DSN)/i;
const urlWithCreds = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;

/** Blank every value that looks secret; keep comments, blank lines and harmless values. */
export const toExample = (text: string, blankAll = false): string =>
  text.split("\n").map((raw) => {
    const m = raw.match(/^(\s*(?:export\s+)?)([^=\s#]+)(\s*=)(.*)$/);
    if (!m || raw.trim().startsWith("#")) return raw;
    const [, pre, key, eq, val] = m;
    const v = unquote(val);
    return blankAll || secretLike.test(key) || urlWithCreds.test(v) ? `${pre}${key}${eq}` : raw;
  }).join("\n");

export const envToJson = (text: string): string =>
  JSON.stringify(Object.fromEntries(parseEnv(text).entries.map((e) => [e.key, e.value])), null, 2);

export const jsonToEnv = (json: string): string => {
  const data = JSON.parse(json);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected a JSON object of keys and values");
  return Object.entries(data).map(([k, v]) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `${k.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase()}=${/[\s#"']/.test(s) ? JSON.stringify(s) : s}`;
  }).join("\n");
};
