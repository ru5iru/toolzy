import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Eraser, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BLOCK_KINDS, KIND_INFO, type BlockKind } from "./cleanUtils";
import { CleanSession, type CleanState } from "./cleanSession";
import { localObjectUrl } from "./inspectionSession";
import type { Inspection } from "./metadataUtils";
import ImageCleanWorker from "@/workers/imageCleanWorker?worker";

interface Props { file: File; inspection: Inspection; originalPreviewUrl?: string; onClose: () => void }
const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
const statusClass: Record<string, string> = { Removed: "text-success", Preserved: "text-foreground", Retained: "text-foreground", "Still present": "text-destructive", Lost: "text-destructive", "Not verified": "text-warning", "Not applicable": "text-muted-foreground" };

export const CleanCopyPanel = ({ file, inspection, originalPreviewUrl, onClose }: Props) => {
  const removal = inspection.removal;
  const present = removal?.kinds ?? [];
  const [mode, setMode] = useState<"all" | "selective">("all");
  const [selected, setSelected] = useState<BlockKind[]>(present);
  const [keepOrientation, setKeepOrientation] = useState(true);
  const [state, setState] = useState<CleanState>({ status: "idle" });
  const [cleanUrl, setCleanUrl] = useState<string>();
  const session = useRef<CleanSession>();
  useEffect(() => {
    const s = new CleanSession(() => new ImageCleanWorker(), setState);
    session.current = s;
    return () => s.clear();
  }, []);
  // Any change of file or options invalidates a previous result.
  useEffect(() => { session.current?.clear(); }, [file, mode, selected, keepOrientation]);
  useEffect(() => {
    setCleanUrl(undefined);
    if (state.status !== "ready" || !state.result) return;
    const r = localObjectUrl(new Blob([state.result.output], { type: state.result.mime }));
    setCleanUrl(r.url);
    return r.release;
  }, [state]);
  useEffect(() => {
    if (state.status === "ready") {
      if (state.result?.report.verified) toast.success("Clean copy created and verified");
      else toast.error("Verification failed; the copy is not presented as clean");
    }
    if (state.status === "error") toast.error(state.error ?? "Clean copy failed");
  }, [state]);

  const unsupported = removal?.error;
  const orientation = removal?.orientation;
  const exifRemoved = mode === "all" ? present.includes("exif") : selected.includes("exif");
  const canRun = !unsupported && (mode === "all" || selected.length > 0) && state.status !== "loading";
  const run = () => session.current?.run(file, { mode, remove: mode === "all" ? present : selected, keepOrientation });
  const download = () => {
    const r = state.result; if (!r?.report.verified) return;
    const resource = localObjectUrl(new Blob([r.output], { type: r.mime }));
    const a = document.createElement("a"); a.href = resource.url; a.download = r.filename; a.click();
    setTimeout(resource.release, 1000);
  };
  const r = state.result;
  return (
    <section aria-labelledby="clean-heading" className="border border-border rounded-lg p-4 mb-5 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 id="clean-heading" className="font-mono font-semibold text-sm flex items-center gap-2"><Eraser className="h-4 w-4" />Create clean copy</h2>
        <Button size="sm" variant="ghost" onClick={onClose}><ArrowLeft />Back to viewer</Button>
      </div>
      {unsupported ? <p role="alert" className="text-sm text-muted-foreground">{unsupported}</p> : <>
        <p className="text-xs text-muted-foreground mb-4">Lossless removal: whole metadata segments ({inspection.format === "PNG" ? "chunks" : "markers"}) are dropped and image data is copied byte-for-byte. No re-encoding, so quality, dimensions, transparency{inspection.format === "PNG" ? ", animation" : ""}, and embedded colour profiles are kept. Your original file is never changed.</p>
        <RadioGroup value={mode} onValueChange={v => setMode(v as "all" | "selective")} className="gap-2 mb-4" aria-label="Removal mode">
          <div className="flex items-start gap-2"><RadioGroupItem value="all" id="mode-all" className="mt-0.5" /><Label htmlFor="mode-all" className="font-normal leading-snug"><span className="font-medium">Remove all supported metadata</span><span className="block text-xs text-muted-foreground">Every removable block detected below.</span></Label></div>
          <div className="flex items-start gap-2"><RadioGroupItem value="selective" id="mode-sel" className="mt-0.5" disabled={!present.length} /><Label htmlFor="mode-sel" className="font-normal leading-snug"><span className="font-medium">Choose blocks to remove</span><span className="block text-xs text-muted-foreground">Unselected blocks are kept unchanged. Individual fields inside a block cannot be removed separately.</span></Label></div>
        </RadioGroup>
        <ul className="space-y-2 mb-4">
          {BLOCK_KINDS.map(kind => {
            const has = present.includes(kind);
            const checked = mode === "all" ? has : selected.includes(kind);
            return <li key={kind} className="flex items-start gap-2">
              <Checkbox id={`kind-${kind}`} className="mt-0.5" checked={checked} disabled={!has || mode === "all"} onCheckedChange={c => setSelected(s => c ? [...s, kind] : s.filter(k => k !== kind))} />
              <Label htmlFor={`kind-${kind}`} className={`font-normal leading-snug ${has ? "" : "text-muted-foreground"}`}><span className="font-medium">{KIND_INFO[kind].label}</span>{!has && " — not present"}<span className="block text-xs text-muted-foreground">{KIND_INFO[kind].description}</span></Label>
            </li>;
          })}
        </ul>
        {exifRemoved && orientation !== undefined && orientation > 1 && <div className="flex items-start gap-2 mb-4"><Checkbox id="keep-orientation" className="mt-0.5" checked={keepOrientation} onCheckedChange={c => setKeepOrientation(c === true)} /><Label htmlFor="keep-orientation" className="font-normal leading-snug"><span className="font-medium">Keep orientation tag</span><span className="block text-xs text-muted-foreground">This image relies on an EXIF rotation flag. Keeping it writes a new EXIF block containing only orientation, so the photo displays the right way up. Unchecking it may show the image rotated.</span></Label></div>}
        <p className="text-xs text-muted-foreground mb-3">Not removed: colour profiles and required image structures. Text visible inside the picture itself, and metadata in formats these parsers don't recognise, cannot be removed or verified.</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={run} disabled={!canRun}>{state.status === "loading" ? <Loader2 className="animate-spin" /> : <Eraser />}Generate clean copy</Button>{state.status === "loading" && <Button size="sm" variant="outline" onClick={() => session.current?.clear()}>Cancel clean copy</Button>}</div>
      </>}
      {state.status === "loading" && <p role="status" className="text-sm text-muted-foreground mt-3">{state.phase === "starting" ? "Starting local clean-copy processor…" : "Removing metadata and re-checking the result locally…"}</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive mt-3 break-words">{state.error}</p>}
      {r && <div className="mt-5 space-y-4">
        <div role="status" className={`flex items-start gap-2 text-sm ${r.report.verified ? "text-success" : "text-destructive"}`}>
          {r.report.verified ? <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" /> : <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />}
          <div>{r.report.verified ? "Verified: the selected metadata is no longer detected and the image data is byte-identical to the original." : "Verification failed. This copy is not presented as cleaned and cannot be downloaded."}
            {!r.report.verified && <ul className="list-disc pl-4 mt-1 text-xs">{r.report.issues.slice(0, 10).map(i => <li key={i}>{i}</li>)}</ul>}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([["Original", file.name, r.original, originalPreviewUrl], ["Cleaned", r.filename, r.cleaned, cleanUrl]] as const).map(([title, name, facts, url]) => <div key={title} className="min-w-0">
            <h3 className="text-sm font-medium mb-2">{title}</h3>
            <div className="aspect-video bg-secondary rounded-lg overflow-hidden flex items-center justify-center">{url ? <img src={url} alt={`${title} image preview`} className="w-full h-full object-contain" /> : <p className="text-xs text-muted-foreground">Preview unavailable</p>}</div>
            <dl className="text-xs text-muted-foreground mt-2 space-y-0.5 font-mono break-all">
              <div>{name}</div><div>{r.format} · {kib(facts.size)} · {facts.width} × {facts.height} px</div>
              <div>Colour profile: {facts.hasIcc ? "yes" : "no"}{r.format === "PNG" && <> · Alpha: {facts.hasAlpha ? "yes" : "no"} · Animated: {facts.animated ? "yes" : "no"}</>}</div>
            </dl>
          </div>)}
        </div>
        <p className="text-xs text-muted-foreground">The cleaned file is smaller only because metadata bytes were removed. Image data {r.report.imageDataIdentical ? "was compared and is byte-identical" : "differs from the original"}; dimensions {r.report.dimensionsMatch ? "match" : "differ"}.</p>
        <div>
          <h3 className="text-sm font-medium mb-2">Blocks</h3>
          <ul className="text-sm space-y-1">{r.report.blocks.map(b => <li key={b.kind} className="flex justify-between gap-2"><span>{b.label}</span><span className={statusClass[b.status]}>{b.status}</span></li>)}</ul>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Fields detected in the original ({r.report.fields.length})</h3>
          {r.report.fields.length ? <div className="border border-border rounded-lg max-h-72 overflow-auto">{r.report.fields.map(f => <div key={f.tag} className="flex justify-between gap-3 p-2 border-b border-border last:border-b-0 text-xs"><span className="font-mono break-all min-w-0">{f.tag}</span><span className={`shrink-0 ${statusClass[f.status]}`}>{f.status}</span></div>)}</div> : <p className="text-xs text-muted-foreground">No embedded fields were detected in the original.</p>}
        </div>
        <p className="text-xs text-muted-foreground">Verification re-parses the cleaned file with the same local parser and a structural scan of its {r.format === "PNG" ? "chunks" : "segments"}. It covers only fields and structures these checks recognise and is not a guarantee against forensic recovery or unknown proprietary metadata.</p>
        <Button size="sm" className="max-w-full" onClick={download} disabled={!r.report.verified} title={r.filename}><Download /><span className="truncate">Download {r.filename}</span></Button>
      </div>}
    </section>
  );
};
