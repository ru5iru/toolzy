import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { ToolSEO } from "@/components/ToolSEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InspectorTab } from "@/components/document-signer/InspectorTab";
import { KeysTab } from "@/components/document-signer/KeysTab";
import { SignTab } from "@/components/document-signer/SignTab";
import { VerifyTab } from "@/components/document-signer/VerifyTab";
import { generateKeyRecord, type KeyRecord } from "@/components/document-signer/keyUtils";
import { SignerSession, type SignerWorkerPort } from "@/components/document-signer/signerSession";
import type { VerifyResult } from "@/components/document-signer/verifyUtils";
import SignerWorker from "@/workers/signerWorker?worker";

const TABS = ["sign", "verify", "keys", "inspector"] as const;
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

  // Keys live in memory only: never written to storage, the URL or any request.
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [verification, setVerification] = useState<VerifyResult>();
  const session = useRef<SignerSession>();
  if (!session.current) session.current = new SignerSession(() => new SignerWorker() as unknown as SignerWorkerPort);
  useEffect(() => () => session.current?.cancel(), []);

  const addKey = useCallback((key: KeyRecord) => setKeys((current) => [key, ...current]), []);
  const deleteKey = useCallback((id: string) => setKeys((current) => current.filter((key) => key.id !== id)), []);
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
          { question: "Which algorithms are supported?", answer: "RSA-PSS with 2048 or 3072-bit keys, and ECDSA with P-256 or P-384, each with SHA-256, SHA-384 or SHA-512. Keys import and export as PEM (PKCS#8 and SPKI) or JWK." },
          { question: "Can OpenSSL verify these signatures?", answer: "Yes. The .sig file for ECDSA is DER-encoded and the RSA-PSS salt length equals the hash length, so openssl dgst can verify them with the matching public key (for RSA-PSS, add -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:<hash length in bytes>)." },
          { question: "What is the manifest file?", answer: "A JSON file describing the detached signature: the document's name, size and hash, the algorithm, the signature and the signer's key fingerprint. It is specific to this tool and is not a standard format. Its fields are self-declared; verification always recalculates the hash from the document you provide." },
          { question: "Why can't I save my keys?", answer: "Keeping private keys in browser storage is risky, so this version holds them in memory only. Export a private key if you need it again; the export is not encrypted, so store it securely." },
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
        Documents and keys stay in your browser and nothing is uploaded. Keys are held in memory only and disappear when you reload or close this tab.
        For plain hashes and HMAC, use <Link to="/crypto?tab=hash" className="underline hover:text-foreground">Crypto Suite</Link>.
      </p>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="space-y-5">
        <TabsList>
          <TabsTrigger value="sign">Sign</TabsTrigger>
          <TabsTrigger value="verify">Verify</TabsTrigger>
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
        <TabsContent value="keys" forceMount className={tab === "keys" ? "" : "hidden"}>
          <KeysTab keys={keys} onAdd={addKey} onDelete={deleteKey} />
        </TabsContent>
        <TabsContent value="inspector" forceMount className={tab === "inspector" ? "" : "hidden"}>
          <InspectorTab verification={verification} />
        </TabsContent>
      </Tabs>
    </ToolPageLayout>
  );
};

export default DocumentSigner;
