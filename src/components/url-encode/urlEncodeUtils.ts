// URL Encode/Decode utility functions — fully browser-side

export type EncodingMode = "encodeURIComponent" | "encodeURI" | "form" | "rfc3986";

export interface DetectionResult {
  isEncoded: boolean;
  isPartiallyEncoded: boolean;
  isDoubleEncoded: boolean;
  suggestion: string;
  confidence: number;
}

export interface QueryParam {
  id: string;
  key: string;
  value: string;
}

export interface HistoryItem {
  id: string;
  input: string;
  output: string;
  mode: "encode" | "decode";
  encodingMode: EncodingMode;
  timestamp: number;
}

export interface UnicodeBreakdown {
  char: string;
  codePoint: string;
  utf8Bytes: string[];
  encoded: string;
}

// --- Encoding Functions ---

export function encode(input: string, mode: EncodingMode): string {
  switch (mode) {
    case "encodeURIComponent":
      return encodeURIComponent(input);
    case "encodeURI":
      return encodeURI(input);
    case "form":
      return encodeURIComponent(input).replace(/%20/g, "+");
    case "rfc3986":
      return encodeURIComponent(input).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
    default:
      return encodeURIComponent(input);
  }
}

export function decode(input: string): { result: string; error?: string } {
  try {
    // Handle form encoding (+ → space)
    const normalized = input.replace(/\+/g, " ");
    return { result: decodeURIComponent(normalized) };
  } catch (e: any) {
    return { result: input, error: e.message || "Invalid encoded string" };
  }
}

export function doubleEncode(input: string, mode: EncodingMode): string {
  return encode(encode(input, mode), mode);
}

export function doubleDecode(input: string): { result: string; steps: string[]; error?: string } {
  const steps: string[] = [input];
  const first = decode(input);
  if (first.error) return { result: input, steps, error: first.error };
  steps.push(first.result);
  const second = decode(first.result);
  if (second.error) return { result: first.result, steps };
  steps.push(second.result);
  return { result: second.result, steps };
}

// --- Detection ---

export function detectEncoding(input: string): DetectionResult {
  if (!input.trim()) {
    return { isEncoded: false, isPartiallyEncoded: false, isDoubleEncoded: false, suggestion: "encode", confidence: 0 };
  }

  const percentPattern = /%[0-9A-Fa-f]{2}/g;
  const matches = input.match(percentPattern) || [];
  const hasPercent = matches.length > 0;
  const plusAsSpace = /\+/.test(input) && !/[a-zA-Z]\+[a-zA-Z]/.test(input);

  // Check for double encoding (e.g., %2520)
  const doublePattern = /%25[0-9A-Fa-f]{2}/g;
  const doubleMatches = input.match(doublePattern) || [];
  const isDoubleEncoded = doubleMatches.length > 0;

  // Check for broken % sequences
  const brokenPattern = /%(?![0-9A-Fa-f]{2})/g;
  const hasBroken = brokenPattern.test(input);

  // Check for special chars that should be encoded
  const specialChars = /[^\w\-.~:/?#\[\]@!$&'()*+,;=%]/;
  const hasSpecial = specialChars.test(input);

  if (isDoubleEncoded) {
    return { isEncoded: true, isPartiallyEncoded: false, isDoubleEncoded: true, suggestion: "Decode twice", confidence: 90 };
  }

  if (hasPercent && !hasBroken) {
    if (hasSpecial) {
      return { isEncoded: true, isPartiallyEncoded: true, isDoubleEncoded: false, suggestion: "Partially encoded — decode or re-encode", confidence: 70 };
    }
    return { isEncoded: true, isPartiallyEncoded: false, isDoubleEncoded: false, suggestion: "Decode", confidence: 85 };
  }

  if (plusAsSpace && !hasPercent) {
    return { isEncoded: true, isPartiallyEncoded: false, isDoubleEncoded: false, suggestion: "Decode (form-encoded)", confidence: 60 };
  }

  return { isEncoded: false, isPartiallyEncoded: hasBroken, isDoubleEncoded: false, suggestion: "Encode", confidence: hasSpecial ? 80 : 50 };
}

// --- Query Parameter Parsing ---

export function parseQueryParams(url: string): { baseUrl: string; params: QueryParam[] } {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://example.com/${url}`);
    const params: QueryParam[] = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({ id: crypto.randomUUID(), key, value });
    });
    return { baseUrl: `${urlObj.origin}${urlObj.pathname}`, params };
  } catch {
    const qIndex = url.indexOf("?");
    if (qIndex === -1) return { baseUrl: url, params: [] };
    const baseUrl = url.substring(0, qIndex);
    const queryString = url.substring(qIndex + 1);
    const params = queryString.split("&").filter(Boolean).map((pair) => {
      const [key, ...rest] = pair.split("=");
      return { id: crypto.randomUUID(), key: decodeURIComponent(key || ""), value: decodeURIComponent(rest.join("=") || "") };
    });
    return { baseUrl, params };
  }
}

export function buildUrl(baseUrl: string, params: QueryParam[]): string {
  const filtered = params.filter((p) => p.key.trim());
  if (filtered.length === 0) return baseUrl;
  const qs = filtered.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
  return `${baseUrl}?${qs}`;
}

// --- URL Normalization ---

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Lowercase protocol and host
    let normalized = `${u.protocol}//${u.hostname.toLowerCase()}`;
    if (u.port) normalized += `:${u.port}`;
    // Remove duplicate slashes in path
    let path = u.pathname.replace(/\/+/g, "/");
    // Remove trailing slash (except root)
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    normalized += path;
    // Sort query params
    const params = Array.from(u.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (params.length > 0) {
      normalized += "?" + params.map(([k, v]) => `${k}=${v}`).join("&");
    }
    if (u.hash) normalized += u.hash;
    return normalized;
  } catch {
    return url;
  }
}

// --- Batch Processing ---

export function batchProcess(input: string, mode: "encode" | "decode", encodingMode: EncodingMode): string[] {
  return input.split("\n").filter((l) => l.trim()).map((line) => {
    if (mode === "encode") return encode(line, encodingMode);
    const { result } = decode(line);
    return result;
  });
}

export function formatBatchOutput(results: string[], format: "text" | "json" | "csv"): string {
  switch (format) {
    case "json": return JSON.stringify(results, null, 2);
    case "csv": return results.map((r) => `"${r.replace(/"/g, '""')}"`).join("\n");
    default: return results.join("\n");
  }
}

// --- Unicode Breakdown ---

export function getUnicodeBreakdown(input: string): UnicodeBreakdown[] {
  const results: UnicodeBreakdown[] = [];
  for (const char of input) {
    const codePoint = char.codePointAt(0)!;
    const bytes = new TextEncoder().encode(char);
    const utf8Bytes = Array.from(bytes).map((b) => b.toString(16).toUpperCase().padStart(2, "0"));
    const encoded = encodeURIComponent(char);
    results.push({ char, codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`, utf8Bytes, encoded });
  }
  return results;
}

// --- Diff ---

export function computeDiff(original: string, transformed: string): { char: string; type: "same" | "added" | "removed" }[] {
  const result: { char: string; type: "same" | "added" | "removed" }[] = [];
  let i = 0, j = 0;
  while (i < original.length || j < transformed.length) {
    if (i < original.length && j < transformed.length && original[i] === transformed[j]) {
      result.push({ char: original[i], type: "same" });
      i++; j++;
    } else if (j < transformed.length) {
      result.push({ char: transformed[j], type: "added" });
      j++;
    } else {
      result.push({ char: original[i], type: "removed" });
      i++;
    }
  }
  return result;
}

// --- Validation ---

export function validateEncoding(input: string): { valid: boolean; errors: { position: number; char: string; message: string }[] } {
  const errors: { position: number; char: string; message: string }[] = [];
  const regex = /%(?![0-9A-Fa-f]{2})/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    errors.push({ position: match.index, char: input.substring(match.index, match.index + 3), message: `Invalid percent-encoding at position ${match.index}` });
  }
  return { valid: errors.length === 0, errors };
}

// --- Security Scan ---

export function securityScan(input: string): string[] {
  const warnings: string[] = [];
  const decoded = decode(input).result;
  if (/<script/i.test(decoded)) warnings.push("Potential XSS: <script> tag detected");
  if (/javascript:/i.test(decoded)) warnings.push("Potential XSS: javascript: protocol detected");
  if (/on\w+\s*=/i.test(decoded)) warnings.push("Potential XSS: inline event handler detected");
  if (/['"].*(?:--|;|\/\*)/i.test(decoded)) warnings.push("Potential SQL injection pattern detected");
  if (/%00/.test(input)) warnings.push("Null byte detected — possible injection");
  return warnings;
}

// --- History ---

const HISTORY_KEY = "toolzy_url_encode_history";
const MAX_HISTORY = 15;

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch { return []; }
}

export function addToHistory(item: Omit<HistoryItem, "id" | "timestamp">): void {
  const history = getHistory();
  history.unshift({ ...item, id: crypto.randomUUID(), timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearUrlHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// --- Code Snippets ---

export function generateSnippets(input: string, mode: "encode" | "decode"): Record<string, string> {
  const escaped = input.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
  if (mode === "encode") {
    return {
      JavaScript: `encodeURIComponent('${escaped}')`,
      Python: `import urllib.parse\nurllib.parse.quote('${escaped}')`,
      PHP: `urlencode('${escaped}')`,
      Java: `java.net.URLEncoder.encode("${escaped}", "UTF-8")`,
      curl: `curl -G --data-urlencode 'param=${escaped}' https://example.com`,
    };
  }
  return {
    JavaScript: `decodeURIComponent('${escaped}')`,
    Python: `import urllib.parse\nurllib.parse.unquote('${escaped}')`,
    PHP: `urldecode('${escaped}')`,
    Java: `java.net.URLDecoder.decode("${escaped}", "UTF-8")`,
  };
}
