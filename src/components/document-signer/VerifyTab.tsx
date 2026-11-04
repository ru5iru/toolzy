import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { algorithmById, type HashName } from "./algorithms";
import { readFileBytes } from "./browserUtils";
import { importKeyText, type KeyRecord } from "./keyUtils";
import { parseManifest, type Manifest } from "./manifest";
import type { SignerSession } from "./signerSession";
import { HashSelect, KeySelect, MetaRow } from "./SignerControls";
import { toneClass } from "./statusStyles";
import type { VerifyResult, VerifyStatus } from "./verifyUtils";

const PASTE = "__paste";

const STATUS: Record<VerifyStatus, { label: string; tone: keyof typeof toneClass }> = {
  valid: { label: "Valid", tone: "success" },
  invalid: { label: "Invalid", tone: "danger" },
  modified: { label: "Modified", tone: "danger" },
  missing: { label: "Missing input", tone: "warning" },
  error: { label: "Error", tone: "warning" },
};

interface VerifyTabProps {
  keys: KeyRecord[];
  session: SignerSession;
  onResult: (result: VerifyResult | undefined) => void;
}

export const VerifyTab = ({ keys, session, onResult }: VerifyTabProps) => {
  const [document, setDocument] = useState<File>();
  const [sigFile, setSigFile] = useState<File>();
  const [manifestFile, setManifestFile] = useState<File>();
  const [manifest, setManifest] = useState<Manifest>();
  const [manifestError, setManifestError] = useState<string>();
  const [keyChoice, setKeyChoice] = useState("");
  const [pasted, setPasted] = useState("");
  const [hash, setHash] = useState<HashName>("SHA-256");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult>();

  const reset = () => { setResult(undefined); onResult(undefined); };

  const pickManifest = async (selected: File) => {
    reset();
    setManifestFile(selected);
    try {
      const parsed = parseManifest(await selected.text());
      setManifest(parsed);
      setManifestError(undefined);
      const match = keys.find((key) => key.fingerprint === parsed.signer.publicKeyFingerprint);
      if (match) setKeyChoice(match.id);
    } catch (e) {
      setManifest(undefined);
      setManifestError(e instanceof Error ? e.message : "The manifest could not be read.");
    }
  };
  const clearManifest = () => { reset(); setManifestFile(undefined); setManifest(undefined); setManifestError(undefined); };

  const verify = async () => {
    reset();
    setBusy(true);
    try {
      let key: KeyRecord | undefined = keys.find((k) => k.id === keyChoice);
      if (keyChoice === PASTE && pasted.trim()) {
        try { key = await importKeyText(pasted); }
        catch (e) {
          const failed: VerifyResult = { status: "error", message: e instanceof Error ? e.message : "The public key could not be imported.", warnings: [] };
          setResult(failed); onResult(failed);
          return;
        }
      }
      const data = document ? await readFileBytes(document) : undefined;
      const signature = sigFile ? await readFileBytes(sigFile) : undefined;
      // Verification needs only the public part, so private key bytes never go into a verify job.
      const publicKey = key && { spki: key.spki, algorithm: key.algorithm, fingerprint: key.fingerprint };
      const out = await session.run({ op: "verify", input: { data, signature, manifest, key: publicKey, hash } });
      if (out.op === "verify") { setResult(out.result); onResult(out.result); }
    } catch (e) {
      if (e instanceof Error && e.message === "Cancelled.") return;
      const failed: VerifyResult = { status: "error", message: e instanceof Error ? e.message : "Verification failed.", warnings: [] };
      setResult(failed); onResult(failed);
    } finally {
      setBusy(false);
    }
  };

  const status = result ? STATUS[result.status] : undefined;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section aria-labelledby="verify-input" className="space-y-4 min-w-0">
        <h2 id="verify-input" className="font-mono text-sm font-semibold">Inputs</h2>
        <FileDropzone label="Original document" file={document} onFile={(f) => { reset(); setDocument(f); }} onClear={() => { reset(); setDocument(undefined); }} hint="1. Original document, byte for byte" />
        <FileDropzone label="Signature file" file={sigFile} onFile={(f) => { reset(); setSigFile(f); }} onClear={() => { reset(); setSigFile(undefined); }} hint="2. Signature (.sig) — optional if the manifest carries it" />
        <FileDropzone label="Manifest" file={manifestFile} onFile={(f) => void pickManifest(f)} onClear={clearManifest} accept=".json,application/json" hint="3. Manifest (.signature.json) — optional, enables the modified-document check" />
        {manifestError && <p role="alert" className="text-sm text-destructive break-words">{manifestError}</p>}

        <div className="space-y-3">
          <KeySelect id="verify-key" label="Public key" keys={keys} value={keyChoice === PASTE ? "" : keyChoice} onChange={(id) => { reset(); setKeyChoice(id); }} placeholder="Choose a key from this session" />
          <div className="space-y-1.5">
            <Label htmlFor="verify-paste" className="text-xs text-muted-foreground">Or paste a public key (PEM or JWK)</Label>
            <Textarea id="verify-paste" value={pasted} spellCheck={false} placeholder="-----BEGIN PUBLIC KEY-----" className="min-h-[96px] font-mono text-xs resize-y bg-card"
              onChange={(e) => { reset(); setPasted(e.target.value); setKeyChoice(e.target.value.trim() ? PASTE : keyChoice === PASTE ? "" : keyChoice); }} />
          </div>
          {!manifest && <HashSelect id="verify-hash" label="Hash algorithm (no manifest to read it from)" value={hash} onChange={(h) => { reset(); setHash(h); }} />}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={verify} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{busy ? "Verifying…" : "Verify signature"}</Button>
          {busy && <Button variant="outline" onClick={() => { session.cancel(); setBusy(false); }}><X />Cancel</Button>}
        </div>
      </section>

      <section aria-labelledby="verify-result" className="space-y-3 min-w-0">
        <h2 id="verify-result" className="font-mono text-sm font-semibold">Result</h2>
        {!result || !status ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">Add the original document, a signature and a public key, then verify. Verification always recalculates the document hash from the bytes you provide.</p>
        ) : (
          <div role="status" className="space-y-3">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono ${toneClass[status.tone]}`}>
              {result.status === "valid" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{status.label}
            </div>
            <p className="text-sm break-words">{result.message}</p>
            {result.warnings.length > 0 && (
              <ul className={`text-xs rounded-lg border p-3 space-y-1 list-disc pl-6 ${toneClass.warning}`}>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            )}
            <div className="border border-border rounded-lg px-3">
              {result.hashAlgorithm && <MetaRow label="Hash algorithm" value={manifest?.document.hashAlgorithm ?? result.hashAlgorithm} copyable={false} />}
              {result.recalculatedHash && <MetaRow label="Recalculated document hash" value={result.recalculatedHash} />}
              {manifest && <MetaRow label="Hash recorded in manifest" value={manifest.document.hash} />}
              {manifest && result.recalculatedHash && (
                <MetaRow label="Hashes match" value={result.recalculatedHash === manifest.document.hash ? "yes" : "no"} copyable={false} />
              )}
              {result.keyFingerprint && <MetaRow label="Public key fingerprint" value={result.keyFingerprint} />}
              {manifest && <MetaRow label="Manifest key fingerprint" value={manifest.signer.publicKeyFingerprint} />}
              {result.documentSize !== undefined && <MetaRow label="Document size" value={`${result.documentSize} bytes`} copyable={false} />}
              {manifest && <MetaRow label="Declared algorithm" value={manifest.signature.hashAlgorithm ? `${manifest.signature.algorithm} · ${manifest.signature.hashAlgorithm}` : manifest.signature.algorithm} copyable={false} />}
              {keys.find((k) => k.fingerprint === result.keyFingerprint) && <MetaRow label="Key algorithm" value={algorithmById(keys.find((k) => k.fingerprint === result.keyFingerprint)!.algorithm).label} copyable={false} />}
            </div>
            <p className="text-xs text-muted-foreground">A valid signature shows the document matches the signature for this key. It does not show who owns the key or that the signer is trusted.</p>
          </div>
        )}
      </section>
    </div>
  );
};
