import { runSignerJob, type SignerJob, type SignerJobResult } from "./signerJobs";

/** Files at or above this size run in a disposable worker, like Crypto Suite's hashing. */
export const WORKER_THRESHOLD_BYTES = 5 * 1024 * 1024;

export interface SignerWorkerPort {
  onmessage: ((event: MessageEvent<{ ok: boolean; value?: SignerJobResult; error?: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(job: SignerJob, transfer?: Transferable[]): void;
  terminate(): void;
}

/**
 * Runs sign and verify jobs. Small jobs run inline; large ones use a disposable worker that can be
 * cancelled. Only one job runs at a time: starting or cancelling terminates the previous one.
 */
export class SignerSession {
  private generation = 0;
  private worker?: SignerWorkerPort;
  private reject?: (reason: Error) => void;

  constructor(private factory: () => SignerWorkerPort) {}

  cancel() {
    this.generation++;
    this.worker?.terminate();
    this.worker = undefined;
    this.reject?.(new Error("Cancelled."));
    this.reject = undefined;
  }

  async run(job: SignerJob): Promise<SignerJobResult> {
    this.cancel();
    const size = job.input.data?.length ?? 0;
    if (size < WORKER_THRESHOLD_BYTES) return runSignerJob(job);

    const generation = this.generation;
    return new Promise<SignerJobResult>((resolve, reject) => {
      const worker = this.factory();
      this.worker = worker;
      this.reject = reject;
      const finish = (action: () => void) => {
        if (generation !== this.generation || this.worker !== worker) return;
        worker.terminate();
        this.worker = undefined;
        this.reject = undefined;
        action();
      };
      worker.onmessage = ({ data }) => finish(() => (data.ok && data.value ? resolve(data.value) : reject(new Error(data.error ?? "The operation failed."))));
      worker.onerror = () => finish(() => reject(new Error("Processing failed. Try a smaller file.")));
      // The caller reads the file afresh for each job, so its buffer can be handed over without a copy.
      worker.postMessage(job, job.input.data ? [job.input.data.buffer as ArrayBuffer] : []);
    });
  }
}
