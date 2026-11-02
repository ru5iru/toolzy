import { validateSize, type Inspection } from "./metadataUtils";

export interface WorkerPort {
  onmessage: ((event: MessageEvent<{ result?: Inspection; error?: string; ready?: boolean }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(file: File): void;
  terminate(): void;
}
export type InspectionState = { status: "idle" | "loading" | "ready" | "error"; phase?: "starting" | "inspecting"; result?: Inspection; error?: string };
export class InspectionSession {
  private generation = 0;
  private worker?: WorkerPort;
  private timeout?: ReturnType<typeof setTimeout>;
  constructor(private factory: () => WorkerPort, private publish: (state: InspectionState) => void) {}
  clear() {
    this.generation++;
    this.worker?.terminate();
    this.worker = undefined;
    clearTimeout(this.timeout);
    this.publish({ status: "idle" });
  }
  select(file: File) {
    this.clear();
    const generation = this.generation;
    try {
      validateSize(file.size);
      const worker = this.factory();
      this.worker = worker;
      this.publish({ status: "loading", phase: "starting" });
      const finish = (state: InspectionState) => {
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
          this.publish({ status: "loading", phase: "inspecting" });
          this.timeout = setTimeout(() => finish({ status: "error", error: "Processing exceeded 20 seconds and was stopped. Try a smaller image." }), 20000);
          return;
        }
        finish(data.result ? { status: "ready", result: data.result } : { status: "error", error: data.error ?? "Metadata parsing failed." });
      };
      worker.onerror = () => finish({ status: "error", error: "Image processing failed. Try a smaller or undamaged image." });
      this.timeout = setTimeout(() => finish({ status: "error", error: "The image processor took too long to load. Reload the page and try again." }), 60000);
      worker.postMessage(file);
    } catch (error) {
      this.worker?.terminate();
      this.worker = undefined;
      clearTimeout(this.timeout);
      this.publish({ status: "error", error: error instanceof Error ? error.message : "Image processing could not start." });
    }
  }
}
export function localObjectUrl(blob: Blob, urls = URL) {
  const url = urls.createObjectURL(blob);
  let released = false;
  return { url, release() { if (!released) { urls.revokeObjectURL(url); released = true; } } };
}