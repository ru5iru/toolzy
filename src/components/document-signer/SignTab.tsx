import { useEffect, useRef, useState } from "react";
import { Download, KeyRound, Loader2, PenLine, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { digestHex } from "@/lib/crypto/fingerprint";
import { formatBytes } from "@/lib/formatBytes";
import { algorithmById, usesSigningHash, type HashName } from "./algorithms";
import { downloadBytes, readFileBytes } from "./browserUtils";
import { hasPrivateKey, type KeyRecord } from "./keyUtils";
import { manifestFileName, signatureFileName } from "./manifest";
import type { SignerSession } from "./signerSession";
import { validateFileSize, type SignDocumentResult } from "./signingUtils";
import { HashSelect, KeySelect, MetaRow } from "./SignerControls";
import { toneClass } from "./statusStyles";

interface SignTabProps {
  keys: KeyRecord[];
  session: SignerSession;
  onOpenKeys: () => void;
  onQuickGenerate: () => Promise<void>;
}

export const SignTab = ({ keys, session, onOpenKeys, onQuickGenerate }: SignTabProps) => {
  const privateKeys = keys.filter(hasPrivateKey);
  const [file, setFile] = useState<File>();
  const [fingerprint, setFingerprint] = useState<string>();
  const [keyId, setKeyId] = useState("");
  const [hash, setHash] = useState<HashName>("SHA-256");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ data: SignDocumentResult; filename: string; keyName: string; algorithmLabel: string }>();
  const generation = useRef(0);

  // Keep a valid key selected as the keyring changes.
  useEffect(() => {
    if (!privateKeys.some((key) => key.id === keyId)) setKeyId(privateKeys[0]?.id ?? "");
  }, [privateKeys, keyId]);

  const invalidate = () => { generation.current++; setResult(undefined); setError(undefined); };

  const select = async (selected: File) => {
    invalidate();
    setFile(selected);
    setFingerprint(undefined);
    try {
      validateFileSize(selected.size);
      const current = generation.current;
      const digest = await digestHex(await readFileBytes(selected), "SHA-256");
      if (current === generation.current) setFingerprint(digest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file could not be read.");
    }
  };

  const clear = () => { session.cancel(); invalidate(); setFile(undefined); setFingerprint(undefined); setBusy(false); };
  const resetConfig = () => { invalidate(); setHash("SHA-256"); setKeyId(privateKeys[0]?.id ?? ""); };

  const key = privateKeys.find((k) => k.id === keyId);
  const sign = async () => {
    if (!file || !key) return;
    invalidate();
    const current = generation.current;
    setBusy(true);
    try {
      validateFileSize(file.size);
      const data = await readFileBytes(file);
      const out = await session.run({ op: "sign", input: { data, filename: file.name, key, hash } });
      if (out.op === "sign" && current === generation.current) {
        setResult({ data: out.result, filename: file.name, keyName: key.name, algorithmLabel: algorithmById(key.algorithm).label });
        toast.success("Document signed");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Cancelled.") return;
      setError(e instanceof Error ? e.message : "Signing failed.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const cancel = () => { session.cancel(); setBusy(false); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section aria-labelledby="sign-input" className="space-y-4 min-w-0">
        <h2 id="sign-input" className="font-mono text-sm font-semibold">Document and key</h2>
        <FileDropzone
          label="Document to sign"
          file={file}
          onFile={select}
          onClear={clear}
          hint="Drop any file here · up to 256 MiB · the original is never modified"
        />
        {file && (
          <div className="border border-border rounded-lg px-3">
            <MetaRow label="Filename" value={file.name} />
            <MetaRow label="MIME type" value={file.type || "unknown"} copyable={false} />
            <MetaRow label="Size" value={`${formatBytes(file.size)} (${file.size} bytes)`} copyable={false} />
            <MetaRow label="SHA-256 fingerprint" value={fingerprint ?? "calculating…"} copyable={Boolean(fingerprint)} />
          </div>
        )}

        {privateKeys.length === 0 ? (
          <div className="border border-border rounded-lg p-4 text-sm space-y-3">
            <p className="text-muted-foreground">Signing needs a private key. Keys stay in this tab's memory only.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void onQuickGenerate()}><KeyRound />Generate ECDSA P-256 key</Button>
              <Button size="sm" variant="outline" onClick={onOpenKeys}>Import or choose another type</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px] gap-3">
            <KeySelect id="sign-key" label="Private key" keys={privateKeys} value={keyId} onChange={(id) => { invalidate(); setKeyId(id); }} placeholder="Choose a key" />
            <HashSelect id="sign-hash" value={hash} label={key && !usesSigningHash(algorithmById(key.algorithm)) ? "Document hash (Ed25519 signs the data itself)" : "Hash algorithm"} onChange={(next) => { invalidate(); setHash(next); }} />
          </div>
        )}
        {key && <p className="text-xs text-muted-foreground">Algorithm follows the key: {algorithmById(key.algorithm).label}. Need another type? <button type="button" className="underline hover:text-foreground" onClick={onOpenKeys}>Manage keys</button></p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={sign} disabled={!file || !key || busy || !fingerprint}>
            {busy ? <Loader2 className="animate-spin" /> : <PenLine />}{busy ? "Signing…" : "Sign document"}
          </Button>
          {busy && <Button variant="outline" onClick={cancel}><X />Cancel</Button>}
          <Button variant="outline" onClick={resetConfig} disabled={busy}><RotateCcw />Reset configuration</Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      </section>

      <section aria-labelledby="sign-result" className="space-y-3 min-w-0">
        <h2 id="sign-result" className="font-mono text-sm font-semibold">Result</h2>
        {!result ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">
            Sign a document to get a detached signature (<code className="font-mono">.sig</code>) and a manifest (<code className="font-mono">.signature.json</code>). Keep them next to the original and share all three.
          </p>
        ) : (
          <div role="status" className="space-y-3">
            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-mono ${toneClass.success}`}>Signed with {result.keyName}</div>
            <div className="border border-border rounded-lg px-3">
              <MetaRow label="Signature algorithm" value={result.algorithmLabel} copyable={false} />
              <MetaRow label="Hash algorithm" value={result.data.manifest.signature.hashAlgorithm ?? "none (Ed25519 hashes internally)"} copyable={false} />
              <MetaRow label="Document hash" value={result.data.documentHash} />
              <MetaRow label="Public key fingerprint" value={result.data.manifest.signer.publicKeyFingerprint} />
              <MetaRow label="Signature (Base64)" value={result.data.manifest.signature.value} />
              <MetaRow label="Signed at" value={result.data.manifest.metadata.createdAt} copyable={false} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => file && downloadBytes(result.filename, file, file.type || "application/octet-stream")}><Download />Original</Button>
              <Button size="sm" onClick={() => downloadBytes(signatureFileName(result.filename), result.data.signature)}><Download />Signature (.sig)</Button>
              <Button size="sm" onClick={() => downloadBytes(manifestFileName(result.filename), result.data.manifestText, "application/json")}><Download />Manifest (.json)</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The manifest's filename and time are self-declared; only the signature over the document bytes is cryptographic.
              {result.data.manifest.signature.format === "ecdsa-der" && " ECDSA signatures are DER-encoded, so OpenSSL can verify the .sig file."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
