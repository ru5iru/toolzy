/**
 * Converts a regex AST (RN) to an inline SVG railroad diagram.
 * Layout model: each block has up/down (space above/below the main rail)
 * and a render function that draws it at an absolute (x, railY).
 */

import type { RN } from "./parseRegex";

const AR  = 10;   // arc radius for corners
const HS  = 10;   // horizontal gap between sequence items
const VS  = 8;    // vertical gap between alternatives / loops
const PAD = 15;   // canvas padding

interface Blk {
  w:    number;
  up:   number;   // space above rail
  down: number;   // space below rail
  render(x: number, ry: number): string;
}

// ─── SVG primitives ──────────────────────────────────────────────────────────

function f(n: number): string { return n.toFixed(1); }
function e(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function hline(x1: number, y: number, x2: number): string {
  return x2 > x1 + 0.5 ? `<line x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}" class="rr-l"/>` : "";
}
function vline(x: number, y1: number, y2: number): string {
  if (y1 >= y2 - 0.5) return "";
  const [a, b] = y1 < y2 ? [y1, y2] : [y2, y1];
  return `<line x1="${f(x)}" y1="${f(a)}" x2="${f(x)}" y2="${f(b)}" class="rr-l"/>`;
}
// Corner arcs — quadratic bezier, 90°
function rdArc(x: number, y: number): string {   // right → down
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x+AR)} ${f(y)} ${f(x+AR)} ${f(y+AR)}" fill="none" class="rr-l"/>`;
}
function drArc(x: number, y: number): string {   // down → right
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x)} ${f(y+AR)} ${f(x+AR)} ${f(y+AR)}" fill="none" class="rr-l"/>`;
}
function ruArc(x: number, y: number): string {   // right → up
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x+AR)} ${f(y)} ${f(x+AR)} ${f(y-AR)}" fill="none" class="rr-l"/>`;
}
function urArc(x: number, y: number): string {   // up → right
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x)} ${f(y-AR)} ${f(x+AR)} ${f(y-AR)}" fill="none" class="rr-l"/>`;
}
function ldArc(x: number, y: number): string {   // left → down (reverse of rdArc but mirrored)
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x-AR)} ${f(y)} ${f(x-AR)} ${f(y+AR)}" fill="none" class="rr-l"/>`;
}
function dlArc(x: number, y: number): string {   // down → left
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x)} ${f(y+AR)} ${f(x-AR)} ${f(y+AR)}" fill="none" class="rr-l"/>`;
}
function luArc(x: number, y: number): string {   // left → up
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x-AR)} ${f(y)} ${f(x-AR)} ${f(y-AR)}" fill="none" class="rr-l"/>`;
}
function ulArc(x: number, y: number): string {   // up → left
  return `<path d="M ${f(x)} ${f(y)} Q ${f(x)} ${f(y-AR)} ${f(x-AR)} ${f(y-AR)}" fill="none" class="rr-l"/>`;
}

// ─── Block constructors ───────────────────────────────────────────────────────

function emptyBlk(): Blk {
  return { w: 0, up: 0, down: 0, render: () => "" };
}

function termBlk(text: string, cls = "rr-t"): Blk {
  const w = Math.max(text.length * 6.4 + 20, 36);
  const up = 12, down = 12;
  return {
    w, up, down,
    render: (x, ry) =>
      `<rect x="${f(x)}" y="${f(ry-up)}" width="${f(w)}" height="${f(up+down)}" rx="4" class="${cls}"/>` +
      `<text x="${f(x+w/2)}" y="${f(ry+4)}" class="rr-txt" text-anchor="middle">${e(text)}</text>`,
  };
}

function seqBlk(items: Blk[]): Blk {
  if (!items.length) return emptyBlk();
  if (items.length === 1) return items[0];
  const up   = Math.max(...items.map(b => b.up));
  const down = Math.max(...items.map(b => b.down));
  const w    = items.reduce((s, b) => s + b.w, 0) + (items.length - 1) * HS;
  return {
    w, up, down,
    render: (x, ry) => {
      let svg = ""; let cx = x;
      for (let i = 0; i < items.length; i++) {
        svg += items[i].render(cx, ry);
        cx  += items[i].w;
        if (i < items.length - 1) { svg += hline(cx, ry, cx + HS); cx += HS; }
      }
      return svg;
    },
  };
}

function altBlk(opts: Blk[]): Blk {
  if (!opts.length) return emptyBlk();
  if (opts.length === 1) return opts[0];

  const innerW = Math.max(...opts.map(b => b.w));
  const SA = AR * 2; // side arm length
  const w  = innerW + SA * 2;
  const up = opts[0].up;

  // y-offsets of each option's rail relative to the main rail (ry)
  const offsets: number[] = [0];
  let dy = opts[0].down + VS + opts[1].up;
  for (let i = 1; i < opts.length; i++) {
    offsets.push(dy);
    if (i < opts.length - 1) dy += opts[i].down + VS + opts[i+1].up;
  }
  const down = offsets[opts.length - 1] + opts[opts.length - 1].down;

  return {
    w, up, down,
    render: (x, ry) => {
      let svg = "";
      for (let i = 0; i < opts.length; i++) {
        const iRy = ry + offsets[i];
        const ix  = x + SA + (innerW - opts[i].w) / 2;
        svg += opts[i].render(ix, iRy);

        if (i === 0) {
          // main rail: straight through
          svg += hline(x, ry, ix);
          svg += hline(ix + opts[i].w, ry, x + w);
        } else {
          // left: (x, ry) → curve down → (x+SA, iRy)
          svg += rdArc(x, ry);
          svg += vline(x + AR, ry + AR, iRy - AR);
          svg += drArc(x + AR, iRy - AR);
          svg += hline(x + SA, iRy, ix);

          // right: (ix+w, iRy) → curve up → (x+w, ry)
          const ex = ix + opts[i].w;
          svg += hline(ex, iRy, x + w - SA);
          svg += ldArc(x + w - SA + AR + AR, iRy);  // right→up entering from right: use ruArc
          svg += ruArc(x + w - SA, iRy);
          svg += vline(x + w - AR, ry + AR, iRy - AR);
          svg += urArc(x + w - AR, ry + AR);
        }
      }
      return svg;
    },
  };
}

/** Wraps node in an optional bypass (skip path above). */
function optBlk(inner: Blk): Blk {
  const SA = AR * 2;
  const topClear = AR + VS;                     // arc height for the bypass
  const w    = inner.w + SA * 2;
  const up   = inner.up + topClear + AR;        // include bypass height
  const down = inner.down;
  return {
    w, up, down,
    render: (x, ry) => {
      let svg = "";
      const ix = x + SA;
      svg += inner.render(ix, ry);
      svg += hline(x, ry, ix);                        // entry stub
      svg += hline(ix + inner.w, ry, x + w);          // exit stub
      // bypass path above: entry curves up, runs flat, curves back down
      const topY = ry - inner.up - VS;
      svg += ruArc(x, ry);                            // right→up at entry
      svg += vline(x + AR, topY + AR, ry - AR);       // up
      svg += urArc(x + AR, topY + AR);                // up→right
      svg += hline(x + SA, topY, x + w - SA);         // across top
      svg += rdArc(x + w - SA, topY);                 // right→down
      svg += vline(x + w - AR, topY + AR, ry - AR);   // down
      svg += drArc(x + w - AR, ry - AR);              // down→right at exit
      return svg;
    },
  };
}

/** Wraps node in a repeat loop (loop-back path below). */
function loopBlk(inner: Blk, label?: string): Blk {
  const SA    = AR * 2;
  const lh    = label ? 10 : 0;                   // extra height for label
  const botY_offset = inner.down + VS;             // how far below ry the loop goes
  const w     = inner.w + SA * 2;
  const up    = inner.up;
  const down  = inner.down + VS + AR + lh;
  return {
    w, up, down,
    render: (x, ry) => {
      let svg = "";
      const ix = x + SA;
      svg += inner.render(ix, ry);
      svg += hline(x, ry, ix);
      svg += hline(ix + inner.w, ry, x + w);
      // loop: exit curves down and back left to entry
      const botY = ry + botY_offset;
      // right side: curve down
      svg += rdArc(ix + inner.w, ry);                       // right→down (item exit)
      svg += vline(ix + inner.w + AR, ry + AR, botY - AR);  // down
      svg += dlArc(ix + inner.w + AR + AR, botY - AR);     // actually use direct arc
      // Let me redo the loop corners cleanly:
      // Right-down corner at (x+w-AR, ry): exits at (x+w, ry+AR)
      svg = "";                                               // restart svg for this blk
      svg += inner.render(ix, ry);
      svg += hline(x, ry, ix);
      svg += hline(ix + inner.w, ry, x + w);
      // right side of loop
      svg += ldArc(x + w, ry);                              // right→down reversed = left→down
      // Hmm. Let me use direct SVG path strings for the loop:
      // The loop goes: from (x+w, ry), curves down-and-left to bottom, goes left, curves up to (x, ry)
      const bY = ry + inner.down + VS;
      svg += `<path d="M ${f(x+w)} ${f(ry)} Q ${f(x+w)} ${f(ry+AR)} ${f(x+w-AR)} ${f(ry+AR)}" fill="none" class="rr-l"/>`;
      svg += hline(x + AR, ry + AR, x + w - AR);           // bottom horizontal (backward arrow)
      if (label) svg += `<text x="${f(x+w/2)}" y="${f(ry+AR+10)}" class="rr-loop-lbl" text-anchor="middle">${e(label)}</text>`;
      svg += `<path d="M ${f(x+AR)} ${f(ry+AR)} Q ${f(x)} ${f(ry+AR)} ${f(x)} ${f(ry)}" fill="none" class="rr-l"/>`;
      return svg;
    },
  };
}

/** optional + loop for `*` */
function starBlk(inner: Blk): Blk { return optBlk(loopBlk(inner)); }
/** loop only for `+` */
function plusBlk(inner: Blk): Blk { return loopBlk(inner); }

function groupBlk(inner: Blk, label: string): Blk {
  const PADi = 8;
  const w    = inner.w + PADi * 2;
  const up   = inner.up + PADi;
  const down = inner.down + PADi;
  return {
    w, up, down,
    render: (x, ry) => {
      const svg = inner.render(x + PADi, ry);
      return `<rect x="${f(x)}" y="${f(ry-up)}" width="${f(w)}" height="${f(up+down)}" rx="4" class="rr-g"/>` +
        (label ? `<text x="${f(x+4)}" y="${f(ry-up+10)}" class="rr-glbl">${e(label)}</text>` : "") +
        svg;
    },
  };
}

// ─── AST → Blk ───────────────────────────────────────────────────────────────

function toBlk(node: RN): Blk {
  switch (node.k) {
    case "empty":  return emptyBlk();
    case "lit":    return termBlk(node.v);
    case "dot":    return termBlk("any", "rr-t rr-meta");
    case "anchor": return termBlk(node.v, "rr-t rr-anchor");
    case "esc":    return termBlk(node.v, "rr-t rr-meta");
    case "cls":    return termBlk(node.raw, node.neg ? "rr-t rr-cls-neg" : "rr-t rr-cls");

    case "seq": {
      // Coalesce adjacent literals into one terminal for readability
      const coalesced: RN[] = [];
      for (const ch of node.ch) {
        const last = coalesced[coalesced.length - 1];
        if (ch.k === "lit" && last?.k === "lit") {
          coalesced[coalesced.length - 1] = { k: "lit", v: (last as { k: "lit"; v: string }).v + ch.v };
        } else {
          coalesced.push(ch);
        }
      }
      return seqBlk(coalesced.map(toBlk));
    }

    case "alt":
      return altBlk(node.ch.map(toBlk));

    case "quant": {
      const inner = toBlk(node.ch);
      const { min, max, lazy } = node;
      const sfx = lazy ? "?" : "";
      if (min === 0 && max === 1)    return optBlk(inner);
      if (min === 0 && max === null) return starBlk(inner);
      if (min === 1 && max === null) return plusBlk(inner);
      // {n}, {n,m}, {n,}
      const lbl = max == null ? `${min}+${sfx}` : min === max ? `×${min}${sfx}` : `${min}…${max}${sfx}`;
      return loopBlk(optBlk(inner), lbl);
    }

    case "group": {
      const inner = toBlk(node.ch);
      if (node.look) return groupBlk(inner, node.look);
      const lbl = node.name ? `(?<${node.name}>)` : node.cap ? "()" : "(?:)";
      return groupBlk(inner, lbl);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

const CSS = `
.rr-l { stroke: currentColor; opacity: .6; stroke-width: 1.5; }
.rr-t { fill: hsl(var(--primary)/0.12); stroke: hsl(var(--primary)/0.5); stroke-width: 1; }
.rr-t.rr-meta { fill: hsl(var(--warning,40 90% 55%)/0.12); stroke: hsl(var(--warning,40 90% 55%)/0.5); }
.rr-t.rr-anchor { fill: hsl(var(--success,142 71% 45%)/0.12); stroke: hsl(var(--success,142 71% 45%)/0.5); }
.rr-t.rr-cls { fill: hsl(260 60% 60%/0.12); stroke: hsl(260 60% 60%/0.5); }
.rr-t.rr-cls-neg { fill: hsl(var(--destructive)/0.12); stroke: hsl(var(--destructive)/0.5); }
.rr-txt { font: 11px/1 ui-monospace,monospace; fill: currentColor; }
.rr-g { fill: none; stroke: hsl(var(--border)); stroke-width: 1; stroke-dasharray: 4 2; }
.rr-glbl { font: 9px/1 ui-monospace,monospace; fill: hsl(var(--muted-foreground)); }
.rr-loop-lbl { font: 9px/1 ui-monospace,monospace; fill: hsl(var(--muted-foreground)); }
`;

export interface DiagramResult {
  svg: string;
  width: number;
  height: number;
  error?: string;
}

export function buildRailroad(node: RN): DiagramResult {
  try {
    const blk  = toBlk(node);
    // Add entry/exit arrows and padding
    const aw   = 20; // arrow width on each side
    const totalW = blk.w + aw * 2 + PAD * 2;
    const totalH = blk.up + blk.down + PAD * 2;
    const ry     = PAD + blk.up;

    let content = "";
    // entry arrow
    content += `<line x1="${f(PAD)}" y1="${f(ry)}" x2="${f(PAD+aw)}" y2="${f(ry)}" class="rr-l"/>`;
    content += `<polygon points="${f(PAD+aw-6)},${f(ry-4)} ${f(PAD+aw)},${f(ry)} ${f(PAD+aw-6)},${f(ry+4)}" fill="currentColor" opacity=".5"/>`;
    // main block
    content += blk.render(PAD + aw, ry);
    // exit arrow
    content += `<line x1="${f(PAD+aw+blk.w)}" y1="${f(ry)}" x2="${f(PAD+aw+blk.w+aw)}" y2="${f(ry)}" class="rr-l"/>`;
    content += `<polygon points="${f(PAD+aw+blk.w+aw-6)},${f(ry-4)} ${f(PAD+aw+blk.w+aw)},${f(ry)} ${f(PAD+aw+blk.w+aw-6)},${f(ry+4)}" fill="currentColor" opacity=".5"/>`;

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" ` +
      `viewBox="0 0 ${totalW} ${totalH}" class="rr-diagram" aria-label="Railroad diagram">` +
      `<style>${CSS}</style>` +
      content +
      `</svg>`;

    return { svg, width: totalW, height: totalH };
  } catch (err) {
    return { svg: "", width: 0, height: 0, error: String(err) };
  }
}
