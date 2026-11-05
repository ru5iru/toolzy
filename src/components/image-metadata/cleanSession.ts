import type { CleanOptions, CleanResult } from "./cleanUtils";

export interface CleanWorkerPort {
  onmessage: ((event: MessageEvent<{ result?: CleanResult; error?: string; ready?: boolean }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: { file: File; options: CleanOptions }): void;
  terminate(): void;
}
export type CleanState = { status: "idle" | "loading" | "ready" | "error"; phase?: "starting" | "cleaning"; result?: CleanResult; error?: string };

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
    try {
    const worker = this.factory();
    this.worker = worker;
    this.publish({ status: "loading", phase: "starting" });
    const finish = (state: CleanState) => {
      if (generation !== this.generation || this.worker !== worker) return;
      worker.terminate();
      this.worker = undefined;
      clearTimeout(this.timeout);
      this.publish(state);
    };
    worker.onmessage = ({ data }) => {
      if (data.ready) {
        if (generation !== this.generation || this.worker !== worker) return;
        clearTimeout(this.timeout);
        this.publish({ status: "loading", phase: "cleaning" });
        this.timeout = setTimeout(() => finish({ status: "error", error: "Processing exceeded 20 seconds and was stopped. Try a smaller image." }), 20000);
        return;
      }
      finish(data.result ? { status: "ready", result: data.result } : { status: "error", error: data.error ?? "Clean copy failed." });
    };
    worker.onerror = () => finish({ status: "error", error: "Clean copy failed while processing the image." });
    this.timeout = setTimeout(() => finish({ status: "error", error: "The clean-copy processor took too long to load. Reload the page and try again." }), 60000);
    worker.postMessage({ file, options });
    } catch (error) {
      this.worker?.terminate();
      this.worker = undefined;
      clearTimeout(this.timeout);
      this.publish({ status: "error", error: error instanceof Error ? error.message : "Clean copy could not start." });
    }
  }
}
