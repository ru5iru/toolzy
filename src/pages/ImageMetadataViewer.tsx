import { useEffect, useRef, useState } from "react";
import { Download, Eraser, FileSearch, ImagePlus, Loader2, MapPin, RotateCcw, Search, X } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { toast } from "sonner";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { ToolSEO } from "@/components/ToolSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, csvExport, gpsCoordinates, jsonExport, type Category } from "@/components/image-metadata/metadataUtils";
import { InspectionSession, localObjectUrl, type InspectionState } from "@/components/image-metadata/inspectionSession";
import { CleanCopyPanel } from "@/components/image-metadata/CleanCopyPanel";
import { searchMetadata } from "@/components/image-metadata/searchUtils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import ImageMetadataWorker from "@/workers/imageMetadataWorker?worker";

const ImageMetadataViewer = () => {
  const [file, setFile] = useState<File>();
  const [state, setState] = useState<InspectionState>({ status: "idle" });
  const [preview, setPreview] = useState<{ url: string; failed: boolean; dimensions?: string }>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [dragging, setDragging] = useState(false);
  const [cleaning, setCleaning] = useState(false);
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
    setCleaning(false);
    setQuery("");
    setCategory("All");
    setPreview(undefined);
    session.current?.select(selected);
  };
  const reset = () => {
    session.current?.clear();
    setFile(undefined);
    setCleaning(false);
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
  const search = searchMetadata(result?.rows ?? [], debouncedQuery, category);
  const rows = search.rows;
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
    <ToolPageLayout title="Image Metadata Viewer" icon={FileSearch} description="Inspect EXIF, GPS and other metadata, and remove it from JPEG and PNG files.">
      <ToolSEO
        title="Image Metadata Viewer — EXIF, GPS & Privacy Inspector"
        description="Inspect EXIF, GPS coordinates, camera details, timestamps, IPTC and XMP tags from JPEG, PNG and TIFF images privately in your browser. Export JSON or CSV. Remove metadata from JPEG and PNG."
        canonicalPath="/image-metadata"
        keywords={["image metadata viewer", "EXIF viewer online", "GPS metadata extractor", "IPTC viewer", "XMP viewer", "remove EXIF data", "image privacy tool", "photo metadata"]}
        faq={[
          { question: "Are my images uploaded?", answer: "No. Image contents and extracted metadata are processed locally in your browser using exifr and are not transmitted for processing. The website still loads its own static assets." },
          { question: "Which image formats are supported?", answer: "JPEG, PNG, and classic TIFF are inspected by their file signatures. Detected tags vary by file. TIFF previews are not available. WebP, HEIC, HEIF, RAW, and BigTIFF are not supported in this tool." },
          { question: "Can this tool remove metadata from images?", answer: "Yes, for JPEG and PNG. 'Create clean copy' drops whole metadata blocks (EXIF, XMP, IPTC, comments, PNG text chunks, and other ancillary data) without re-encoding, preserves colour profiles, transparency, and animation, then re-checks the result before allowing download. TIFF removal is not supported." },
          { question: "Does finding no metadata mean my image is fully anonymous?", answer: "No. Parser coverage is limited, and the image content itself can reveal identifying information. The privacy summary lists only detected fields — it is not a comprehensive privacy score." },
          { question: "Can I export the metadata?", answer: "Yes. Use the JSON or CSV export buttons to download all extracted tags. CSV output uses dot-path keys and formula-safe quoting for safe import into spreadsheets." },
        ]}
        howToSteps={[
          "Drop an image onto the page or click 'Choose image' to select a JPEG, PNG, or TIFF file",
          "Browse detected EXIF, GPS, camera, date, IPTC, and XMP tags by category or search",
          "Click any value to copy it, or export all tags as JSON or CSV",
          "To remove metadata, switch to the Privacy tab and download a clean copy",
        ]}
      />
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
      {state.status === "loading" && <div className="flex flex-wrap items-center gap-3 py-4"><p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{state.phase === "starting" ? "Starting local image processor…" : "Inspecting image locally…"}</p><Button size="sm" variant="outline" onClick={() => session.current?.clear()}><X />Cancel inspection</Button></div>}
      {state.status === "idle" && file && <div className="flex flex-wrap items-center gap-3 py-3"><p role="status" className="text-sm text-muted-foreground">Inspection cancelled.</p><Button size="sm" variant="outline" onClick={() => session.current?.select(file)}><RotateCcw />Inspect again</Button></div>}
      {state.status === "error" && <div className="py-3 space-y-2"><p role="alert" className="text-sm text-destructive break-words">{state.error}</p>{file && <Button size="sm" variant="outline" onClick={() => session.current?.select(file)}><RotateCcw />Retry inspection</Button>}</div>}
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
            <h2 id="privacy-heading" className="font-mono font-semibold text-sm mb-3">Privacy summary · {result.findings.length} detected {result.findings.length === 1 ? "category" : "categories"}</h2>
            {!result.findings.length && <p className="text-sm text-muted-foreground">No sensitive fields detected by this parser. This is not a guarantee of anonymity.</p>}
            <ul className="space-y-3">
              {result.findings.map(finding => <li key={finding.title} className="border-l-2 border-primary pl-3"><h3 className="text-sm font-medium">{finding.title}</h3><p className="text-xs text-muted-foreground mt-1">{finding.reason}</p><p className="text-xs font-mono text-muted-foreground break-all mt-1">{finding.tags.join(", ")}</p></li>)}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">{result.thumbnailStatus}</p>
            <div className="flex flex-wrap gap-2 mt-3">{file && !cleaning && <Button size="sm" onClick={() => setCleaning(true)} disabled={!!result.removal?.error} title={result.removal?.error}><Eraser />Create clean copy</Button>}
            {coords && <Button variant="outline" size="sm" className="max-w-full" onClick={() => copy(coords)} aria-label="Copy GPS coordinates"><MapPin />Copy coordinates</Button>}</div>
            {result.removal?.error && <p className="text-xs text-muted-foreground mt-2">{result.removal.error}</p>}
          </section>
        </div>
        {cleaning && file && <CleanCopyPanel key={file.name + file.lastModified + file.size} file={file} inspection={result} originalPreviewUrl={preview && !preview.failed ? preview.url : undefined} onClose={() => setCleaning(false)} />}
        {result.metadataCount === 0 && <p role="status" className="text-sm text-muted-foreground mb-4">No embedded metadata detected in supported blocks. Basic file and image information is shown; unsupported tags are not verified.</p>}
        <section aria-labelledby="metadata-heading" className="min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 id="metadata-heading" className="font-mono text-sm font-semibold flex items-center gap-2"><FileSearch className="h-4 w-4" />Extracted metadata</h2>
            <div className="flex gap-2 flex-wrap"><Button size="sm" variant="outline" onClick={() => download("json")}><Download />JSON</Button><Button size="sm" variant="outline" onClick={() => download("csv")}><Download />CSV</Button></div>
          </div>
          <label className="relative block mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input className="pl-9 pr-10" aria-label="Search metadata" placeholder="Search labels, tags, and values…" value={query} onChange={e => setQuery(e.target.value)} />{query && <Button size="icon" variant="ghost" className="absolute right-1 top-1 h-8 w-8" aria-label="Clear metadata search" onClick={() => setQuery("")}><X /></Button>}</label>
          <Tabs value={category} onValueChange={value => setCategory(value as Category | "All")}>
            <TabsList className="flex flex-wrap justify-start h-auto gap-1 mb-3">
              <TabsTrigger value="All" aria-controls="metadata-results">All ({search.total})</TabsTrigger>
              {CATEGORIES.map(value => <TabsTrigger key={value} value={value} aria-controls="metadata-results">{value} ({search.counts[value]})</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <p role="status" className="text-xs text-muted-foreground mb-2">{rows.length} of {result.rows.length} fields{debouncedQuery.trim() ? " matching search" : ""}</p>
          <div id="metadata-results" role="tabpanel" aria-label={`${category} metadata`} tabIndex={0} className="border border-border rounded-lg overflow-hidden">
            {rows.length ? rows.map(row => <div key={row.tag} className="grid grid-cols-[minmax(0,1fr)_36px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_36px] gap-3 p-3 border-b border-border last:border-b-0 items-start">
              <div className="min-w-0 col-start-1 row-start-1"><div className="text-sm font-medium break-words">{row.label}</div><div className="text-xs text-muted-foreground font-mono break-all mt-1">{row.tag}</div></div>
              <div className="text-sm font-mono whitespace-pre-wrap break-all min-w-0 col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">{row.value}</div>
              <CopyButton value={row.value} message="Copied to clipboard" ariaLabel={`Copy ${row.label}`} variant="ghost" size="icon" className="h-8 w-8 col-start-2 row-start-1 sm:col-start-3" />
            </div>) : <p className="p-4 text-sm text-muted-foreground">{query ? "No matching fields in this category." : "No fields detected in this category."}</p>}
          </div>
        </section>
      </>}
    </ToolPageLayout>
  );
};
export default ImageMetadataViewer;