import { afterEach, describe, expect, it, vi } from "vitest";
import { CleanSession, type CleanWorkerPort } from "./cleanSession";

const file = new File(["synthetic"], "test.png");
const options = { mode: "all" as const, remove: [], keepOrientation: true };
function setup() {
  const worker: CleanWorkerPort = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() };
  const publish = vi.fn();
  return { worker, publish, session: new CleanSession(() => worker, publish) };
}
describe("clean-copy deadlines and cancellation", () => {
  afterEach(() => vi.useRealTimers());
  it("does not count startup toward the 20-second processing deadline", () => {
    vi.useFakeTimers(); const { session, worker, publish } = setup(); session.run(file, options);
    expect(publish.mock.lastCall?.[0].phase).toBe("starting");
    vi.advanceTimersByTime(25000); expect(worker.terminate).not.toHaveBeenCalled();
    worker.onmessage?.({ data: { ready: true } } as MessageEvent);
    expect(publish.mock.lastCall?.[0].phase).toBe("cleaning");
    vi.advanceTimersByTime(19999); expect(worker.terminate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(worker.terminate).toHaveBeenCalledOnce();
    expect(publish.mock.lastCall?.[0].error).toMatch(/20 seconds/);
  });
  it("stops a worker that never loads at 60 seconds", () => {
    vi.useFakeTimers(); const { session, worker, publish } = setup(); session.run(file, options);
    vi.advanceTimersByTime(59999); expect(worker.terminate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(worker.terminate).toHaveBeenCalledOnce();
    expect(publish.mock.lastCall?.[0].error).toMatch(/too long to load/);
  });
  it("ignores readiness and errors arriving after cancellation", () => {
    vi.useFakeTimers(); const { session, worker, publish } = setup(); session.run(file, options); session.clear();
    worker.onmessage?.({ data: { ready: true } } as MessageEvent);
    worker.onmessage?.({ data: { error: "stale" } } as MessageEvent);
    vi.advanceTimersByTime(60000);
    expect(publish.mock.lastCall?.[0]).toEqual({ status: "idle" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("reports startup failure without throwing", () => {
    const publish = vi.fn(); const session = new CleanSession(() => { throw new Error("Unavailable"); }, publish);
    expect(() => session.run(file, options)).not.toThrow();
    expect(publish.mock.lastCall?.[0]).toEqual({ status: "error", error: "Unavailable" });
  });
  it("releases the worker when posting the file fails", () => {
    const { session, worker, publish } = setup();
    worker.postMessage = () => { throw new Error("Cannot read file"); };
    session.run(file, options);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(publish.mock.lastCall?.[0]).toEqual({ status: "error", error: "Cannot read file" });
  });
});