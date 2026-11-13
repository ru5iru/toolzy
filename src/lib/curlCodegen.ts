import type { CurlRequest } from "./curlParser";

export type Lang = "python" | "javascript" | "typescript" | "go" | "php" | "ruby";

function headersEntries(h: Record<string, string>): [string, string][] {
  return Object.entries(h);
}

// ─── Python (requests) ────────────────────────────────────────────────────────
function toPython(r: CurlRequest): string {
  const lines: string[] = ["import requests", ""];

  const headers = headersEntries(r.headers);
  if (headers.length) {
    lines.push("headers = {");
    for (const [k, v] of headers) lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    lines.push("}");
  }

  let bodyArg = "";
  if (r.body) {
    if (r.bodyType === "json") {
      try {
        const parsed = JSON.parse(r.body);
        lines.push("");
        lines.push("payload = " + JSON.stringify(parsed, null, 4).split("\n").join("\n"));
        bodyArg = ", json=payload";
      } catch {
        lines.push(`\ndata = ${JSON.stringify(r.body)}`);
        bodyArg = ", data=data";
      }
    } else if (r.bodyType === "form") {
      lines.push("");
      lines.push("data = {");
      for (const kv of r.body.split("&")) {
        const [k, v = ""] = kv.split("=");
        lines.push(`    ${JSON.stringify(decodeURIComponent(k))}: ${JSON.stringify(decodeURIComponent(v))},`);
      }
      lines.push("}");
      bodyArg = ", data=data";
    } else {
      lines.push(`\ndata = ${JSON.stringify(r.body)}`);
      bodyArg = ", data=data";
    }
  }

  const headerArg = headers.length ? ", headers=headers" : "";
  const userArg = r.user ? `, auth=(${r.user.split(":").map(s => JSON.stringify(s)).join(", ")})` : "";
  const verifyArg = r.insecure ? ", verify=False" : "";
  const redirectArg = r.followRedirects ? "" : ", allow_redirects=False";

  lines.push("");
  lines.push(`response = requests.${r.method.toLowerCase()}(`);
  lines.push(`    ${JSON.stringify(r.url)},`);
  if (headers.length) lines.push(`    headers=headers,`);
  if (bodyArg) {
    const ba = bodyArg.slice(2); // remove leading ", "
    lines.push(`    ${ba},`);
  }
  if (userArg) lines.push(`    auth=(${r.user!.split(":").map(s => JSON.stringify(s)).join(", ")}),`);
  if (r.insecure) lines.push(`    verify=False,`);
  if (!r.followRedirects) lines.push(`    allow_redirects=False,`);
  lines.push(")");
  lines.push("");
  lines.push("print(response.status_code)");
  lines.push("print(response.text)");

  // Remove trailing commas before closing paren
  return lines.join("\n").replace(/,\n\)/g, "\n)");
}

// ─── JavaScript (fetch) ───────────────────────────────────────────────────────
function toJavaScript(r: CurlRequest): string {
  const lines: string[] = [];
  const opts: string[] = [];

  if (r.method !== "GET") opts.push(`  method: ${JSON.stringify(r.method)}`);

  const headers = headersEntries(r.headers);
  if (headers.length) {
    opts.push("  headers: {\n" + headers.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n  }");
  }

  if (r.body) {
    if (r.bodyType === "json") {
      try {
        const parsed = JSON.parse(r.body);
        opts.push("  body: JSON.stringify(" + JSON.stringify(parsed, null, 2).split("\n").map((l, i) => i === 0 ? l : "    " + l).join("\n") + ")");
      } catch {
        opts.push(`  body: ${JSON.stringify(r.body)}`);
      }
    } else {
      opts.push(`  body: ${JSON.stringify(r.body)}`);
    }
  }

  if (r.followRedirects) opts.push(`  redirect: "follow"`);

  lines.push(`const response = await fetch(${JSON.stringify(r.url)}, {`);
  lines.push(opts.join(",\n"));
  lines.push("});");
  lines.push("");
  lines.push("const data = await response.json(); // or response.text()");
  lines.push("console.log(data);");

  return lines.join("\n");
}

// ─── TypeScript (fetch) ───────────────────────────────────────────────────────
function toTypeScript(r: CurlRequest): string {
  const lines: string[] = [];
  const opts: string[] = [];

  if (r.method !== "GET") opts.push(`  method: "${r.method}" as const`);

  const headers = headersEntries(r.headers);
  if (headers.length) {
    opts.push(
      "  headers: {\n" +
      headers.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") +
      "\n  }"
    );
  }

  if (r.body) {
    if (r.bodyType === "json") {
      try {
        const parsed = JSON.parse(r.body);
        opts.push("  body: JSON.stringify(" + JSON.stringify(parsed, null, 2).split("\n").map((l, i) => i === 0 ? l : "    " + l).join("\n") + ")");
      } catch {
        opts.push(`  body: ${JSON.stringify(r.body)}`);
      }
    } else {
      opts.push(`  body: ${JSON.stringify(r.body)}`);
    }
  }

  if (r.followRedirects) opts.push(`  redirect: "follow" as const`);

  lines.push(`const response = await fetch(${JSON.stringify(r.url)}, {`);
  lines.push(opts.join(",\n"));
  lines.push("});");
  lines.push("");
  lines.push("if (!response.ok) {");
  lines.push("  throw new Error(`HTTP error! status: ${response.status}`);");
  lines.push("}");
  lines.push("");
  lines.push("const data: unknown = await response.json(); // or response.text()");
  lines.push("console.log(data);");

  return lines.join("\n");
}

// ─── Go (net/http) ────────────────────────────────────────────────────────────
function toGo(r: CurlRequest): string {
  const lines: string[] = [
    'package main',
    '',
    'import (',
    '	"fmt"',
  ];

  const hasBody = !!r.body;
  if (hasBody) lines.push('	"strings"');
  lines.push('	"net/http"');
  lines.push('	"io"');
  lines.push(')');
  lines.push('');
  lines.push('func main() {');

  if (hasBody) {
    if (r.bodyType === "json") {
      lines.push(`\tbody := strings.NewReader(${JSON.stringify(r.body)})`);
    } else {
      lines.push(`\tbody := strings.NewReader(${JSON.stringify(r.body)})`);
    }
  }

  const bodyArg = hasBody ? "body" : "nil";
  lines.push(`\treq, _ := http.NewRequest(${JSON.stringify(r.method)}, ${JSON.stringify(r.url)}, ${bodyArg})`);

  for (const [k, v] of headersEntries(r.headers)) {
    lines.push(`\treq.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
  }
  if (r.user) {
    const [u, p = ""] = r.user.split(":");
    lines.push(`\treq.SetBasicAuth(${JSON.stringify(u)}, ${JSON.stringify(p)})`);
  }

  lines.push('');
  lines.push('\tclient := &http.Client{}');
  if (!r.followRedirects) lines.push('\tclient.CheckRedirect = func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }');
  lines.push('\tresp, err := client.Do(req)');
  lines.push('\tif err != nil { panic(err) }');
  lines.push('\tdefer resp.Body.Close()');
  lines.push('');
  lines.push('\tbody2, _ := io.ReadAll(resp.Body)');
  lines.push('\tfmt.Println(resp.StatusCode)');
  lines.push('\tfmt.Println(string(body2))');
  lines.push('}');

  return lines.join("\n");
}

// ─── PHP (curl) ───────────────────────────────────────────────────────────────
function toPhp(r: CurlRequest): string {
  const lines: string[] = ["<?php", ""];
  lines.push("$ch = curl_init();");
  lines.push(`curl_setopt($ch, CURLOPT_URL, ${JSON.stringify(r.url)});`);
  lines.push("curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);");

  if (r.method !== "GET") {
    if (r.method === "POST") lines.push("curl_setopt($ch, CURLOPT_POST, true);");
    else lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${JSON.stringify(r.method)});`);
  }

  const headers = headersEntries(r.headers);
  if (headers.length) {
    lines.push("curl_setopt($ch, CURLOPT_HTTPHEADER, [");
    for (const [k, v] of headers) lines.push(`    ${JSON.stringify(`${k}: ${v}`)},`);
    lines.push("]);");
  }

  if (r.body) {
    lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${JSON.stringify(r.body)});`);
  }

  if (r.insecure) {
    lines.push("curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);");
    lines.push("curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);");
  }

  if (r.user) {
    lines.push(`curl_setopt($ch, CURLOPT_USERPWD, ${JSON.stringify(r.user)});`);
  }

  if (r.followRedirects) {
    lines.push("curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);");
  }

  lines.push("");
  lines.push("$response = curl_exec($ch);");
  lines.push("$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);");
  lines.push("curl_close($ch);");
  lines.push("");
  lines.push("echo $httpCode . \"\\n\";");
  lines.push("echo $response;");

  return lines.join("\n");
}

// ─── Ruby (net/http) ─────────────────────────────────────────────────────────
function toRuby(r: CurlRequest): string {
  const lines: string[] = [
    "require 'net/http'",
    "require 'uri'",
    "require 'json'",
    "",
    `uri = URI.parse(${JSON.stringify(r.url)})`,
    `http = Net::HTTP.new(uri.host, uri.port)`,
  ];

  if (r.url.startsWith("https")) {
    lines.push("http.use_ssl = true");
    if (r.insecure) lines.push("http.verify_mode = OpenSSL::SSL::VERIFY_NONE");
  }

  lines.push("");
  const klass = r.method === "GET" ? "Get" : r.method === "POST" ? "Post" : r.method === "PUT" ? "Put" : r.method === "DELETE" ? "Delete" : "Generic";
  lines.push(`request = Net::HTTP::${klass}.new(uri.request_uri)`);

  for (const [k, v] of headersEntries(r.headers)) {
    lines.push(`request[${JSON.stringify(k)}] = ${JSON.stringify(v)}`);
  }

  if (r.user) {
    const [u, p = ""] = r.user.split(":");
    lines.push(`request.basic_auth(${JSON.stringify(u)}, ${JSON.stringify(p)})`);
  }

  if (r.body) {
    lines.push(`request.body = ${JSON.stringify(r.body)}`);
  }

  lines.push("");
  lines.push("response = http.request(request)");
  lines.push("puts response.code");
  lines.push("puts response.body");

  return lines.join("\n");
}

// ─── Back to curl ─────────────────────────────────────────────────────────────
export function toCurl(r: CurlRequest): string {
  const parts = ["curl"];
  if (r.method !== "GET" || r.body) parts.push(`-X ${r.method}`);
  parts.push(JSON.stringify(r.url));
  for (const [k, v] of headersEntries(r.headers)) {
    parts.push(`\\\n  -H ${JSON.stringify(`${k}: ${v}`)}`);
  }
  if (r.body) parts.push(`\\\n  -d ${JSON.stringify(r.body)}`);
  if (r.insecure) parts.push("\\\n  -k");
  if (r.compressed) parts.push("\\\n  --compressed");
  if (r.user) parts.push(`\\\n  -u ${JSON.stringify(r.user)}`);
  if (r.followRedirects) parts.push("\\\n  -L");
  return parts.join(" ");
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export function generateCode(r: CurlRequest, lang: Lang): string {
  switch (lang) {
    case "python":     return toPython(r);
    case "javascript": return toJavaScript(r);
    case "typescript": return toTypeScript(r);
    case "go":         return toGo(r);
    case "php":        return toPhp(r);
    case "ruby":       return toRuby(r);
  }
}
