// JWT Encoder utilities — all client-side, no data sent anywhere

export type AlgorithmFamily = "HMAC" | "RSA" | "ECDSA";

export interface AlgorithmOption {
  value: string;
  label: string;
  family: AlgorithmFamily;
  webCryptoAlg: string;
}

export const ALGORITHMS: AlgorithmOption[] = [
  { value: "HS256", label: "HS256", family: "HMAC", webCryptoAlg: "SHA-256" },
  { value: "HS384", label: "HS384", family: "HMAC", webCryptoAlg: "SHA-384" },
  { value: "HS512", label: "HS512", family: "HMAC", webCryptoAlg: "SHA-512" },
  { value: "RS256", label: "RS256", family: "RSA", webCryptoAlg: "SHA-256" },
  { value: "RS384", label: "RS384", family: "RSA", webCryptoAlg: "SHA-384" },
  { value: "RS512", label: "RS512", family: "RSA", webCryptoAlg: "SHA-512" },
  { value: "ES256", label: "ES256", family: "ECDSA", webCryptoAlg: "SHA-256" },
  { value: "ES384", label: "ES384", family: "ECDSA", webCryptoAlg: "SHA-384" },
];

export function getAlgorithmFamily(alg: string): AlgorithmFamily {
  if (alg.startsWith("HS")) return "HMAC";
  if (alg.startsWith("RS")) return "RSA";
  if (alg.startsWith("ES")) return "ECDSA";
  return "HMAC";
}

function base64UrlEncode(data: Uint8Array): string {
  const binary = String.fromCharCode(...data);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = atob(lines);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

export async function signHMAC(
  header: string,
  payload: string,
  secret: string,
  hashAlg: string
): Promise<string> {
  const h = base64UrlEncodeString(header);
  const p = base64UrlEncodeString(payload);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: hashAlg }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return `${h}.${p}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function signRSA(
  header: string,
  payload: string,
  privateKeyPem: string,
  hashAlg: string
): Promise<string> {
  const h = base64UrlEncodeString(header);
  const p = base64UrlEncodeString(payload);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const keyBuf = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8", keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: hashAlg },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  return `${h}.${p}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function signECDSA(
  header: string,
  payload: string,
  privateKeyPem: string,
  hashAlg: string,
  alg: string
): Promise<string> {
  const h = base64UrlEncodeString(header);
  const p = base64UrlEncodeString(payload);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const namedCurve = alg === "ES384" ? "P-384" : "P-256";
  const keyBuf = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8", keyBuf,
    { name: "ECDSA", namedCurve },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: hashAlg }, key, data);
  return `${h}.${p}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export function generateUnsigned(header: string, payload: string): string {
  const h = base64UrlEncodeString(header);
  const p = base64UrlEncodeString(payload);
  return `${h}.${p}.`;
}

export interface SecurityAssessment {
  score: number;
  label: string;
  color: string;
  issues: { severity: "critical" | "warning" | "info"; message: string }[];
}

export function assessEncoderSecurity(
  alg: string,
  payload: Record<string, any>,
  secret: string,
  family: AlgorithmFamily
): SecurityAssessment {
  const issues: SecurityAssessment["issues"] = [];
  let score = 100;

  if (alg.toLowerCase() === "none") {
    score -= 40;
    issues.push({ severity: "critical", message: "Algorithm 'none' — token is unsigned" });
  } else if (alg === "HS256") {
    score -= 5;
    issues.push({ severity: "info", message: "HS256 is acceptable; RS256/ES256 preferred for production" });
  }

  if (family === "HMAC") {
    if (!secret) {
      score -= 30;
      issues.push({ severity: "critical", message: "Empty secret — token can be forged" });
    } else if (secret.length < 16) {
      score -= 15;
      issues.push({ severity: "warning", message: "Secret is short (<16 chars) — use a stronger secret" });
    } else if (secret.length < 32) {
      score -= 5;
      issues.push({ severity: "info", message: "Consider a 32+ char secret for production" });
    }
  }

  if (!payload.exp) {
    score -= 20;
    issues.push({ severity: "warning", message: "Missing 'exp' — token never expires" });
  }
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

  score = Math.max(0, score);
  let label = "Excellent";
  let color = "text-[hsl(var(--success-foreground))]";
  if (score < 40) { label = "Poor"; color = "text-destructive"; }
  else if (score < 60) { label = "Fair"; color = "text-[hsl(var(--warning-foreground))]"; }
  else if (score < 80) { label = "Good"; color = "text-[hsl(var(--info))]"; }

  return { score, label, color, issues };
}

export const PAYLOAD_TEMPLATES: Record<string, Record<string, any>> = {
  "Auth Token": {
    sub: "user_123",
    name: "John Doe",
    email: "john@example.com",
    roles: ["user"],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: "https://auth.example.com",
    aud: "https://api.example.com",
  },
  "API Token": {
    sub: "service_api",
    scope: "read write",
    client_id: "client_abc",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    iss: "https://api.example.com",
    aud: "https://api.example.com",
  },
  "Refresh Token": {
    sub: "user_123",
    type: "refresh",
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 604800,
    iss: "https://auth.example.com",
  },
};

// Preset storage
const PRESETS_KEY = "jwt_encoder_presets";
export interface EncoderPreset {
  name: string;
  alg: string;
  header: string;
  payload: string;
  timestamp: number;
}

export function getPresets(): EncoderPreset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); }
  catch { return []; }
}

export function savePreset(preset: EncoderPreset) {
  const presets = getPresets().filter(p => p.name !== preset.name);
  presets.unshift(preset);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 20)));
}

export function deletePreset(name: string) {
  const presets = getPresets().filter(p => p.name !== name);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

// Encoder history
const ENC_HISTORY_KEY = "jwt_encoder_history";
export interface EncoderHistoryEntry {
  token: string;
  alg: string;
  timestamp: number;
  label: string;
}

export function getEncoderHistory(): EncoderHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(ENC_HISTORY_KEY) || "[]"); }
  catch { return []; }
}

export function addEncoderHistory(token: string, alg: string, payload: Record<string, any>) {
  const history = getEncoderHistory().filter(h => h.token !== token);
  const label = payload.sub || payload.email || payload.iss || "JWT";
  history.unshift({ token, alg, timestamp: Date.now(), label: String(label) });
  localStorage.setItem(ENC_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
}

export function clearEncoderHistory() {
  localStorage.removeItem(ENC_HISTORY_KEY);
}

export function generateCodeExamplesForEncoding(alg: string, payloadStr: string) {
  const shortPayload = payloadStr.length > 60 ? payloadStr.slice(0, 60) + "..." : payloadStr;
  return {
    nodejs: `const jwt = require('jsonwebtoken');
const token = jwt.sign(
  ${shortPayload},
  'your-secret',
  { algorithm: '${alg}' }
);
console.log(token);`,
    php: `<?php
use Firebase\\JWT\\JWT;
$payload = json_decode('${shortPayload}', true);
$token = JWT::encode($payload, 'your-secret', '${alg}');
echo $token;`,
    python: `import jwt
payload = ${shortPayload}
token = jwt.encode(payload, 'your-secret', algorithm='${alg}')
print(token)`,
    curl: `# Decode a generated token
curl -s https://jwt.io/#debugger-io?token=YOUR_TOKEN`,
  };
}
