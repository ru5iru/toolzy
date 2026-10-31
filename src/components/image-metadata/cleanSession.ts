import type { CleanOptions, CleanResult } from "./cleanUtils";

export interface CleanWorkerPort {
  onmessage: ((event: MessageEvent<{ result?: CleanResult; error?: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: { file: File; options: CleanOptions }): void;
  terminate(): void;
}
export type CleanState = { status: "idle" | "loading" | "ready" | "error"; result?: CleanResult; error?: string };

/** One disposable worker per clean request; a newer request or clear() discards stale results. */
export class CleanSession {
  private generation = 0;
  private worker?: CleanWorkerPort;
  private timeout?: ReturnType<typeof setTimeout>;
  constructor(private factory: () => CleanWorkerPort, private publish: (state: CleanState) => void) {}
  clear() {
    this.generation++;
    this.worker?.terminate();
    this.worker = undefined;
    clearTimeout(this.timeout);
    this.publish({ status: "idle" });
  }
  run(file: File, options: CleanOptions) {
    this.clear();
    const generation = this.generation;
    const worker = this.factory();
    this.worker = worker;
    this.publish({ status: "loading" });
    const finish = (state: CleanState) => {
      if (generation !== this.generation || this.worker !== worker) return;
      worker.terminate();
      this.worker = undefined;
      clearTimeout(this.timeout);
      this.publish(state);
    };
    worker.onmessage = ({ data }) => finish(data.result ? { status: "ready", result: data.result } : { status: "error", error: data.error ?? "Clean copy failed." });
    worker.onerror = () => finish({ status: "error", error: "Clean copy failed while processing the image." });
    this.timeout = setTimeout(() => finish({ status: "error", error: "Processing exceeded 20 seconds and was stopped." }), 20000);
    worker.postMessage({ file, options });
  }
}
