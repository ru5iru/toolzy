// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { generateKeyRecord } from "./keyUtils";
import { runSignerJob, type SignerJob } from "./signerJobs";
import { SignerSession, WORKER_THRESHOLD_BYTES, type SignerWorkerPort } from "./signerSession";

class FakeWorker implements SignerWorkerPort {
  onmessage: SignerWorkerPort["onmessage"] = null;
  onerror: SignerWorkerPort["onerror"] = null;
  terminated = false;
  received?: SignerJob;
  transfer?: Transferable[];
  postMessage(job: SignerJob, transfer?: Transferable[]) { this.received = job; this.transfer = transfer; }
  terminate() { this.terminated = true; }
  reply(data: Parameters<NonNullable<SignerWorkerPort["onmessage"]>>[0]["data"]) { this.onmessage?.({ data } as never); }
}

const smallJob = async (): Promise<SignerJob> => ({
  op: "sign",
  input: { data: new TextEncoder().encode("hello"), filename: "a.txt", key: await generateKeyRecord("ECDSA-P256"), hash: "SHA-256" },
});
const largeJob = async (): Promise<SignerJob> => {
  const job = await smallJob();
  if (job.op === "sign") job.input.data = new Uint8Array(WORKER_THRESHOLD_BYTES);
  return job;
};

describe("SignerSession", () => {
  it("runs small jobs inline without creating a worker", async () => {
    const factory = vi.fn();
    const out = await new SignerSession(factory).run(await smallJob());
    expect(out.op).toBe("sign");
    expect(factory).not.toHaveBeenCalled();
  });

  it("hands large jobs to a worker, transferring the buffer, and terminates it afterwards", async () => {
    const worker = new FakeWorker();
    const session = new SignerSession(() => worker);
    const job = await largeJob();
    const pending = session.run(job);
    const expected = await runSignerJob(await smallJob());
    expect(worker.received).toBe(job);
    expect(worker.transfer).toHaveLength(1);
    worker.reply({ ok: true, value: expected });
    await expect(pending).resolves.toBe(expected);
    expect(worker.terminated).toBe(true);
  });

  it("surfaces worker errors and crashes as readable messages", async () => {
    const failing = new FakeWorker();
    const pending = new SignerSession(() => failing).run(await largeJob());
    failing.reply({ ok: false, error: "Bad key." });
    await expect(pending).rejects.toThrow("Bad key.");

    const crashing = new FakeWorker();
    const pending2 = new SignerSession(() => crashing).run(await largeJob());
    crashing.onerror?.({} as ErrorEvent);
    await expect(pending2).rejects.toThrow("Processing failed");
    expect(crashing.terminated).toBe(true);
  });

  it("cancels a running job: terminates the worker, rejects, and ignores a late reply", async () => {
    const worker = new FakeWorker();
    const session = new SignerSession(() => worker);
    const pending = session.run(await largeJob());
    session.cancel();
    await expect(pending).rejects.toThrow("Cancelled");
    expect(worker.terminated).toBe(true);
    worker.reply({ ok: true, value: await runSignerJob(await smallJob()) }); // must not throw or resolve anything
  });

  it("a new job supersedes the previous one", async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    const workers = [first, second];
    const session = new SignerSession(() => workers.shift()!);
    const p1 = session.run(await largeJob());
    const p2 = session.run(await largeJob());
    await expect(p1).rejects.toThrow("Cancelled");
    expect(first.terminated).toBe(true);
    second.reply({ ok: true, value: await runSignerJob(await smallJob()) });
    await expect(p2).resolves.toMatchObject({ op: "sign" });
  });
});
