// Base64 encoding/decoding utilities - fully client-side

export type EncodingType = 'utf-8' | 'ascii' | 'utf-16';
export type Base64Variant = 'standard' | 'url-safe';
export type WrapMode = 'none' | 'mime' | 'custom';
export type ContentType = 'text' | 'json' | 'image' | 'binary';

export interface AnalysisResult {
  originalSize: number;
  encodedSize: number;
  percentIncrease: number;
}

export interface DetectedContent {
  type: ContentType;
  mimeType?: string;
  text?: string;
  json?: unknown;
  imageUrl?: string;
  blobUrl?: string;
  dimensions?: { width: number; height: number };
}

export interface ConversionHistoryItem {
  id: string;
  mode: 'encode' | 'decode';
  inputPreview: string;
  outputPreview: string;
  timestamp: number;
  inputSize: number;
  outputSize: number;
}

const HISTORY_KEY = 'base64_history';
const MAX_HISTORY = 10;

// Check if a string is valid Base64
export function isValidBase64(str: string): { valid: boolean; error?: string } {
  const trimmed = str.trim();
  if (!trimmed) return { valid: false, error: 'Empty input' };

  // Remove data URI prefix if present
  const base64Only = trimmed.replace(/^data:[^;]+;base64,/, '');

  // Check for invalid characters
  const invalidChars = base64Only.match(/[^A-Za-z0-9+/=\s\n\r-_]/g);
  if (invalidChars) {
    return { valid: false, error: `Invalid characters: ${[...new Set(invalidChars)].join(' ')}` };
  }

  // Check padding
  const noPad = base64Only.replace(/[\s\n\r]/g, '');
  if (noPad.length % 4 !== 0 && !noPad.match(/[_-]/)) {
    return { valid: false, error: 'Invalid padding — length must be multiple of 4' };
  }

  try {
    atob(urlSafeToStandard(base64Only.replace(/[\s\n\r]/g, '')));
    return { valid: true };
  } catch {
    return { valid: false, error: 'Cannot decode — malformed Base64 string' };
  }
}

export function autoDetectMode(input: string): 'encode' | 'decode' {
  const trimmed = input.trim();
  if (trimmed.startsWith('data:') && trimmed.includes(';base64,')) return 'decode';
  const { valid } = isValidBase64(trimmed);
  if (valid && trimmed.length > 8 && /^[A-Za-z0-9+/=_-]+$/.test(trimmed.replace(/\s/g, ''))) {
    return 'decode';
  }
  return 'encode';
}

function urlSafeToStandard(b64: string): string {
  return b64.replace(/-/g, '+').replace(/_/g, '/');
}

function standardToUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeText(
  text: string,
  encoding: EncodingType = 'utf-8',
  variant: Base64Variant = 'standard',
  wrapMode: WrapMode = 'none',
  customWrapLength = 76
): string {
  let bytes: Uint8Array;
  if (encoding === 'utf-16') {
    const buf = new ArrayBuffer(text.length * 2);
    const view = new Uint16Array(buf);
    for (let i = 0; i < text.length; i++) view[i] = text.charCodeAt(i);
    bytes = new Uint8Array(buf);
  } else {
    bytes = new TextEncoder().encode(text);
  }

  let b64 = arrayBufferToBase64(bytes);
  if (variant === 'url-safe') b64 = standardToUrlSafe(b64);

  return applyWrap(b64, wrapMode, customWrapLength);
}

export function decodeBase64(b64: string, encoding: EncodingType = 'utf-8'): Uint8Array {
  let clean = b64.trim().replace(/^data:[^;]+;base64,/, '').replace(/[\s\n\r]/g, '');
  clean = urlSafeToStandard(clean);
  // Fix padding
  while (clean.length % 4 !== 0) clean += '=';
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodeToText(b64: string, encoding: EncodingType = 'utf-8'): string {
  const bytes = decodeBase64(b64, encoding);
  if (encoding === 'utf-16') {
    const view = new Uint16Array(bytes.buffer);
    return String.fromCharCode(...view);
  }
  return new TextDecoder(encoding).decode(bytes);
}

export function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  return btoa(binary);
}

export function encodeFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function applyWrap(b64: string, mode: WrapMode, length: number): string {
  if (mode === 'none') return b64;
  const wrapAt = mode === 'mime' ? 76 : length;
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += wrapAt) lines.push(b64.substring(i, i + wrapAt));
  return lines.join('\n');
}

export function detectContentType(bytes: Uint8Array): DetectedContent {
  // Check image signatures
  const mime = detectMimeType(bytes);
  if (mime?.startsWith('image/')) {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    return { type: 'image', mimeType: mime, imageUrl: url, blobUrl: url };
  }

  // Try as text
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Try JSON
    try {
      const json = JSON.parse(text);
      return { type: 'json', text, json, mimeType: 'application/json' };
    } catch {
      return { type: 'text', text, mimeType: 'text/plain' };
    }
  } catch {
    const blob = new Blob([bytes.buffer as ArrayBuffer]);
    return { type: 'binary', mimeType: mime || 'application/octet-stream', blobUrl: URL.createObjectURL(blob) };
  }
}

export function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) return 'application/zip';
  return null;
}

export function analyze(input: string, output: string): AnalysisResult {
  const originalSize = new TextEncoder().encode(input).length;
  const encodedSize = new TextEncoder().encode(output).length;
  return {
    originalSize,
    encodedSize,
    percentIncrease: originalSize > 0 ? Math.round(((encodedSize - originalSize) / originalSize) * 100) : 0,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// History
export function getHistory(): ConversionHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToHistory(item: Omit<ConversionHistoryItem, 'id' | 'timestamp'>): void {
  const history = getHistory();
  history.unshift({
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// Code snippets
export function generateCodeSnippets(input: string, mode: 'encode' | 'decode') {
  const escaped = input.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').substring(0, 200);
  if (mode === 'encode') {
    return {
      javascript: `// Encode\nconst encoded = btoa(unescape(encodeURIComponent('${escaped}')));\nconsole.log(encoded);`,
      php: `<?php\n$encoded = base64_encode('${escaped}');\necho $encoded;`,
      python: `import base64\nencoded = base64.b64encode('${escaped}'.encode('utf-8')).decode('utf-8')\nprint(encoded)`,
      java: `import java.util.Base64;\nString encoded = Base64.getEncoder().encodeToString(\n  "${escaped}".getBytes("UTF-8"));\nSystem.out.println(encoded);`,
    };
  }
  return {
    javascript: `// Decode\nconst decoded = decodeURIComponent(escape(atob('${escaped}')));\nconsole.log(decoded);`,
    php: `<?php\n$decoded = base64_decode('${escaped}');\necho $decoded;`,
    python: `import base64\ndecoded = base64.b64decode('${escaped}').decode('utf-8')\nprint(decoded)`,
    java: `import java.util.Base64;\nbyte[] decoded = Base64.getDecoder().decode("${escaped}");\nSystem.out.println(new String(decoded, "UTF-8"));`,
  };
}
