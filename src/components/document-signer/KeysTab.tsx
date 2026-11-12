import { useEffect, useRef, useState } from "react";
import { Copy, Download, HardDrive, KeyRound, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ALGORITHMS, algorithmById, supportedAlgorithms, type AlgorithmId, type AlgorithmInfo } from "./algorithms";
import { copyText, downloadBytes } from "./browserUtils";
import {
  exportEncryptedPrivatePem, exportJwk, exportPrivatePem, exportPublicPem, generateKeyRecord, hasPrivateKey, importKeyText, isEncryptedKeyText, keysMatch, type KeyRecord,
} from "./keyUtils";
import { KeySelect, MetaRow } from "./SignerControls";
import { toneClass } from "./statusStyles";

interface KeysTabProps {
  keys: KeyRecord[];
  onAdd: (key: KeyRecord) => void;
  onDelete: (id: string) => void;
  onRemember: (id: string) => Promise<void>;
  onForget: (id: string) => Promise<void>;
  storageSupported: boolean;
}

type PrivateExport = { key: KeyRecord; format: "pem" | "jwk" };

export const KeysTab = ({ keys, onAdd, onDelete, onRemember, onForget, storageSupported }: KeysTabProps) => {
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("ECDSA-P256");
  // Ed25519 support varies by browser, so it only appears once detected.
  const [available, setAvailable] = useState<AlgorithmInfo[]>(ALGORITHMS.filter((a) => a.family !== "Ed25519"));
  useEffect(() => { void supportedAlgorithms().then(setAvailable); }, []);
  const [genName, setGenName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File>();
  const [importName, setImportName] = useState("");
  const [importError, setImportError] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [importPassword, setImportPassword] = useState("");
  const [exportPassword, setExportPassword] = useState("");
  const [exportPassword2, setExportPassword2] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<KeyRecord>();
  const [pendingExport, setPendingExport] = useState<PrivateExport>();
  const [pairPrivateId, setPairPrivateId] = useState("");
  const [pairPublic, setPairPublic] = useState("");
  const [pairResult, setPairResult] = useState<{ ok: boolean; message: string }>();

  const selected = keys.find((k) => k.id === selectedId) ?? keys[0];

  const generate = async () => {
    setGenerating(true);
    try {
      const key = await generateKeyRecord(algorithm, genName);
      onAdd(key); setSelectedId(key.id); setGenName("");
      toast.success(`${algorithmById(algorithm).label} key pair generated`);
    } catch {
      toast.error("Key generation failed in this browser.");
    } finally { setGenerating(false); }
  };

  const doImport = async () => {
    setImporting(true); setImportError(undefined);
    try {
      const key = await importKeyText(importText, importName, importPassword);
      onAdd(key); setSelectedId(key.id); setImportText(""); setImportFile(undefined); setImportName(""); setImportPassword("");
      toast.success(key.pkcs8 ? "Private key imported; public key derived" : "Public key imported");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "The key could not be imported.");
    } finally { setImporting(false); }
  };

  const handleKeyFile = async (file: File) => {
    setImportError(undefined);
    try {
      const text = await file.text();
      setImportText(text);
      setImportFile(file);
      if (!importName) setImportName(file.name.replace(/\.(pem|key|jwk|json)$/i, ""));
    } catch {
      setImportError("Could not read the key file.");
    }
  };

  const exportPublic = async (key: KeyRecord, format: "pem" | "jwk", action: "download" | "copy") => {
    const text = format === "pem" ? exportPublicPem(key) : await exportJwk(key, false);
    if (action === "copy") await copyText(text, "Public key copied");
    else downloadBytes(`${slug(key.name)}-public.${format === "pem" ? "pem" : "jwk.json"}`, text, "text/plain");
  };

  const exportPrivate = async ({ key, format }: PrivateExport, password: string) => {
    try {
      const encrypted = format === "pem" && password.length > 0;
      const text = format === "jwk" ? await exportJwk(key, true) : encrypted ? await exportEncryptedPrivatePem(key, password) : exportPrivatePem(key);
      const suffix = format === "jwk" ? "jwk.json" : "pem";
      downloadBytes(`${slug(key.name)}-private${encrypted ? "-encrypted" : ""}.${suffix}`, text, "text/plain");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    }
  };
  const closeExport = () => { setPendingExport(undefined); setExportPassword(""); setExportPassword2(""); };
  const passwordsMismatch = exportPassword.length > 0 && exportPassword !== exportPassword2;

  const checkPair = async () => {
    const priv = keys.find((k) => k.id === pairPrivateId);
    if (!priv) { setPairResult({ ok: false, message: "Choose a private key first." }); return; }
    try {
      const pub = await importKeyText(pairPublic);
      const ok = keysMatch(priv, pub.spki);
      setPairResult({ ok, message: ok ? "These keys are a matching pair." : "These keys do not match." });
    } catch (e) {
      setPairResult({ ok: false, message: e instanceof Error ? e.message : "The public key could not be read." });
    }
  };

  const privateKeys = keys.filter(hasPrivateKey);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-5 min-w-0">
        <section aria-labelledby="gen-heading" className="space-y-3">
          <h2 id="gen-heading" className="font-mono text-sm font-semibold">Generate a key pair</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-algorithm" className="text-xs text-muted-foreground">Algorithm</Label>
              <Select value={algorithm} onValueChange={(v) => setAlgorithm(v as AlgorithmId)}>
                <SelectTrigger id="gen-algorithm" className="font-mono text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{available.map((a) => <SelectItem key={a.id} value={a.id} className="font-mono text-xs">{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-name" className="text-xs text-muted-foreground">Name (optional)</Label>
              <Input id="gen-name" value={genName} onChange={(e) => setGenName(e.target.value)} placeholder="e.g. release signing" maxLength={60} />
            </div>
          </div>
          <Button onClick={generate} disabled={generating}>{generating ? <Loader2 className="animate-spin" /> : <Plus />}Generate key pair</Button>
          <p className="text-xs text-muted-foreground">Keys stay in this tab's memory unless you choose "Remember on this device". Reloading or closing the page removes the rest, so export anything you need to keep.</p>
        </section>

        <section aria-labelledby="import-heading" className="space-y-3">
          <h2 id="import-heading" className="font-mono text-sm font-semibold">Import a key</h2>
          <Textarea aria-label="Key to import" value={importText} spellCheck={false} onChange={(e) => { setImportText(e.target.value); setImportFile(undefined); setImportError(undefined); }}
            placeholder={"PKCS#8 private key (plain or encrypted), SPKI public key, or JWK\n-----BEGIN PRIVATE KEY-----"} className="min-h-[110px] font-mono text-xs resize-y bg-card" />
          <FileDropzone
            label="Key file"
            onFile={handleKeyFile}
            onClear={() => { setImportFile(undefined); setImportText(""); setImportName(""); setImportError(undefined); }}
            file={importFile}
            accept=".pem,.key,.jwk,.json"
            hint="Or drop a .pem, .key, or .jwk file"
          />
          {isEncryptedKeyText(importText) && (
            <Input type="password" aria-label="Password for encrypted key" autoComplete="off" value={importPassword} onChange={(e) => { setImportPassword(e.target.value); setImportError(undefined); }} placeholder="Password for this encrypted key" />
          )}
          <Input aria-label="Name for imported key" value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Name (optional)" maxLength={60} />
          <Button variant="outline" onClick={doImport} disabled={importing || !importText.trim()}>{importing ? <Loader2 className="animate-spin" /> : <Upload />}Import key</Button>
          {importError && <p role="alert" className="text-sm text-destructive break-words">{importError}</p>}
        </section>

        <section aria-labelledby="pair-heading" className="space-y-3">
          <h2 id="pair-heading" className="font-mono text-sm font-semibold">Check a key pair</h2>
          <KeySelect id="pair-private" label="Private key" keys={privateKeys} value={pairPrivateId} onChange={(id) => { setPairPrivateId(id); setPairResult(undefined); }} placeholder="Choose a private key" />
          <Textarea aria-label="Public key to compare" value={pairPublic} spellCheck={false} onChange={(e) => { setPairPublic(e.target.value); setPairResult(undefined); }} placeholder="Paste the public key to compare" className="min-h-[72px] font-mono text-xs resize-y bg-card" />
          <Button variant="outline" onClick={checkPair} disabled={!pairPublic.trim()}>Check match</Button>
          {pairResult && <p role="status" className={`text-xs rounded-lg border px-3 py-2 ${pairResult.ok ? toneClass.success : toneClass.warning}`}>{pairResult.message}</p>}
        </section>
      </div>

      <section aria-labelledby="keys-heading" className="space-y-3 min-w-0">
        <h2 id="keys-heading" className="font-mono text-sm font-semibold">Keys in this session ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">No keys yet. Generate a key pair or import one to start signing and verifying.</p>
        ) : (
          <>
            <ul className="border border-border rounded-lg divide-y divide-border" aria-label="Keys">
              {keys.map((key) => (
                <li key={key.id}>
                  <button type="button" onClick={() => setSelectedId(key.id)} aria-pressed={selected?.id === key.id}
                    className={`w-full text-left px-3 py-2 hover:bg-secondary ${selected?.id === key.id ? "bg-secondary" : ""}`}>
                    <div className="flex items-center gap-2 text-sm font-mono"><KeyRound className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" /><span className="truncate">{key.name}</span></div>
                    <div className="text-xs text-muted-foreground mt-0.5">{algorithmById(key.algorithm).label} · {hasPrivateKey(key) ? "key pair" : "public only"}{key.persisted ? " · saved on device" : ""}</div>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="space-y-3">
                <div className="border border-border rounded-lg px-3">
                  <MetaRow label="Name" value={selected.name} copyable={false} />
                  <MetaRow label="Algorithm" value={algorithmById(selected.algorithm).label} copyable={false} />
                  <MetaRow label="Contains" value={hasPrivateKey(selected) ? "private and public key" : "public key only"} copyable={false} />
                  <MetaRow label="Fingerprint (SHA-256 of SPKI)" value={selected.fingerprint} />
                  <MetaRow label="Source" value={selected.source} copyable={false} />
                  <MetaRow label="Storage" value={selected.persisted ? "saved on this device" : "this tab only"} copyable={false} />
                  <MetaRow label="Created" value={selected.createdAt} copyable={false} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void exportPublic(selected, "pem", "download")}><Download />Public PEM</Button>
                  <Button size="sm" variant="outline" onClick={() => void exportPublic(selected, "jwk", "download")}><Download />Public JWK</Button>
                  <Button size="sm" variant="outline" onClick={() => void exportPublic(selected, "pem", "copy")}><Copy />Copy public PEM</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.pkcs8 && <Button size="sm" variant="outline" onClick={() => setPendingExport({ key: selected, format: "pem" })}><Download />Private PEM…</Button>}
                  {selected.pkcs8 && <Button size="sm" variant="outline" onClick={() => setPendingExport({ key: selected, format: "jwk" })}><Download />Private JWK…</Button>}
                  <Button size="sm" variant="outline" onClick={() => setPendingDelete(selected)}><Trash2 />Delete</Button>
                </div>
                {hasPrivateKey(selected) && !selected.pkcs8 && (
                  <p className="text-xs text-muted-foreground">This private key was restored from device storage and cannot be exported. Only its public half can be downloaded.</p>
                )}
                {storageSupported && (
                  <div className="space-y-1.5">
                    <Button size="sm" variant="outline" onClick={() => void (selected.persisted ? onForget(selected.id) : onRemember(selected.id))}>
                      {selected.persisted ? <><HardDrive />Forget on this device</> : <><HardDrive />Remember on this device</>}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {hasPrivateKey(selected)
                        ? "Optional. Saves the private key in this browser as a non-extractable key, so you can sign after reloading but can no longer export it from here. Any script running on this site could still use it to sign, and clearing site data deletes it."
                        : "Optional. Saves this public key in this browser so it is there after reloading."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <AlertDialog open={Boolean(pendingExport)} onOpenChange={(open) => !open && closeExport()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export private key?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingExport?.format === "pem"
                ? "Anyone who gets an unencrypted file can sign as you. Set a password to encrypt it (PKCS#8, PBKDF2-SHA256 600,000 rounds + AES-256), or leave it empty for a plain file. Never email or commit it."
                : "JWK files are not encrypted. Anyone who gets it can sign as you. Store it somewhere safe, never email or commit it, and delete copies you no longer need."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingExport?.format === "pem" && (
            <div className="space-y-2">
              <Input type="password" aria-label="Export password" autoComplete="new-password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} placeholder="Password (optional)" />
              {exportPassword && <Input type="password" aria-label="Confirm export password" autoComplete="new-password" value={exportPassword2} onChange={(e) => setExportPassword2(e.target.value)} placeholder="Confirm password" />}
              {passwordsMismatch && exportPassword2 && <p role="alert" className="text-xs text-destructive">Passwords do not match.</p>}
              <p className="text-xs text-muted-foreground">The password is never stored. If you forget it, the key cannot be recovered.</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={passwordsMismatch} onClick={() => { if (pendingExport) void exportPrivate(pendingExport, exportPassword); closeExport(); }}>{exportPassword && pendingExport?.format === "pem" ? "Download encrypted key" : "Download private key"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && hasPrivateKey(pendingDelete) ? "This removes the key pair from this session and from this device. If you have not exported the private key, you will not be able to sign with it again." : "This removes the public key from this session and from this device."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDelete) onDelete(pendingDelete.id); setPendingDelete(undefined); }}>Delete key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "key";
}
