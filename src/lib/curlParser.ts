/** Parse a curl command string into a structured request object */

export interface CurlRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyType: "none" | "json" | "form" | "raw";
  isJson: boolean;
  insecure: boolean;
  compressed: boolean;
  user?: string;        // -u user:pass
  followRedirects: boolean;
}

/** Tokenise a curl command respecting single/double quotes and backslash escapes */
function tokenise(src: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let inS = false;  // in single-quote
  let inD = false;  // in double-quote
  let esc = false;

  // Strip line-continuation: backslash + newline (or \r\n)
  const s = src.replace(/\\\r?\n/g, " ").trim();

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { cur += c; esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === "'" && !inD) { inS = !inS; continue; }
    if (c === '"' && !inS) { inD = !inD; continue; }
    if ((c === " " || c === "\t" || c === "\n") && !inS && !inD) {
      if (cur) { tokens.push(cur); cur = ""; }
      continue;
    }
    cur += c;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

export function parseCurl(raw: string): CurlRequest | null {
  const tokens = tokenise(raw.trim());
  if (!tokens.length) return null;

  // Strip leading "curl"
  if (tokens[0].toLowerCase() === "curl") tokens.shift();

  const req: CurlRequest = {
    method: "GET",
    url: "",
    headers: {},
    bodyType: "none",
    isJson: false,
    insecure: false,
    compressed: false,
    followRedirects: false,
  };

  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  while (i < tokens.length) {
    const tok = eat();

    if (tok === "-X" || tok === "--request") {
      req.method = (eat() ?? "GET").toUpperCase();
    } else if (tok.startsWith("-X")) {
      req.method = tok.slice(2).toUpperCase();
    } else if (tok === "-H" || tok === "--header") {
      const hdr = eat() ?? "";
      const idx = hdr.indexOf(":");
      if (idx !== -1) {
        const k = hdr.slice(0, idx).trim();
        const v = hdr.slice(idx + 1).trim();
        req.headers[k] = v;
      }
    } else if (tok === "-d" || tok === "--data" || tok === "--data-raw" || tok === "--data-binary") {
      const body = eat() ?? "";
      req.body = body;
      if (req.method === "GET") req.method = "POST";
      req.bodyType = "raw";
    } else if (tok === "--data-urlencode") {
      const kv = eat() ?? "";
      if (req.method === "GET") req.method = "POST";
      req.bodyType = "form";
      req.body = req.body ? req.body + "&" + kv : kv;
    } else if (tok === "-F" || tok === "--form") {
      if (req.method === "GET") req.method = "POST";
      req.bodyType = "form";
      const kv = eat() ?? "";
      req.body = req.body ? req.body + "&" + kv : kv;
    } else if (tok === "-u" || tok === "--user") {
      req.user = eat();
    } else if (tok === "-k" || tok === "--insecure") {
      req.insecure = true;
    } else if (tok === "--compressed") {
      req.compressed = true;
    } else if (tok === "-L" || tok === "--location") {
      req.followRedirects = true;
    } else if (tok === "-G" || tok === "--get") {
      req.method = "GET";
    } else if (tok === "--json") {
      // curl 7.82+ shorthand: sets Content-Type and Accept
      const body = eat() ?? "";
      req.body = body;
      req.method = "POST";
      req.headers["Content-Type"] = "application/json";
      req.headers["Accept"] = "application/json";
      req.bodyType = "json";
    } else if (!tok.startsWith("-") && !req.url) {
      req.url = tok;
    }
    // Ignore unknown flags (-o, -v, --output, etc.)
  }

  // Detect JSON body
  if (req.body) {
    const ct = req.headers["Content-Type"] ?? req.headers["content-type"] ?? "";
    if (ct.includes("application/json") || (req.body.trimStart().startsWith("{") || req.body.trimStart().startsWith("["))) {
      req.bodyType = "json";
      req.isJson = true;
    } else if (ct.includes("application/x-www-form-urlencoded") || req.bodyType === "form") {
      req.bodyType = "form";
    }
  }

  if (!req.url) return null;
  return req;
}
