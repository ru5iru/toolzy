import { useEffect, useRef, useState } from "react";
import { Copy, Download, FileSearch, ImagePlus, Loader2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { ToolSEO } from "@/components/ToolSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, csvExport, gpsCoordinates, jsonExport, type Category } from "@/components/image-metadata/metadataUtils";
import { InspectionSession, localObjectUrl, type InspectionState } from "@/components/image-metadata/inspectionSession";
import ImageMetadataWorker from "@/workers/imageMetadataWorker?worker";

const ImageMetadataViewer = () => {
  const [file, setFile] = useState<File>();
  const [state, setState] = useState<InspectionState>({ status: "idle" });
  const [preview, setPreview] = useState<{ url: string; failed: boolean; dimensions?: string }>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Overview");
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const session = useRef<InspectionSession>();
  useEffect(() => {
    const active = new InspectionSession(() => new ImageMetadataWorker(), setState);
    session.current = active;
    return () => { active.clear(); session.current = undefined; };
  }, []);
  useEffect(() => {
    setPreview(undefined);
    if (!file) return;
    // TIFF inspection is supported independently of native browser preview decoding.
    if (state.status !== "ready" || !state.result || state.result.format === "TIFF") return;
    const resource = localObjectUrl(new Blob([file], { type: state.result.mime }));
    setPreview({ url: resource.url, failed: false });
    return resource.release;
  }, [file, state.status, state.result]);
  const select = (selected: File) => {
    setFile(selected);
    setQuery("");
    setCategory("Overview");
    setPreview(undefined);
    session.current?.select(selected);
  };
  const reset = () => {
    session.current?.clear();
    setFile(undefined);
    setPreview(undefined);
    setQuery("");
    if (picker.current) picker.current.value = "";
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard"); }
    catch { toast.error("Clipboard access failed. Select and copy the value manually."); }
  };
  const result = state.result;
  const coords = result ? gpsCoordinates(result.rows) : undefined;
  const rows = result?.rows.filter(row => row.category === category && `${row.label} ${row.tag} ${row.value}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  const download = (kind: "json" | "csv") => {
    if (!result) return;
    const resource = localObjectUrl(new Blob([kind === "json" ? jsonExport(result) : csvExport(result.rows)], { type: kind === "json" ? "application/json" : "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = resource.url;
    anchor.download = `image-metadata.${kind}`;
    anchor.click();
    // Give the browser time to begin the download before releasing its URL.
    setTimeout(resource.release, 1000);
  };
  return (
    <ToolPageLayout title="Image Metadata Viewer">
      <ToolSEO title="Image Metadata Viewer" canonicalPath="/image-metadata" description="Inspect EXIF, GPS, camera details, timestamps, and other image metadata privately in your browser." keywords={["image metadata viewer", "EXIF viewer", "GPS metadata", "IPTC", "XMP"]} faq={[
        { question: "Are my images uploaded?", answer: "No. Image contents and extracted metadata are processed locally in your browser and are not transmitted for processing. The website still loads its own static assets." },
        { question: "Which image formats are supported?", answer: "JPEG, PNG, and classic TIFF are inspected by their file signatures. Detected tags vary by file. TIFF previews are not available. WebP, HEIC, HEIF, RAW, and BigTIFF are not supported in this tool." },
        { question: "Can this tool remove metadata?", answer: "Not in this version. Clean-copy generation is deferred to avoid misleading removal claims or losing animation, orientation, transparency, or color profiles." },
        { question: "Does no detected metadata mean my image is anonymous?", answer: "No. Parser coverage is limited, and the image itself can reveal identifying information. The privacy summary lists only detected fields, not a privacy score." },
      ]} />
      <p className="text-xs text-muted-foreground mb-4">Image contents and extracted metadata stay in your browser. Nothing is uploaded for processing or saved persistently.</p>
      <input ref={picker} type="file" className="sr-only" tabIndex={-1} aria-label="Select image file" accept=".jpg,.jpeg,.png,.tif,.tiff,image/jpeg,image/png,image/tiff" onChange={e => { const selected = e.target.files?.[0]; if (selected) select(selected); e.target.value = ""; }} />
      <div className={`border border-dashed rounded-lg p-6 mb-4 text-center ${dragging ? "border-primary bg-secondary" : "border-border"}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const files = e.dataTransfer.files; if (files.length !== 1) { toast.error("Select one image at a time."); return; } const selected = files[0]; if (selected) select(selected); }}>
        <ImagePlus className="h-7 w-7 text-primary mx-auto mb-3" aria-hidden="true" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => picker.current?.click()}><ImagePlus />{file ? "Change image" : "Select image"}</Button>
          {file && <Button size="sm" variant="outline" onClick={reset}><X />Clear</Button>}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Drop one JPEG, PNG, or TIFF here · Maximum 25 MiB</p>
      </div>
      {state.status === "loading" && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" />Inspecting image locally…</div>}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive break-words py-3">{state.error}</p>}
      {result && <>
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-5 mb-5">
          <section aria-label="Image preview" className="min-w-0">
            <div className="aspect-square bg-secondary rounded-lg overflow-hidden flex items-center justify-center">
              {preview && !preview.failed ? <img src={preview.url} alt={`Preview of ${file?.name ?? "selected image"}`} className="w-full h-full object-contain" onLoad={e => { const image = e.currentTarget; setPreview(previous => previous?.url === image.src ? { ...previous, dimensions: `${image.naturalWidth} × ${image.naturalHeight} px` } : previous); }} onError={e => { const url = e.currentTarget.src; setPreview(previous => previous?.url === url ? { ...previous, failed: true } : previous); }} /> : <p className="text-xs text-muted-foreground p-4 text-center">{result.format === "TIFF" ? "TIFF preview is unavailable in this browser tool. Extracted metadata is shown." : preview?.failed ? "Image preview failed; the image may be corrupted or use an unsupported encoding. Parsed metadata is still shown." : "Preparing preview…"}</p>}
            </div>
            <p className="text-sm font-mono break-all mt-2">{file?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{result.format} · {file ? (file.size / 1024).toFixed(1) : "0"} KiB</p>
            <p className="text-xs text-muted-foreground mt-1">{preview?.dimensions ?? "Dimensions: see extracted width/height tags when available"}</p>
          </section>
          <section aria-labelledby="privacy-heading" className="min-w-0">
            <h2 id="privacy-heading" className="font-mono font-semibold text-sm mb-3">Privacy summary</h2>
            {!result.findings.length && <p className="text-sm text-muted-foreground">No sensitive fields detected by this parser. This is not a guarantee of anonymity.</p>}
            <ul className="space-y-3">
              {result.findings.map(finding => <li key={finding.title} className="border-l-2 border-primary pl-3"><h3 className="text-sm font-medium">{finding.title}</h3><p className="text-xs text-muted-foreground mt-1">{finding.reason}</p><p className="text-xs font-mono text-muted-foreground break-all mt-1">{finding.tags.join(", ")}</p></li>)}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">{result.thumbnailStatus}</p>
            {coords && <Button variant="outline" size="sm" className="mt-3 max-w-full" onClick={() => copy(coords)} aria-label="Copy GPS coordinates"><MapPin />Copy coordinates</Button>}
          </section>
        </div>
        {result.metadataCount === 0 && <p role="status" className="text-sm text-muted-foreground mb-4">No embedded metadata detected in supported blocks. Basic file and image information is shown; unsupported tags are not verified.</p>}
        <section aria-labelledby="metadata-heading" className="min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 id="metadata-heading" className="font-mono text-sm font-semibold flex items-center gap-2"><FileSearch className="h-4 w-4" />Extracted metadata</h2>
            <div className="flex gap-2 flex-wrap"><Button size="sm" variant="outline" onClick={() => download("json")}><Download />JSON</Button><Button size="sm" variant="outline" onClick={() => download("csv")}><Download />CSV</Button></div>
          </div>
          <label className="relative block mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" aria-label="Search metadata in selected category" placeholder="Search labels, tags, and values…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <Tabs value={category} onValueChange={value => setCategory(value as Category)}>
            <TabsList className="flex flex-wrap justify-start h-auto gap-1 mb-3">
              {CATEGORIES.map(value => <TabsTrigger key={value} value={value}>{value} ({result.rows.filter(row => row.category === value).length})</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div role="region" aria-label={`${category} metadata`} className="border border-border rounded-lg overflow-hidden">
            {rows.length ? rows.map(row => <div key={row.tag} className="grid grid-cols-[minmax(0,1fr)_36px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_36px] gap-3 p-3 border-b border-border last:border-b-0 items-start">
              <div className="min-w-0"><div className="text-sm font-medium break-words">{row.label}</div><div className="text-xs text-muted-foreground font-mono break-all mt-1">{row.tag}</div></div>
              <div className="text-sm font-mono whitespace-pre-wrap break-all min-w-0 col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">{row.value}</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 col-start-2 row-start-1 sm:col-start-auto" title={`Copy ${row.label}`} aria-label={`Copy ${row.label}`} onClick={() => copy(row.value)}><Copy /></Button>
            </div>) : <p className="p-4 text-sm text-muted-foreground">{query ? "No matching fields in this category." : "No fields detected in this category."}</p>}
          </div>
        </section>
      </>}
    </ToolPageLayout>
  );
};
export default ImageMetadataViewer;