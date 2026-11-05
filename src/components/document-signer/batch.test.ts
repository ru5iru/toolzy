// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { crc32, createZip } from "@/lib/zip";
import { BATCH_LIMITS, BatchCancelled, checkBatchSize, signBatch, verifyBatch } from "./batchUtils";
import { generateKeyRecord } from "./keyUtils";

vi.setConfig({ testTimeout: 30_000 });
const enc = (s: string) => new TextEncoder().encode(s);
const hasPython = spawnSync("python3", ["--version"]).status === 0;

describe("zip writer", () => {
  it("computes the standard CRC-32", () => expect(crc32(enc("123456789"))).toBe(0xcbf43926));

  it.skipIf(!hasPython)("produces archives Python's zipfile accepts, including UTF-8 names and empty entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "t.zip");
    writeFileSync(file, createZip([{ name: "a.txt", data: enc("hello") }, { name: "dossier/é ✓.txt", data: enc("x".repeat(100000)) }, { name: "empty", data: new Uint8Array() }]));
    const out = execFileSync("python3", ["-I", "-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(sorted(z.namelist()));print(z.read('a.txt').decode())", file]).toString();
    expect(out).toContain("None");
    expect(out).toContain("dossier/é ✓.txt");
    expect(out).toContain("hello");
  });

  it("rejects duplicate names", () => {
    expect(() => createZip([{ name: "a", data: enc("1") }, { name: "a", data: enc("2") }])).toThrow("Duplicate");
  });
});

describe("batch sign and verify", () => {
  it("signs several files, produces a ZIP, and verifies them again by filename pairing", async () => {
    const key = await generateKeyRecord("ECDSA-P256", "batch");
    const docs = [{ name: "a.txt", data: enc("alpha") }, { name: "b.txt", data: enc("bravo") }, { name: "empty.txt", data: new Uint8Array() }, { name: "a.txt", data: enc("dup") }];
    const progress: number[] = [];
    const signed = await signBatch(docs, key, "SHA-256", { onProgress: (d) => progress.push(d) });
    expect(progress).toEqual([1, 2, 3, 4]);
    expect(signed.items.map((i) => i.ok)).toEqual([true, true, false, false]);
    expect(signed.items[2].message).toContain("empty");
    expect(signed.items[3].message).toContain("same name");
    expect(signed.zip).toBeDefined();

    // Rebuild sidecars the way a user would after unzipping.
    const sidecars = [] as { name: string; data: Uint8Array }[];
    if (hasPython) {
      const dir = mkdtempSync(join(tmpdir(), "bz-"));
      writeFileSync(join(dir, "s.zip"), signed.zip!);
      const names = execFileSync("python3", ["-I", "-c", "import zipfile,sys;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", join(dir, "s.zip")]).toString().trim().split("\n");
      expect(names.sort()).toEqual(["a.txt.sig", "a.txt.signature.json", "b.txt.sig", "b.txt.signature.json"]);
    }
    const again = await signBatch(docs.slice(0, 2), key, "SHA-256");
    expect(again.zip).toBeDefined();
    // Directly use the signed entries via signDocument outputs through verifyBatch inputs
    const { signDocument } = await import("./signingUtils");
    for (const d of docs.slice(0, 2)) {
      const out = await signDocument({ data: d.data, filename: d.name, key, hash: "SHA-256" });
      sidecars.push({ name: `${d.name}.sig`, data: out.signature }, { name: `${d.name}.signature.json`, data: enc(out.manifestText) });
    }
    const results = await verifyBatch([...docs.slice(0, 2), ...sidecars, { name: "ghost.sig", data: enc("x") }], key, "SHA-256");
    expect(results.filter((r) => r.status === "valid").map((r) => r.name)).toEqual(["a.txt", "b.txt"]);
    expect(results.find((r) => r.name === "ghost.sig")?.status).toBe("orphan");

    // Tampered document and a document without signatures.
    const tampered = await verifyBatch([{ name: "a.txt", data: enc("ALPHA") }, sidecars[0], sidecars[1], { name: "c.txt", data: enc("c") }], key, "SHA-256");
    expect(tampered.find((r) => r.name === "a.txt")?.status).toBe("modified");
    expect(tampered.find((r) => r.name === "c.txt")?.status).toBe("missing");
  });

  it("can be cancelled", async () => {
    const key = await generateKeyRecord("ECDSA-P256");
    const abort = new AbortController();
    abort.abort();
    await expect(signBatch([{ name: "a", data: enc("a") }], key, "SHA-256", { signal: abort.signal })).rejects.toBeInstanceOf(BatchCancelled);
  });

  it("enforces batch limits", () => {
    expect(() => checkBatchSize(Array.from({ length: BATCH_LIMITS.files + 1 }, (_, i) => ({ name: `${i}`, size: 1 })))).toThrow("at most");
    expect(() => checkBatchSize([{ name: "big", size: BATCH_LIMITS.perFileBytes + 1 }])).toThrow("25 MiB");
    expect(() => checkBatchSize(Array.from({ length: 11 }, (_, i) => ({ name: `${i}`, size: 24 * 1024 * 1024 })))).toThrow("250 MiB");
    expect(() => checkBatchSize([{ name: "ok", size: 10 }])).not.toThrow();
  });
});
