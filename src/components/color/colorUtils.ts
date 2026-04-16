// ===== Color Conversion Utilities =====

export interface RGB { r: number; g: number; b: number; a: number }
export interface HSL { h: number; s: number; l: number; a: number }
export interface HSV { h: number; s: number; v: number; a: number }
export interface CMYK { c: number; m: number; y: number; k: number }

// --- Parsing ---

const CSS_NAMED_COLORS: Record<string, string> = {
  red: '#ff0000', green: '#008000', blue: '#0000ff', white: '#ffffff', black: '#000000',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', orange: '#ffa500', purple: '#800080',
  pink: '#ffc0cb', lime: '#00ff00', teal: '#008080', navy: '#000080', maroon: '#800000',
  aqua: '#00ffff', silver: '#c0c0c0', gray: '#808080', grey: '#808080', olive: '#808000',
  coral: '#ff7f50', salmon: '#fa8072', tomato: '#ff6347', gold: '#ffd700', khaki: '#f0e68c',
  violet: '#ee82ee', indigo: '#4b0082', turquoise: '#40e0d0', crimson: '#dc143c', chocolate: '#d2691e',
  plum: '#dda0dd', orchid: '#da70d6', sienna: '#a0522d', peru: '#cd853f', tan: '#d2b48c',
  beige: '#f5f5dc', ivory: '#fffff0', linen: '#faf0e6', lavender: '#e6e6fa', wheat: '#f5deb3',
  snow: '#fffafa', honeydew: '#f0fff0', mintcream: '#f5fffa', azure: '#f0ffff', aliceblue: '#f0f8ff',
  ghostwhite: '#f8f8ff', seashell: '#fff5ee', oldlace: '#fdf5e6', floralwhite: '#fffaf0',
};

export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // Named color
  if (CSS_NAMED_COLORS[s]) return parseHex(CSS_NAMED_COLORS[s]);

  // HEX
  if (s.startsWith('#') || /^[0-9a-f]{3,8}$/i.test(s)) return parseHex(s);

  // RGB(A)
  const rgbM = s.match(/^rgba?\(\s*([\d.]+)%?\s*[,/\s]\s*([\d.]+)%?\s*[,/\s]\s*([\d.]+)%?\s*(?:[,/\s]\s*([\d.]+%?))?\s*\)$/);
  if (rgbM) {
    return {
      r: clamp(parseFloat(rgbM[1]), 0, 255),
      g: clamp(parseFloat(rgbM[2]), 0, 255),
      b: clamp(parseFloat(rgbM[3]), 0, 255),
      a: rgbM[4] ? parseAlpha(rgbM[4]) : 1,
    };
  }

  // HSL(A)
  const hslM = s.match(/^hsla?\(\s*([\d.]+)\s*[,/\s]\s*([\d.]+)%?\s*[,/\s]\s*([\d.]+)%?\s*(?:[,/\s]\s*([\d.]+%?))?\s*\)$/);
  if (hslM) {
    const hsl: HSL = {
      h: parseFloat(hslM[1]) % 360,
      s: clamp(parseFloat(hslM[2]), 0, 100),
      l: clamp(parseFloat(hslM[3]), 0, 100),
      a: hslM[4] ? parseAlpha(hslM[4]) : 1,
    };
    return hslToRgb(hsl);
  }

  // HSV/HSB
  const hsvM = s.match(/^hs[vb]\(\s*([\d.]+)\s*[,/\s]\s*([\d.]+)%?\s*[,/\s]\s*([\d.]+)%?\s*\)$/);
  if (hsvM) {
    return hsvToRgb({
      h: parseFloat(hsvM[1]) % 360,
      s: clamp(parseFloat(hsvM[2]), 0, 100),
      v: clamp(parseFloat(hsvM[3]), 0, 100),
      a: 1,
    });
  }

  // HWB
  const hwbM = s.match(/^hwb\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+%?))?\s*\)$/);
  if (hwbM) {
    return hwbToRgb(parseFloat(hwbM[1]), parseFloat(hwbM[2]), parseFloat(hwbM[3]), hwbM[4] ? parseAlpha(hwbM[4]) : 1);
  }

  return null;
}

function parseHex(s: string): RGB | null {
  let h = s.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
  if (h.length !== 6 && h.length !== 8) return null;
  const n = parseInt(h.substring(0, 6), 16);
  if (isNaN(n)) return null;
  const a = h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
}

function parseAlpha(v: string): number {
  if (v.endsWith('%')) return clamp(parseFloat(v) / 100, 0, 1);
  return clamp(parseFloat(v), 0, 1);
}

// --- Conversions ---

export function rgbToHex(c: RGB): string {
  const hex = `#${[c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  if (c.a < 1) return hex + Math.round(c.a * 255).toString(16).padStart(2, '0');
  return hex;
}

export function rgbToHsl(c: RGB): HSL {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100), a: c.a };
}

export function hslToRgb(c: HSL): RGB {
  const h = c.h / 360, s = c.s / 100, l = c.l / 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v, a: c.a }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
    a: c.a,
  };
}

export function rgbToHsv(c: RGB): HSV {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(max * 100), a: c.a };
}

export function hsvToRgb(c: HSV): RGB {
  const h = c.h / 360, s = c.s / 100, v = c.v / 100;
  const i = Math.floor(h * 6);
  const f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: c.a };
}

export function rgbToCmyk(c: RGB): CMYK {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function hwbToRgb(h: number, w: number, bk: number, a: number): RGB {
  const ww = w / 100, bb = bk / 100;
  if (ww + bb >= 1) {
    const g = Math.round((ww / (ww + bb)) * 255);
    return { r: g, g, b: g, a };
  }
  const rgb = hslToRgb({ h, s: 100, l: 50, a: 1 });
  const f = (v: number) => Math.round(v / 255 * (1 - ww - bb) * 255 + ww * 255);
  return { r: f(rgb.r), g: f(rgb.g), b: f(rgb.b), a };
}

// --- Format strings ---

export function formatRgb(c: RGB): string {
  return c.a < 1 ? `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${round2(c.a)})` : `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}

export function formatHsl(c: HSL): string {
  return c.a < 1 ? `hsla(${c.h}, ${c.s}%, ${c.l}%, ${round2(c.a)})` : `hsl(${c.h}, ${c.s}%, ${c.l}%)`;
}

export function formatHsv(c: HSV): string {
  return `hsv(${c.h}, ${c.s}%, ${c.v}%)`;
}

export function formatCmyk(c: CMYK): string {
  return `cmyk(${c.c}%, ${c.m}%, ${c.y}%, ${c.k}%)`;
}

// --- Palette generation ---

export function generatePalette(c: RGB, type: string): RGB[] {
  const hsl = rgbToHsl(c);
  switch (type) {
    case 'complementary': return [c, hslToRgb({ ...hsl, h: (hsl.h + 180) % 360 })];
    case 'analogous': return [hslToRgb({ ...hsl, h: (hsl.h - 30 + 360) % 360 }), c, hslToRgb({ ...hsl, h: (hsl.h + 30) % 360 })];
    case 'triadic': return [c, hslToRgb({ ...hsl, h: (hsl.h + 120) % 360 }), hslToRgb({ ...hsl, h: (hsl.h + 240) % 360 })];
    case 'tetradic': return [c, hslToRgb({ ...hsl, h: (hsl.h + 90) % 360 }), hslToRgb({ ...hsl, h: (hsl.h + 180) % 360 }), hslToRgb({ ...hsl, h: (hsl.h + 270) % 360 })];
    case 'monochromatic': return Array.from({ length: 5 }, (_, i) => hslToRgb({ ...hsl, l: clamp(hsl.l - 20 + i * 10, 5, 95) }));
    case 'shades': return Array.from({ length: 7 }, (_, i) => hslToRgb({ ...hsl, l: Math.round((6 - i) * (hsl.l / 6)) }));
    case 'tints': return Array.from({ length: 7 }, (_, i) => hslToRgb({ ...hsl, l: Math.round(hsl.l + i * ((100 - hsl.l) / 6)) }));
    default: return [c];
  }
}

// --- WCAG Contrast ---

export function luminance(c: RGB): number {
  const [r, g, b] = [c.r, c.g, c.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(c1: RGB, c2: RGB): number {
  const l1 = luminance(c1), l2 = luminance(c2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- Color name matching ---

const COLOR_NAMES: [string, number, number, number][] = [
  ['Red', 255, 0, 0], ['Crimson', 220, 20, 60], ['Tomato', 255, 99, 71], ['Coral', 255, 127, 80],
  ['Orange', 255, 165, 0], ['Gold', 255, 215, 0], ['Yellow', 255, 255, 0], ['Lime', 0, 255, 0],
  ['Green', 0, 128, 0], ['Teal', 0, 128, 128], ['Cyan', 0, 255, 255], ['Turquoise', 64, 224, 208],
  ['Sky Blue', 135, 206, 235], ['Blue', 0, 0, 255], ['Navy', 0, 0, 128], ['Indigo', 75, 0, 130],
  ['Purple', 128, 0, 128], ['Violet', 238, 130, 238], ['Magenta', 255, 0, 255], ['Pink', 255, 192, 203],
  ['Rose', 255, 0, 127], ['Brown', 139, 69, 19], ['Chocolate', 210, 105, 30], ['Tan', 210, 180, 140],
  ['Beige', 245, 245, 220], ['White', 255, 255, 255], ['Silver', 192, 192, 192], ['Gray', 128, 128, 128],
  ['Dark Gray', 64, 64, 64], ['Black', 0, 0, 0],
];

export function closestColorName(c: RGB): string {
  let best = 'Unknown', bestDist = Infinity;
  for (const [name, r, g, b] of COLOR_NAMES) {
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

const TW_COLORS: [string, number, number, number][] = [
  ['red-500', 239, 68, 68], ['orange-500', 249, 115, 22], ['amber-500', 245, 158, 11],
  ['yellow-500', 234, 179, 8], ['lime-500', 132, 204, 22], ['green-500', 34, 197, 94],
  ['emerald-500', 16, 185, 129], ['teal-500', 20, 184, 166], ['cyan-500', 6, 182, 212],
  ['sky-500', 14, 165, 233], ['blue-500', 59, 130, 246], ['indigo-500', 99, 102, 241],
  ['violet-500', 139, 92, 246], ['purple-500', 168, 85, 247], ['fuchsia-500', 217, 70, 239],
  ['pink-500', 236, 72, 153], ['rose-500', 244, 63, 94], ['slate-500', 100, 116, 139],
  ['gray-500', 107, 114, 128], ['zinc-500', 113, 113, 122], ['neutral-500', 115, 115, 115],
  ['stone-500', 120, 113, 108],
];

export function closestTailwind(c: RGB): string {
  let best = 'gray-500', bestDist = Infinity;
  for (const [name, r, g, b] of TW_COLORS) {
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

// --- Image color extraction ---

export function extractColors(imageData: ImageData, count = 6): RGB[] {
  const pixels: RGB[] = [];
  for (let i = 0; i < imageData.data.length; i += 16) { // sample every 4th pixel
    pixels.push({ r: imageData.data[i], g: imageData.data[i+1], b: imageData.data[i+2], a: 1 });
  }
  // Simple k-means-ish: bucket by hue
  const buckets = new Map<number, { sum: RGB; count: number }>();
  for (const p of pixels) {
    const hsl = rgbToHsl(p);
    const key = Math.round(hsl.h / (360 / Math.max(count * 2, 12)));
    const b = buckets.get(key) || { sum: { r: 0, g: 0, b: 0, a: 1 }, count: 0 };
    b.sum.r += p.r; b.sum.g += p.g; b.sum.b += p.b; b.count++;
    buckets.set(key, b);
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map(b => ({
      r: Math.round(b.sum.r / b.count),
      g: Math.round(b.sum.g / b.count),
      b: Math.round(b.sum.b / b.count),
      a: 1,
    }));
}

// --- Helpers ---

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
