import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectionSession, localObjectUrl, type WorkerPort } from "./inspectionSession";
import type { Inspection } from "./metadataUtils";
const result: Inspection = { format: "TIFF", mime: "image/tiff", rows: [], findings: [], metadataCount: 0, thumbnailStatus: "Not detected" };
const file = () => new File(["synthetic"], "test.tif");
function setup() {
  const workers: WorkerPort[] = [];
  const publish = vi.fn();
  const session = new InspectionSession(() => {
    const worker: WorkerPort = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() };
    workers.push(worker); return worker;
  }, publish);
  return { workers, publish, session };
}
describe("inspection lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  it("cancels previous file and prevents stale asynchronous results", () => {
    const { session, workers, publish } = setup(); session.select(file()); const stale = workers[0].onmessage;
    session.select(file()); expect(workers[0].terminate).toHaveBeenCalledOnce();
    stale?.({ data: { result } } as MessageEvent); expect(publish.mock.lastCall?.[0].status).toBe("loading");
    workers[1].onmessage?.({ data: { result } } as MessageEvent); expect(publish.mock.lastCall?.[0]).toEqual({ status: "ready", result });
    session.clear();
  });
  it("releases worker on reset and ignores late messages", () => {
    const { session, workers, publish } = setup(); session.select(file()); session.clear();
    workers[0].onmessage?.({ data: { result } } as MessageEvent);
    expect(workers[0].terminate).toHaveBeenCalledOnce(); expect(publish.mock.lastCall?.[0]).toEqual({ status: "idle" });
  });
  it("stops processing at the exact time limit", () => {
    vi.useFakeTimers(); const { session, workers, publish } = setup(); session.select(file());
    vi.advanceTimersByTime(19999); expect(publish.mock.lastCall?.[0].status).toBe("loading");
    vi.advanceTimersByTime(1); expect(workers[0].terminate).toHaveBeenCalledOnce(); expect(publish.mock.lastCall?.[0].status).toBe("error");
    session.clear();
  });
  it("reports parser errors and worker failures", () => {
    const { session, workers, publish } = setup(); session.select(file());
    workers[0].onmessage?.({ data: { error: "Unsupported" } } as MessageEvent);
    expect(publish.mock.lastCall?.[0]).toEqual({ status: "error", error: "Unsupported" });
    session.select(file()); workers[1].onerror?.({} as ErrorEvent); expect(publish.mock.lastCall?.[0].status).toBe("error"); session.clear();
  });
  it("rejects empty files before creating workers", () => {
    const { session, workers, publish } = setup(); session.select(new File([], "empty"));
    expect(workers).toHaveLength(0); expect(publish.mock.lastCall?.[0].status).toBe("error");
  });
  it("revokes each local object URL exactly once", () => {
    const urls = { createObjectURL: vi.fn(() => "blob:synthetic"), revokeObjectURL: vi.fn() };
    const resource = localObjectUrl(new Blob(["synthetic"]), urls as unknown as typeof URL);
    expect(resource.url).toBe("blob:synthetic"); resource.release(); resource.release();
    expect(urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:synthetic");
  });
});