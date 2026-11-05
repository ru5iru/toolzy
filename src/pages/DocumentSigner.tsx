import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { ToolSEO } from "@/components/ToolSEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchTab } from "@/components/document-signer/BatchTab";
import { InspectorTab } from "@/components/document-signer/InspectorTab";
import { KeysTab } from "@/components/document-signer/KeysTab";
import { SignTab } from "@/components/document-signer/SignTab";
import { VerifyTab } from "@/components/document-signer/VerifyTab";
import { forgetKey, indexedDbBackend, loadStoredKeys, rememberKey } from "@/components/document-signer/keyStore";
import { generateKeyRecord, type KeyRecord } from "@/components/document-signer/keyUtils";
import { SignerSession, type SignerWorkerPort } from "@/components/document-signer/signerSession";
import type { VerifyResult } from "@/components/document-signer/verifyUtils";
import SignerWorker from "@/workers/signerWorker?worker";

const TABS = ["sign", "verify", "batch", "keys", "inspector"] as const;
type Tab = (typeof TABS)[number];

const DocumentSigner = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(requested as Tab) ? (requested as Tab) : "sign");
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Keys live in memory unless the person opts to save one on this device; never in the URL or any request.
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [verification, setVerification] = useState<VerifyResult>();
  const session = useRef<SignerSession>();
  if (!session.current) session.current = new SignerSession(() => new SignerWorker() as unknown as SignerWorkerPort);
  useEffect(() => () => session.current?.cancel(), []);

  // Device storage is opt-in: the database is only opened if the person saved a key before.
  const store = useMemo(() => indexedDbBackend(), []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!(await store.exists())) return;
        const stored = await loadStoredKeys(store);
        if (!cancelled && stored.length) setKeys((current) => [...current, ...stored.filter((s) => !current.some((c) => c.id === s.id))]);
      } catch { /* storage unavailable: keys stay session-only */ }
    })();
    return () => { cancelled = true; };
  }, [store]);
  const remember = useCallback(async (id: string) => {
    const record = keys.find((k) => k.id === id);
    if (!record) return;
    try {
      const saved = await rememberKey(store, record);
      setKeys((current) => current.map((k) => (k.id === id ? saved : k)));
      toast.success("Saved on this device");
    } catch {
      toast.error("This browser could not save the key. It stays in memory for this session.");
    }
  }, [keys, store]);
  const forget = useCallback(async (id: string) => {
    try {
      await forgetKey(store, id);
      setKeys((current) => current.map((k) => (k.id === id ? { ...k, persisted: false } : k)));
      toast.success("Removed from this device");
    } catch {
      toast.error("This browser could not remove the saved key.");
    }
  }, [store]);

  const addKey = useCallback((key: KeyRecord) => setKeys((current) => [key, ...current]), []);
  const deleteKey = useCallback((id: string) => {
    setKeys((current) => current.filter((key) => key.id !== id));
    void forgetKey(store, id).catch(() => undefined);
  }, [store]);
  const quickGenerate = useCallback(async () => {
    try {
      addKey(await generateKeyRecord("ECDSA-P256", "Quick start key"));
      toast.success("ECDSA P-256 key pair generated");
    } catch {
      toast.error("Key generation failed in this browser.");
    }
  }, [addKey]);

  return (
    <ToolPageLayout title="Document Signer" maxWidth="7xl">
      <ToolSEO
        title="Document Signer — Sign & Verify Files"
        canonicalPath="/document-signer"
        description="Sign files and verify detached digital signatures privately in your browser. Generate RSA-PSS and ECDSA keys, export PEM and JWK, and inspect signature manifests. Nothing is uploaded."
        keywords={["document signer", "digital signature", "detached signature", "verify signature online", "RSA-PSS", "ECDSA", "web crypto", "sign file in browser", "PEM key generator"]}
        faq={[
          { question: "Are my documents or private keys uploaded?", answer: "No. Signing, verification and key generation use your browser's Web Crypto API. Documents and keys are not sent anywhere, and keys are kept only in this tab's memory until you close or reload it." },
          { question: "What does a valid signature prove?", answer: "That the document is byte-for-byte what was signed with the private key matching the public key you supplied. It does not prove who owns that key or that the signer is trustworthy; that needs a separate trust decision such as a certificate or a key you obtained from the signer directly." },
          { question: "Which algorithms are supported?", answer: "RSA-PSS with 2048, 3072 or 4096-bit keys, ECDSA with P-256 or P-384, and Ed25519 where your browser supports it (it is detected automatically and hidden otherwise). RSA-PSS and ECDSA use SHA-256, SHA-384 or SHA-512; Ed25519 signs the data directly. Keys import and export as PEM (PKCS#8 and SPKI) or JWK." },
          { question: "Can OpenSSL verify these signatures?", answer: "Yes. The .sig file for ECDSA is DER-encoded and the RSA-PSS salt length equals the hash length, so openssl dgst can verify them with the matching public key (for RSA-PSS, add -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:<hash length in bytes>). Ed25519 signatures are the raw 64 bytes; verify them with openssl pkeyutl -verify -rawin -pubin -inkey <public key> -in <file> -sigfile <.sig>." },
          { question: "What is the manifest file?", answer: "A JSON file describing the detached signature: the document's name, size and hash, the algorithm, the signature and the signer's key fingerprint. It is specific to this tool and is not a standard format. Its fields are self-declared; verification always recalculates the hash from the document you provide." },
          { question: "Are my keys saved?", answer: "Not by default: keys are held in this tab's memory and disappear when you close or reload it. You can choose Remember on this device for a key, which saves it in this browser as a non-extractable key (it can sign but cannot be exported again). Any script running on this site could still use a stored key to sign, and clearing site data deletes it. To back up a private key, export it as an encrypted PEM with a password." },
          { question: "Can I sign many files at once?", answer: "Yes. The Batch tab signs up to 100 files (25 MiB each) with one key and gives you a ZIP of .sig and .signature.json files, and it verifies a set of documents against their signature files by matching file names." },
        ]}
        howToSteps={[
          "Open the Keys tab and generate a key pair, or import a PKCS#8 private key",
          "Open Sign, choose a file and the key, then sign it",
          "Download the original, the .sig file and the manifest and share them together",
          "To check a file, open Verify and add the document, the signature or manifest, and the signer's public key",
          "Open Inspector to see which manifest fields are self-declared and which were verified",
        ]}
      />
      <p className="text-xs text-muted-foreground mb-4">
        Documents and keys stay in your browser and nothing is uploaded. Keys are held in memory and disappear when you reload or close this tab, unless you choose to save one on this device.
        For plain hashes and HMAC, use <Link to="/crypto?tab=hash" className="underline hover:text-foreground">Crypto Suite</Link>.
      </p>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="space-y-5">
        <TabsList>
          <TabsTrigger value="sign">Sign</TabsTrigger>
          <TabsTrigger value="verify">Verify</TabsTrigger>
          <TabsTrigger value="batch">Batch</TabsTrigger>
          <TabsTrigger value="keys">Keys{keys.length > 0 ? ` (${keys.length})` : ""}</TabsTrigger>
          <TabsTrigger value="inspector">Inspector</TabsTrigger>
        </TabsList>
        {/* forceMount keeps each tab's files and results when switching; hidden panels are not rendered visibly. */}
        <TabsContent value="sign" forceMount className={tab === "sign" ? "" : "hidden"}>
          <SignTab keys={keys} session={session.current} onOpenKeys={() => setTab("keys")} onQuickGenerate={quickGenerate} />
        </TabsContent>
        <TabsContent value="verify" forceMount className={tab === "verify" ? "" : "hidden"}>
          <VerifyTab keys={keys} session={session.current} onResult={setVerification} />
        </TabsContent>
        <TabsContent value="batch" forceMount className={tab === "batch" ? "" : "hidden"}>
          <BatchTab keys={keys} />
        </TabsContent>
        <TabsContent value="keys" forceMount className={tab === "keys" ? "" : "hidden"}>
          <KeysTab keys={keys} onAdd={addKey} onDelete={deleteKey} onRemember={remember} onForget={forget} storageSupported={store.supported} />
        </TabsContent>
        <TabsContent value="inspector" forceMount className={tab === "inspector" ? "" : "hidden"}>
          <InspectorTab verification={verification} />
        </TabsContent>
      </Tabs>
    </ToolPageLayout>
  );
};

export default DocumentSigner;
