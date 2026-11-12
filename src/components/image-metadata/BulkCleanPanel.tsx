import { useEffect, useRef, useState } from "react";
import { Download, Eraser, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { zipSync, type Zippable } from "fflate";
import { Button } from "@/components/ui/button";
import { BLOCK_KINDS } from "./cleanUtils";
import { CleanSession, type CleanState } from "./cleanSession";
import ImageCleanWorker from "@/workers/imageCleanWorker?worker";

interface BulkFile {
  id: string;
  file: File;
  state: CleanState;
  outputBytes?: Uint8Array;
  outputName?: string;
  outputMime?: string;
}

interface Props {
  files: File[];
  onClose: () => void;
}

const statusIcon = (state: CleanState) => {
  if (state.status === "loading") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (state.status === "ready" && state.result?.report.verified) return <ShieldCheck className="h-3.5 w-3.5 text-success" />;
  if (state.status === "ready" && !state.result?.report.verified) return <ShieldAlert className="h-3.5 w-3.5 text-destructive" />;
  if (state.status === "error") return <ShieldAlert className="h-3.5 w-3.5 text-destructive" />;
  return <span className="h-3.5 w-3.5 rounded-full border border-border inline-block" />;
};

const statusLabel = (state: CleanState) => {
  if (state.status === "idle") return "Waiting";
  if (state.status === "loading") return state.phase === "starting" ? "Starting…" : "Cleaning…";
  if (state.status === "error") return state.error ?? "Error";
  if (state.result?.report.verified) return "Verified";
  return "Verification failed";
};

/** Process files sequentially to avoid overloading with many workers at once. */
async function runAll(
  files: BulkFile[],
  onUpdate: (id: string, state: CleanState) => void,
  onOutput: (id: string, bytes: Uint8Array, name: string, mime: string) => void,
): Promise<void> {
  for (const item of files) {
    await new Promise<void>((resolve) => {
      const session = new CleanSession(() => new ImageCleanWorker() as never, (s: CleanState) => {
        onUpdate(item.id, s);
        if (s.status === "ready" || s.status === "error") {
          if (s.status === "ready" && s.result?.report.verified) {
            onOutput(item.id, s.result.output, s.result.filename, s.result.mime);
          }
          resolve();
        }
      });
      session.run(item.file, { mode: "all", remove: BLOCK_KINDS, keepOrientation: true });
    });
  }
}

export const BulkCleanPanel = ({ files, onClose }: Props) => {
  const [items, setItems] = useState<BulkFile[]>(() =>
    files.map((f, i) => ({ id: `${i}-${f.name}`, file: f, state: { status: "idle" } }))
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const cancelled = useRef(false);

  const updateState = (id: string, state: CleanState) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, state } : it)));
  const setOutput = (id: string, outputBytes: Uint8Array, outputName: string, outputMime: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, outputBytes, outputName, outputMime } : it)));

  const run = async () => {
    if (running) return;
    cancelled.current = false;
    setRunning(true);
    setDone(false);
    // Reset state to idle/no-output
    const fresh = items.map((it) => ({ ...it, state: { status: "idle" } as CleanState, outputBytes: undefined, outputName: undefined, outputMime: undefined }));
    setItems(fresh);
    try {
      await runAll(fresh, updateState, setOutput);
      setDone(true);
      toast.success("Bulk clean complete");
    } catch {
      toast.error("Bulk clean stopped");
    } finally {
      setRunning(false);
    }
  };

  const downloadAll = () => {
    const zippable: Zippable = {};
    for (const it of items) {
      if (it.outputBytes && it.outputName) {
        zippable[it.outputName] = it.outputBytes;
      }
    }
    if (!Object.keys(zippable).length) return;
    const zipped = zipSync(zippable, { level: 0 }); // store-only; images are already compressed
    const blob = new Blob([zipped], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cleaned-images.zip"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadOne = (it: BulkFile) => {
    if (!it.outputBytes || !it.outputName || !it.outputMime) return;
    const url = URL.createObjectURL(new Blob([it.outputBytes], { type: it.outputMime }));
    const a = document.createElement("a");
    a.href = url; a.download = it.outputName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const readyCount = items.filter((it) => it.outputBytes).length;

  return (
    <section aria-labelledby="bulk-heading" className="border border-border rounded-lg p-4 mb-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="bulk-heading" className="font-mono font-semibold text-sm flex items-center gap-2">
          <Eraser className="h-4 w-4" />Bulk metadata strip · {items.length} file{items.length !== 1 ? "s" : ""}
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}><X />Close</Button>
      </div>
      <p className="text-xs text-muted-foreground">All supported metadata is removed from each file losslessly. Original files are not changed.</p>

      <ul className="border border-border rounded-lg divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 px-3 py-2 min-w-0">
            {statusIcon(it.state)}
            <span className="flex-1 text-sm font-mono truncate min-w-0" title={it.file.name}>{it.file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{(it.file.size / 1024).toFixed(0)} KiB</span>
            <span className={`text-xs shrink-0 ${it.state.status === "error" || (it.state.status === "ready" && !it.state.result?.report.verified) ? "text-destructive" : it.outputBytes ? "text-success" : "text-muted-foreground"}`}>
              {statusLabel(it.state)}
            </span>
            {it.outputBytes && (
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Download cleaned ${it.file.name}`} onClick={() => downloadOne(it)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {!done && (
          <Button size="sm" onClick={run} disabled={running}>
            {running ? <Loader2 className="animate-spin" /> : <Eraser />}
            {running ? "Stripping metadata…" : "Strip all metadata"}
          </Button>
        )}
        {readyCount > 1 && (
          <Button size="sm" variant="outline" onClick={downloadAll}>
            <Download />Download all ({readyCount}) as ZIP
          </Button>
        )}
        {done && readyCount === 0 && (
          <Button size="sm" variant="outline" onClick={run}><Eraser />Retry</Button>
        )}
      </div>
    </section>
  );
};
