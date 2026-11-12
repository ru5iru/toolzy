import { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Trash2 } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { ToolSEO } from "@/components/ToolSEO";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CertificateCard } from "@/components/certificate/CertificateCard";
import { parseCertificateFile, parseCertificateText, type ParsedCertificate } from "@/components/certificate/certUtils";

const CertificateInspector = () => {
  const [text, setText] = useState("");
  const [certs, setCerts] = useState<ParsedCertificate[]>([]);
  const [error, setError] = useState<string>();

  const run = async (job: () => Promise<ParsedCertificate[]>) => {
    try { setCerts(await job()); setError(undefined); }
    catch (e) { setCerts([]); setError(e instanceof Error ? e.message : "The certificate could not be read."); }
  };
  const clear = () => { setText(""); setCerts([]); setError(undefined); };

  return (
    <ToolPageLayout title="Certificate Inspector" icon={ScrollText} description={<>Decode X.509 certificates and requests. Shows what a certificate states; it does not validate trust or revocation. To sign files, see <Link to="/document-signer" className="underline hover:text-foreground">Document Signer</Link>.</>}>
      <ToolSEO
        title="Certificate Inspector — Decode X.509 & CSR"
        canonicalPath="/certificate"
        description="Decode X.509 certificates and certificate signing requests (CSRs) in your browser. See subject, issuer, validity, SANs, key usage and fingerprints. Nothing is uploaded."
        keywords={["x509 decoder", "certificate decoder", "csr decoder", "ssl certificate inspector", "pem certificate viewer", "certificate fingerprint", "subject alternative name"]}
        faq={[
          { question: "Is my certificate uploaded?", answer: "No. Certificates are decoded locally by a small parser in your browser. Nothing is sent anywhere." },
          { question: "Does this validate the certificate?", answer: "No. It shows what the certificate states: names, dates, key type, extensions and fingerprints. It does not check the signature chain, trust, revocation or hostname matching, so a decoded certificate is not proof that it can be trusted." },
          { question: "Which formats work?", answer: "PEM certificates (including chains with several blocks), PEM certificate requests, and DER files (.der, .cer, .crt). Private keys are rejected on purpose." },
          { question: "Are the fingerprints the same as OpenSSL's?", answer: "Yes. SHA-1 and SHA-256 fingerprints are computed over the DER bytes, matching openssl x509 -fingerprint." },
        ]}
        howToSteps={["Paste a PEM certificate or CSR, or drop a .pem, .crt, .cer, .der or .csr file", "Read the subject, issuer, validity dates, key details and extensions", "Copy a fingerprint or serial number to compare with another source"]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section aria-labelledby="cert-input" className="space-y-3 min-w-0">
          <h2 id="cert-input" className="font-mono text-sm font-semibold">Certificate or request</h2>
          <Textarea aria-label="Certificate PEM" value={text} spellCheck={false} placeholder={"-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"}
            onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) void run(() => parseCertificateText(e.target.value)); else clear(); }}
            className="min-h-[220px] font-mono text-xs resize-y bg-card" />
          <FileDropzone label="Certificate file" onFile={async (f) => { setText(""); await run(async () => parseCertificateFile(new Uint8Array(await f.arrayBuffer()))); }} hint="Or drop a .pem, .crt, .cer, .der or .csr file" />
          <Button variant="outline" size="sm" onClick={clear} disabled={!text && certs.length === 0 && !error}><Trash2 />Clear</Button>
          {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
        </section>
        <section aria-live="polite" className="space-y-5 min-w-0">
          {certs.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4"><ScrollText className="inline h-4 w-4 mr-1" aria-hidden="true" />Paste a certificate or chain to see its details.</p>
          ) : certs.map((cert, i) => <CertificateCard key={cert.fingerprints.sha256} cert={cert} index={i} total={certs.length} />)}
        </section>
      </div>
    </ToolPageLayout>
  );
};

export default CertificateInspector;
