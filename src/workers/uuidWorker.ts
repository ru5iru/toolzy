/// <reference lib="webworker" />
// UUID v4 bulk generation worker
export {};

function v4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (v) => v.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

self.onmessage = (e: MessageEvent) => {
  const { count, id } = e.data as { count: number; id: number };
  const out: string[] = new Array(count);
  const batch = 5000;
  let i = 0;
  const tick = () => {
    const end = Math.min(i + batch, count);
    for (; i < end; i++) out[i] = v4();
    (self as any).postMessage({ id, type: "progress", done: i, total: count });
    if (i < count) {
      setTimeout(tick, 0);
    } else {
      (self as any).postMessage({ id, type: "done", uuids: out });
    }
  };
  tick();
};
