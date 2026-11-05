import { useMemo, useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { inspectManifest } from "./inspectorUtils";
import { MetaRow } from "./SignerControls";
import { toneClass } from "./statusStyles";
import type { VerifyResult } from "./verifyUtils";

export const InspectorTab = ({ verification }: { verification?: VerifyResult }) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();

  const inspected = useMemo(() => {
    if (!text.trim()) return undefined;
    try { return { ...inspectManifest(text, verification), error: undefined }; }
    catch (e) { return { rows: [], confirmed: false, manifest: undefined, error: e instanceof Error ? e.message : "The manifest could not be read." }; }
  }, [text, verification]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section aria-labelledby="inspect-input" className="space-y-3 min-w-0">
        <h2 id="inspect-input" className="font-mono text-sm font-semibold">Signature manifest</h2>
        <FileDropzone label="Manifest file" file={file} accept=".json,application/json" hint="Drop a .signature.json file, or paste it below"
          onFile={async (f) => { setFile(f); setText(await f.text()); }} onClear={() => { setFile(undefined); setText(""); }} />
        <div className="space-y-1.5">
          <Label htmlFor="inspect-text" className="text-xs text-muted-foreground">Or paste manifest JSON</Label>
          <Textarea id="inspect-text" value={text} spellCheck={false} onChange={(e) => { setText(e.target.value); setFile(undefined); }} placeholder='{ "version": 1, … }' className="min-h-[220px] font-mono text-xs resize-y bg-card" />
        </div>
      </section>
      <section aria-labelledby="inspect-result" className="space-y-3 min-w-0">
        <h2 id="inspect-result" className="font-mono text-sm font-semibold">Fields</h2>
        {!inspected && <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">Load a manifest to see its fields. Each one is marked <strong>self-declared</strong> (written by whoever made the file) or <strong>verified</strong> (confirmed by your last successful verification of the same signature).</p>}
        {inspected?.error && <p role="alert" className="text-sm text-destructive break-words">{inspected.error}</p>}
        {inspected && !inspected.error && (
          <>
            <p role="status" className={`text-xs rounded-lg border px-3 py-2 ${inspected.confirmed ? toneClass.success : toneClass.neutral}`}>
              {inspected.confirmed ? "Fields marked verified were confirmed by your most recent successful verification of this signature." : "Nothing here is verified yet. Run Verify with the document and public key to confirm the cryptographic fields."}
            </p>
            <div className="border border-border rounded-lg px-3">
              {inspected.rows.map((row) => (
                <MetaRow key={row.label} label={row.label} value={row.value}
                  badge={<span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-mono ${row.trust === "verified" ? toneClass.success : toneClass.neutral}`}>{row.trust}</span>} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
