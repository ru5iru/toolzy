/// <reference lib="webworker" />
// Signer worker: runs one sign or verify job for large files, off the main thread.
import { runSignerJob, type SignerJob } from "@/components/document-signer/signerJobs";

self.onmessage = async (event: MessageEvent<SignerJob>) => {
  try {
    (self as unknown as Worker).postMessage({ ok: true, value: await runSignerJob(event.data) });
  } catch (error) {
    (self as unknown as Worker).postMessage({ ok: false, error: error instanceof Error ? error.message : "The operation failed." });
  }
};
