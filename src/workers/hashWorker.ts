/// <reference lib="webworker" />
// Hash worker: receives ArrayBuffer + list of algos, posts back hashes
export {};

self.onmessage = async (e: MessageEvent) => {
  const { buffer, algos, id } = e.data as {
    buffer: ArrayBuffer;
    algos: string[];
    id: number;
  };
  try {
    const results: Record<string, ArrayBuffer> = {};
    for (const algo of algos) {
      // progress per algo
      (self as any).postMessage({ id, type: "progress", algo, done: false });
      results[algo] = await crypto.subtle.digest(algo, buffer);
    }
    (self as any).postMessage({ id, type: "done", results });
  } catch (err) {
    (self as any).postMessage({ id, type: "error", message: (err as Error).message });
  }
};
