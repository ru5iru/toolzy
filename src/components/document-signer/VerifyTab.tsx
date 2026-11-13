import type { ReactNode } from "react";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, ShieldCheck, X, XCircle } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { algorithmById, type HashName } from "./algorithms";
import { readFileBytes, shortFingerprint } from "./browserUtils";
import { importKeyText, type KeyRecord } from "./keyUtils";
import { parseManifest, type Manifest } from "./manifest";
import type { SignerSession } from "./signerSession";
import { HashSelect, KeySelect, MetaRow } from "./SignerControls";
import { toneClass } from "./statusStyles";
import type { VerifyResult, VerifyStatus } from "./verifyUtils";

const PASTE = "__paste";

const STATUS: Record<VerifyStatus, { label: string; tone: keyof typeof toneClass; icon: ReactNode }> = {
  valid:   { label: "Signature valid",     tone: "success", icon: <CheckCircle2 className="h-5 w-5" /> },
  invalid: { label: "Signature invalid",   tone: "danger",  icon: <XCircle className="h-5 w-5" /> },
  modified:{ label: "Document modified",   tone: "danger",  icon: <XCircle className="h-5 w-5" /> },
  missing: { label: "Inputs missing",      tone: "warning", icon: <AlertTriangle className="h-5 w-5" /> },
  error:   { label: "Verification error",  tone: "warning", icon: <AlertTriangle className="h-5 w-5" /> },
};

type CheckState = "pass" | "fail" | "warn" | "skip";
interface CheckItem { label: string; state: CheckState; detail?: string }

const CheckIcon = ({ state }: { state: CheckState }) => {
  if (state === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-foreground))] shrink-0" />;
  if (state === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (state === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning-foreground))] shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />;
};

function buildChecklist(result: VerifyResult, manifest: Manifest | undefined): CheckItem[] {
  const items: CheckItem[] = [];

  // 1. Document provided
  items.push({ label: "Document provided", state: result.documentSize !== undefined ? "pass" : "fail" });

  // 2. Hash recalculated
  if (result.recalculatedHash) {
    items.push({ label: "Document hash recalculated", state: "pass", detail: shortFingerprint(result.recalculatedHash) });
  }

  // 3. Manifest hash match
  if (manifest && result.recalculatedHash) {
    const match = result.recalculatedHash === manifest.document.hash;
    items.push({ label: "Hash matches manifest", state: match ? "pass" : "fail" });
  } else {
    items.push({ label: "Hash matches manifest", state: "skip" });
  }

  // 4. Signature verified
  items.push({
    label: "Cryptographic signature verified",
    state: result.status === "valid" ? "pass" : result.status === "missing" || result.status === "error" ? "skip" : "fail",
  });

  // 5. Key fingerprint matches manifest
  if (manifest && result.keyFingerprint) {
    const matches = result.keyFingerprint === manifest.signer.publicKeyFingerprint;
    items.push({ label: "Key fingerprint matches manifest", state: matches ? "pass" : "warn" });
  } else {
    items.push({ label: "Key fingerprint matches manifest", state: "skip" });
  }

  return items;
}

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
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">
            Add the original document, a signature and a public key, then click Verify. Each verification run recalculates the document hash from the bytes you provide.
          </p>
        ) : (
          <div role="status" className="space-y-4">
            {/* ── Status banner ── */}
            <div className={`flex items-center gap-3 rounded-lg border p-4 ${toneClass[status.tone]}`}>
              <span aria-hidden="true">{status.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{status.label}</p>
                <p className="text-xs mt-0.5 break-words opacity-90">{result.message}</p>
              </div>
            </div>

            {/* ── Warnings ── */}
            {result.warnings.length > 0 && (
              <ul className={`text-xs rounded-lg border p-3 space-y-1.5 ${toneClass.warning}`} aria-label="Verification warnings">
                {result.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />{w}</li>
                ))}
              </ul>
            )}

            {/* ── Checklist ── */}
            <div className="border border-border rounded-lg divide-y divide-border">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground">Verification steps</p>
              {buildChecklist(result, manifest).map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 px-3 py-2">
                  <CheckIcon state={item.state} />
                  <span className={`text-xs flex-1 ${item.state === "skip" ? "text-muted-foreground/50" : "text-foreground"}`}>{item.label}</span>
                  {item.detail && <span className="text-xs font-mono text-muted-foreground shrink-0">{item.detail}</span>}
                </div>
              ))}
            </div>

            {/* ── Detail rows ── */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none list-none flex items-center gap-1.5">
                <span className="border border-border rounded px-2 py-0.5 group-open:bg-secondary transition-colors">Technical details</span>
              </summary>
              <div className="border border-border rounded-lg px-3 mt-2">
                {result.hashAlgorithm && <MetaRow label="Hash algorithm" value={manifest?.document.hashAlgorithm ?? result.hashAlgorithm} copyable={false} />}
                {result.recalculatedHash && <MetaRow label="Recalculated hash" value={result.recalculatedHash} />}
                {manifest && <MetaRow label="Hash in manifest" value={manifest.document.hash} />}
                {result.keyFingerprint && <MetaRow label="Public key fingerprint" value={result.keyFingerprint} />}
                {manifest && result.keyFingerprint !== manifest.signer.publicKeyFingerprint && (
                  <MetaRow label="Manifest key fingerprint" value={manifest.signer.publicKeyFingerprint} />
                )}
                {result.documentSize !== undefined && <MetaRow label="Document size" value={`${result.documentSize.toLocaleString()} bytes`} copyable={false} />}
                {manifest && <MetaRow label="Declared algorithm" value={manifest.signature.hashAlgorithm ? `${manifest.signature.algorithm} · ${manifest.signature.hashAlgorithm}` : manifest.signature.algorithm} copyable={false} />}
                {keys.find((k) => k.fingerprint === result.keyFingerprint) && (
                  <MetaRow label="Key algorithm" value={algorithmById(keys.find((k) => k.fingerprint === result.keyFingerprint)!.algorithm).label} copyable={false} />
                )}
              </div>
            </details>

            <p className="text-xs text-muted-foreground">A valid signature confirms the document bytes match the signature for this key. It does not prove who holds the key or that the signer is trusted.</p>
          </div>
        )}
      </section>
    </div>
  );
};
