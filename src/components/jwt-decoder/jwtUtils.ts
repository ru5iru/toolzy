// JWT utility functions — all client-side

export interface DecodedJwt {
  header: Record<string, any>;
  payload: Record<string, any>;
  signature: string;
  raw: { header: string; payload: string; signature: string };
}

export interface TimestampInfo {
  date: string;
  relative: string;
  expired?: boolean;
  expiringSoon?: boolean;
  timestamp: number;
}

export interface SecurityScore {
  score: number; // 0-100
  label: string;
  color: string;
  issues: { severity: "critical" | "warning" | "info"; message: string }[];
}

export const CLAIM_TOOLTIPS: Record<string, string> = {
  iss: "Issuer — identifies the principal that issued the JWT",
  sub: "Subject — identifies the principal subject of the JWT",
  aud: "Audience — identifies the recipients the JWT is intended for",
  exp: "Expiration Time — time after which the JWT must not be accepted",
  nbf: "Not Before — time before which the JWT must not be accepted",
  iat: "Issued At — time at which the JWT was issued",
  jti: "JWT ID — unique identifier for the JWT",
  alg: "Algorithm — the signing algorithm used",
  typ: "Type — the type of token (usually 'JWT')",
  kid: "Key ID — hint for which key was used to sign",
  scope: "Scope — OAuth 2.0 scopes granted",
  roles: "Roles — user roles or permissions",
  email: "Email — user's email address",
  name: "Name — user's display name",
};

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const final = pad ? padded + "=".repeat(4 - pad) : padded;
  return atob(final);
}

export function decodeJwt(token: string): DecodedJwt {
  const trimmed = token.trim();
  if (!trimmed) throw new Error("Empty token");

  const parts = trimmed.split(".");
  if (parts.length !== 3) throw new Error(`Invalid JWT: expected 3 parts, got ${parts.length}`);

  // Validate base64url format
  const b64re = /^[A-Za-z0-9_-]*$/;
  parts.forEach((p, i) => {
    if (!b64re.test(p)) throw new Error(`Invalid Base64URL encoding in part ${i + 1}`);
  });

  let header: Record<string, any>;
  let payload: Record<string, any>;

  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
  } catch {
    throw new Error("Failed to decode header — invalid Base64 or JSON");
  }

  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw new Error("Failed to decode payload — invalid Base64 or JSON");
  }

  return {
    header,
    payload,
    signature: parts[2],
    raw: { header: parts[0], payload: parts[1], signature: parts[2] },
  };
}

export function formatTimestamp(ts: number): TimestampInfo {
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = ts * 1000 - now;
  const expired = diff < 0;
  const expiringSoon = !expired && diff < 5 * 60 * 1000; // 5 min
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  let relative = "";
  if (days > 0) relative = `${days}d ${hrs % 24}h`;
  else if (hrs > 0) relative = `${hrs}h ${mins % 60}m`;
  else relative = `${mins}m`;
  return { date: d.toISOString(), relative, expired, expiringSoon, timestamp: ts };
}

export function getTokenStatus(payload: Record<string, any>): { label: string; color: string } {
  if (!payload.exp) return { label: "No Expiry", color: "text-muted-foreground" };
  const info = formatTimestamp(payload.exp);
  if (info.expired) return { label: "Expired", color: "text-destructive" };
  if (info.expiringSoon) return { label: "Expiring Soon", color: "text-[hsl(var(--warning-foreground))]" };
  return { label: "Valid", color: "text-[hsl(var(--success-foreground))]" };
}

export function calculateSecurityScore(header: Record<string, any>, payload: Record<string, any>): SecurityScore {
  const issues: SecurityScore["issues"] = [];
  let score = 100;

  // Algorithm checks
  const alg = header.alg?.toLowerCase() || "";
  if (alg === "none") {
    score -= 40;
    issues.push({ severity: "critical", message: "Algorithm is 'none' — token is unsigned and insecure" });
  } else if (alg.startsWith("hs")) {
    if (alg === "hs256") {
      score -= 5;
      issues.push({ severity: "info", message: "HS256 is acceptable but RS256/ES256 are preferred for production" });
    }
  }

  // Expiration
  if (!payload.exp) {
    score -= 20;
    issues.push({ severity: "warning", message: "No expiration claim (exp) — token never expires" });
  } else {
    const info = formatTimestamp(payload.exp);
    if (info.expired) {
      score -= 15;
      issues.push({ severity: "warning", message: `Token expired ${info.relative} ago` });
    }
    // Check if expiry is too far in the future (> 30 days)
    if (!info.expired && payload.exp * 1000 - Date.now() > 30 * 24 * 60 * 60 * 1000) {
      score -= 5;
      issues.push({ severity: "info", message: "Token has a very long expiration (>30 days)" });
    }
  }

  // Important claims
  if (!payload.iss) {
    score -= 10;
    issues.push({ severity: "warning", message: "Missing 'iss' (issuer) claim" });
  }
  if (!payload.aud) {
    score -= 5;
    issues.push({ severity: "info", message: "Missing 'aud' (audience) claim" });
  }
  if (!payload.sub) {
    score -= 5;
    issues.push({ severity: "info", message: "Missing 'sub' (subject) claim" });
  }
  if (!payload.iat) {
    score -= 5;
    issues.push({ severity: "info", message: "Missing 'iat' (issued at) claim" });
  }
  if (!payload.jti) {
    score -= 5;
    issues.push({ severity: "info", message: "Missing 'jti' (JWT ID) — no replay protection" });
  }

  score = Math.max(0, score);

  let label = "Excellent";
  let color = "text-[hsl(var(--success-foreground))]";
  if (score < 40) { label = "Poor"; color = "text-destructive"; }
  else if (score < 60) { label = "Fair"; color = "text-[hsl(var(--warning-foreground))]"; }
  else if (score < 80) { label = "Good"; color = "text-[hsl(var(--info))]"; }

  return { score, label, color, issues };
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodeJwt(header: Record<string, any>, payload: Record<string, any>): string {
  const h = base64UrlEncode(JSON.stringify(header));
  const p = base64UrlEncode(JSON.stringify(payload));
  return `${h}.${p}.`;
}

export async function verifyHmac(token: string, secret: string, algorithm: string): Promise<boolean> {
  const algMap: Record<string, string> = {
    HS256: "SHA-256",
    HS384: "SHA-384",
    HS512: "SHA-512",
  };
  const hashAlg = algMap[algorithm.toUpperCase()];
  if (!hashAlg) return false;

  const parts = token.split(".");
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const keyData = new TextEncoder().encode(secret);

  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: hashAlg }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, data);

  const expected = base64UrlEncode(String.fromCharCode(...new Uint8Array(sig)));
  return expected === parts[2];
}

export function generateCodeExamples(token: string) {
  return {
    nodejs: `const jwt = require('jsonwebtoken');
const decoded = jwt.verify('${token.slice(0, 20)}...', 'your-secret');
console.log(decoded);`,
    php: `<?php
use Firebase\\JWT\\JWT;
$decoded = JWT::decode('${token.slice(0, 20)}...', new Key('your-secret', 'HS256'));
print_r($decoded);`,
    curl: `curl -H "Authorization: Bearer ${token.slice(0, 20)}..." \\
  https://api.example.com/protected`,
    python: `import jwt
decoded = jwt.decode('${token.slice(0, 20)}...', 'your-secret', algorithms=['HS256'])
print(decoded)`,
  };
}

// History — stored in localStorage
const HISTORY_KEY = "jwt_decoder_history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  token: string;
  timestamp: number;
  label: string;
}

export function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch { return []; }
}

export function addToHistory(token: string, payload: Record<string, any>) {
  const history = getHistory();
  // Deduplicate
  const filtered = history.filter(h => h.token !== token);
  const label = payload.sub || payload.email || payload.iss || "JWT Token";
  filtered.unshift({ token, timestamp: Date.now(), label: String(label) });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function extractJwtFromInput(input: string): string {
  // Try to extract JWT from Authorization header
  const bearerMatch = input.match(/Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)/i);
  if (bearerMatch) return bearerMatch[1];
  // Try URL query param
  const urlMatch = input.match(/[?&]token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)/);
  if (urlMatch) return urlMatch[1];
  // Try raw JWT
  const jwtMatch = input.match(/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)/);
  if (jwtMatch) return jwtMatch[1];
  return input.trim();
}
