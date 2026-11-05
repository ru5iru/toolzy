import { useRef, useState } from "react";
import { Download, Layers, Loader2, PenLine, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/formatBytes";
import { algorithmById, usesSigningHash, type HashName } from "./algorithms";
import { BatchCancelled, checkBatchSize, signBatch, verifyBatch, type BatchFile, type BatchSignItem, type BatchVerifyItem } from "./batchUtils";
import { downloadBytes, readFileBytes } from "./browserUtils";
import { importKeyText, type KeyRecord } from "./keyUtils";
import { HashSelect, KeySelect } from "./SignerControls";
import { toneClass } from "./statusStyles";

const PASTE = "__paste";
const STATUS_TONE: Record<BatchVerifyItem["status"], keyof typeof toneClass> = {
  valid: "success", invalid: "danger", modified: "danger", missing: "warning", error: "warning", orphan: "warning",
};

/** Keep the selected files in a list while enforcing the batch limits. */
function useFileList() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const add = (file: File) => setFiles((current) => {
    const next = [...current, file];
    try { checkBatchSize(next); setError(undefined); return next; }
    catch (e) { setError(e instanceof Error ? e.message : "Selection too large."); return current; }
  });
  const clear = () => { setFiles([]); setError(undefined); };
  return { files, error, add, clear, setError };
}

const Summary = ({ files }: { files: File[] }) => files.length === 0 ? null : (
  <p className="text-xs font-mono break-all">
    {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
    <span className="text-muted-foreground"> · {files.slice(0, 3).map((f) => f.name).join(", ")}{files.length > 3 ? ` +${files.length - 3} more` : ""}</span>
  </p>
);

const readAll = async (files: File[]): Promise<BatchFile[]> => Promise.all(files.map(async (f) => ({ name: f.name, data: await readFileBytes(f) })));

export const BatchTab = ({ keys }: { keys: KeyRecord[] }) => {
  const privateKeys = keys.filter((k) => k.pkcs8);
  const signList = useFileList();
  const [signKeyId, setSignKeyId] = useState("");
  const [signHash, setSignHash] = useState<HashName>("SHA-256");
  const [signBusy, setSignBusy] = useState(false);
  const [signProgress, setSignProgress] = useState<[number, number]>();
  const [signOut, setSignOut] = useState<{ zip?: Uint8Array; items: BatchSignItem[] }>();
  const signAbort = useRef<AbortController>();

  const verifyList = useFileList();
  const [verifyKeyId, setVerifyKeyId] = useState("");
  const [pasted, setPasted] = useState("");
  const [verifyHash, setVerifyHash] = useState<HashName>("SHA-256");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState<[number, number]>();
  const [verifyOut, setVerifyOut] = useState<BatchVerifyItem[]>();
  const [verifyError, setVerifyError] = useState<string>();
  const verifyAbort = useRef<AbortController>();

  const signKey = privateKeys.find((k) => k.id === signKeyId) ?? privateKeys[0];

  const runSign = async () => {
    if (!signKey || signList.files.length === 0) return;
    const abort = new AbortController(); signAbort.current = abort;
    setSignBusy(true); setSignOut(undefined); signList.setError(undefined);
    try {
      const out = await signBatch(await readAll(signList.files), signKey, signHash, { signal: abort.signal, onProgress: (d, t) => setSignProgress([d, t]) });
      setSignOut(out);
      const ok = out.items.filter((i) => i.ok).length;
      toast[ok ? "success" : "error"](`${ok} of ${out.items.length} signed`);
    } catch (e) {
      if (!(e instanceof BatchCancelled)) signList.setError(e instanceof Error ? e.message : "Batch signing failed.");
    } finally { setSignBusy(false); setSignProgress(undefined); }
  };

  const runVerify = async () => {
    setVerifyError(undefined); setVerifyOut(undefined);
    let key: KeyRecord | undefined = keys.find((k) => k.id === verifyKeyId);
    if (pasted.trim()) {
      try { key = await importKeyText(pasted); } catch (e) { setVerifyError(e instanceof Error ? e.message : "The public key could not be imported."); return; }
    }
    if (!key) { setVerifyError("Choose a public key from this session or paste one."); return; }
    const abort = new AbortController(); verifyAbort.current = abort;
    setVerifyBusy(true);
    try {
      const publicKey = { spki: key.spki, algorithm: key.algorithm, fingerprint: key.fingerprint };
      setVerifyOut(await verifyBatch(await readAll(verifyList.files), publicKey, verifyHash, { signal: abort.signal, onProgress: (d, t) => setVerifyProgress([d, t]) }));
    } catch (e) {
      if (!(e instanceof BatchCancelled)) setVerifyError(e instanceof Error ? e.message : "Batch verification failed.");
    } finally { setVerifyBusy(false); setVerifyProgress(undefined); }
  };

  const counts = verifyOut && verifyOut.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.status]: (acc[i.status] ?? 0) + 1 }), {});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section aria-labelledby="batch-sign" className="space-y-4 min-w-0">
        <h2 id="batch-sign" className="font-mono text-sm font-semibold">Sign several documents</h2>
        <FileDropzone multiple label="Documents to sign in batch" onFile={(f) => { setSignOut(undefined); signList.add(f); }} onClear={() => { signList.clear(); setSignOut(undefined); }}
          disabled={signBusy} hint="Up to 100 files · 25 MiB each · 250 MiB total" />
        <Summary files={signList.files} />
        {privateKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">Batch signing needs a private key. Generate or import one in the Keys tab.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px] gap-3">
            <KeySelect id="batch-sign-key" label="Private key" keys={privateKeys} value={signKey?.id ?? ""} onChange={(id) => { setSignKeyId(id); setSignOut(undefined); }} placeholder="Choose a key" />
            <HashSelect id="batch-sign-hash" value={signHash} label={signKey && !usesSigningHash(algorithmById(signKey.algorithm)) ? "Document hash (Ed25519)" : "Hash algorithm"} onChange={(h) => { setSignHash(h); setSignOut(undefined); }} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={runSign} disabled={signBusy || !signKey || signList.files.length === 0}>
            {signBusy ? <Loader2 className="animate-spin" /> : <PenLine />}{signBusy && signProgress ? `Signing ${signProgress[0]}/${signProgress[1]}…` : "Sign all"}
          </Button>
          {signBusy && <Button variant="outline" onClick={() => signAbort.current?.abort()}><X />Cancel</Button>}
        </div>
        {signList.error && <p role="alert" className="text-sm text-destructive break-words">{signList.error}</p>}
        {signOut && (
          <div role="status" className="space-y-3">
            <div className="border border-border rounded-lg divide-y divide-border text-xs font-mono max-h-64 overflow-auto">
              {signOut.items.map((item, i) => (
                <div key={`${item.name}-${i}`} className="px-3 py-2 flex flex-wrap items-center gap-2">
                  <span className="break-all flex-1 min-w-0">{item.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 ${item.ok ? toneClass.success : toneClass.warning}`}>{item.ok ? "Signed" : item.message}</span>
                </div>
              ))}
            </div>
            {signOut.zip && <Button size="sm" onClick={() => downloadBytes("signatures.zip", signOut.zip!, "application/zip")}><Download />Download signatures.zip</Button>}
            <p className="text-xs text-muted-foreground">The ZIP holds a <code className="font-mono">.sig</code> and a <code className="font-mono">.signature.json</code> for each document, not the documents themselves. Keep them next to the originals.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="batch-verify" className="space-y-4 min-w-0">
        <h2 id="batch-verify" className="font-mono text-sm font-semibold">Verify several documents</h2>
        <FileDropzone multiple label="Documents and signature files to verify in batch" onFile={(f) => { setVerifyOut(undefined); verifyList.add(f); }} onClear={() => { verifyList.clear(); setVerifyOut(undefined); }}
          disabled={verifyBusy} hint="Select documents together with their .sig / .signature.json files. They are paired by filename." />
        <Summary files={verifyList.files} />
        <div className="space-y-3">
          <KeySelect id="batch-verify-key" label="Public key" keys={keys} value={verifyKeyId} onChange={(id) => { setVerifyKeyId(id); setVerifyOut(undefined); }} placeholder="Choose a key from this session" />
          <div className="space-y-1.5">
            <Label htmlFor="batch-verify-paste" className="text-xs text-muted-foreground">Or paste a public key (PEM or JWK)</Label>
            <Textarea id="batch-verify-paste" value={pasted} spellCheck={false} placeholder="-----BEGIN PUBLIC KEY-----" className="min-h-[80px] font-mono text-xs resize-y bg-card" onChange={(e) => { setPasted(e.target.value); setVerifyOut(undefined); }} />
          </div>
          <HashSelect id="batch-verify-hash" label="Hash algorithm (used when there is no manifest)" value={verifyHash} onChange={(h) => { setVerifyHash(h); setVerifyOut(undefined); }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void runVerify()} disabled={verifyBusy || verifyList.files.length === 0}>
            {verifyBusy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{verifyBusy && verifyProgress ? `Verifying ${verifyProgress[0]}/${verifyProgress[1]}…` : "Verify all"}
          </Button>
          {verifyBusy && <Button variant="outline" onClick={() => verifyAbort.current?.abort()}><X />Cancel</Button>}
        </div>
        {(verifyList.error || verifyError) && <p role="alert" className="text-sm text-destructive break-words">{verifyList.error ?? verifyError}</p>}
        {verifyOut && counts && (
          <div role="status" className="space-y-3">
            <p className="text-sm"><Layers className="inline h-4 w-4 mr-1 text-primary" aria-hidden="true" />{verifyOut.length} result{verifyOut.length === 1 ? "" : "s"}: {Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}</p>
            <div className="border border-border rounded-lg divide-y divide-border text-xs font-mono max-h-80 overflow-auto">
              {verifyOut.map((item, i) => (
                <div key={`${item.name}-${i}`} className="px-3 py-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all flex-1 min-w-0">{item.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 ${toneClass[STATUS_TONE[item.status]]}`}>{item.status}</span>
                  </div>
                  <p className="text-muted-foreground break-words">{item.message} · uses {item.sources}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Valid means the document matches its signature for this key. It does not show who owns the key.</p>
          </div>
        )}
      </section>
    </div>
  );
};
