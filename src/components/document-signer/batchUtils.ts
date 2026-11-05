import { createZip, type ZipEntry } from "@/lib/zip";
import type { HashName } from "./algorithms";
import type { KeyRecord } from "./keyUtils";
import { manifestFileName, parseManifest, signatureFileName } from "./manifest";
import { signDocument, validateFileSize } from "./signingUtils";
import { verifyDocument, type VerifyStatus } from "./verifyUtils";

/** Batches run in the page (not the worker), so each file and the total stay modest. */
export const BATCH_LIMITS = { files: 100, perFileBytes: 25 * 1024 * 1024, totalBytes: 250 * 1024 * 1024 } as const;

export interface BatchFile { name: string; data: Uint8Array }

export interface BatchOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export type BatchSignItem = { name: string; ok: boolean; message: string };
export type BatchVerifyItem = { name: string; status: VerifyStatus | "orphan"; message: string; sources: string };

export class BatchCancelled extends Error {
  constructor() { super("Cancelled."); this.name = "BatchCancelled"; }
}

const SIG_SUFFIX = ".sig";
const MANIFEST_SUFFIX = ".signature.json";

/** Throws a user-readable error when a selection exceeds the batch limits. */
export function checkBatchSize(files: { name: string; size: number }[]): void {
  if (files.length > BATCH_LIMITS.files) throw new Error(`Select at most ${BATCH_LIMITS.files} files per batch.`);
  const big = files.find((f) => f.size > BATCH_LIMITS.perFileBytes);
  if (big) throw new Error(`"${big.name}" is larger than 25 MiB. Sign large files one at a time in the Sign tab.`);
  if (files.reduce((sum, f) => sum + f.size, 0) > BATCH_LIMITS.totalBytes) throw new Error("The selection is larger than 250 MiB in total. Split it into smaller batches.");
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const guard = (signal?: AbortSignal) => { if (signal?.aborted) throw new BatchCancelled(); };

/** Sign every file with one key. Output is a ZIP holding each `.sig` and `.signature.json`. */
export async function signBatch(files: BatchFile[], key: KeyRecord, hash: HashName, options: BatchOptions = {}): Promise<{ zip?: Uint8Array; items: BatchSignItem[] }> {
  const items: BatchSignItem[] = [];
  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  for (const [index, file] of files.entries()) {
    guard(options.signal);
    if (seen.has(file.name)) {
      items.push({ name: file.name, ok: false, message: "Skipped: another selected file has the same name." });
    } else {
      seen.add(file.name);
      try {
        validateFileSize(file.data.length);
        const out = await signDocument({ data: file.data, filename: file.name, key, hash });
        entries.push({ name: signatureFileName(file.name), data: out.signature }, { name: manifestFileName(file.name), data: new TextEncoder().encode(out.manifestText) });
        items.push({ name: file.name, ok: true, message: "Signed" });
      } catch (e) {
        items.push({ name: file.name, ok: false, message: e instanceof Error ? e.message : "Signing failed." });
      }
    }
    options.onProgress?.(index + 1, files.length);
    await tick();
  }
  guard(options.signal);
  return { zip: entries.length ? createZip(entries) : undefined, items };
}

/** Pair documents with `<name>.sig` and `<name>.signature.json` by filename and verify each against one public key. */
export async function verifyBatch(
  files: BatchFile[],
  key: Pick<KeyRecord, "spki" | "algorithm" | "fingerprint">,
  hash: HashName,
  options: BatchOptions = {},
): Promise<BatchVerifyItem[]> {
  const byName = new Map(files.map((f) => [f.name, f]));
  const baseOf = (name: string) => name.endsWith(MANIFEST_SUFFIX) ? name.slice(0, -MANIFEST_SUFFIX.length) : name.endsWith(SIG_SUFFIX) ? name.slice(0, -SIG_SUFFIX.length) : undefined;
  const documents = files.filter((f) => baseOf(f.name) === undefined);
  const items: BatchVerifyItem[] = [];
  const claimed = new Set<string>();
  for (const [index, doc] of documents.entries()) {
    guard(options.signal);
    const sigFile = byName.get(doc.name + SIG_SUFFIX);
    const manifestFile = byName.get(doc.name + MANIFEST_SUFFIX);
    if (sigFile) claimed.add(sigFile.name);
    if (manifestFile) claimed.add(manifestFile.name);
    const sources = [sigFile && ".sig", manifestFile && "manifest"].filter(Boolean).join(" + ") || "none";
    if (!sigFile && !manifestFile) {
      items.push({ name: doc.name, status: "missing", message: "No .sig or .signature.json with a matching name.", sources });
    } else {
      try {
        const manifest = manifestFile ? parseManifest(new TextDecoder().decode(manifestFile.data)) : undefined;
        const r = await verifyDocument({ data: doc.data, signature: sigFile?.data, manifest, key, hash });
        items.push({ name: doc.name, status: r.status, message: r.status === "valid" ? "Signature valid" : r.message, sources });
      } catch (e) {
        items.push({ name: doc.name, status: "error", message: e instanceof Error ? e.message : "Verification failed.", sources });
      }
    }
    options.onProgress?.(index + 1, documents.length);
    await tick();
  }
  // Signature files whose document is not in the selection.
  for (const f of files) {
    const base = baseOf(f.name);
    if (base !== undefined && !claimed.has(f.name)) {
      items.push({ name: f.name, status: "orphan", message: `No document named "${base}" was selected.`, sources: "-" });
    }
  }
  return items;
}
