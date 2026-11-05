import { MetaRow } from "@/components/document-signer/SignerControls";
import { toneClass } from "@/components/document-signer/statusStyles";
import { validityState, type ParsedCertificate } from "./certUtils";

const fmt = (d: Date) => d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

export const CertificateCard = ({ cert, index }: { cert: ParsedCertificate; index: number }) => {
  const validity = validityState(cert);
  const badge = validity && (validity.state === "valid"
    ? { text: `Valid · ${validity.daysLeft} day${validity.daysLeft === 1 ? "" : "s"} left`, tone: validity.daysLeft < 30 ? toneClass.warning : toneClass.success }
    : validity.state === "expired" ? { text: `Expired ${-validity.daysLeft} days ago`, tone: toneClass.danger }
    : { text: "Not valid yet", tone: toneClass.warning });
  const cn = cert.subject.parts.find((p) => p.label === "CN")?.value;
  return (
    <article className="space-y-3 min-w-0" aria-label={`${cert.kind === "csr" ? "Request" : "Certificate"} ${index + 1}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-sm font-semibold break-all">{cert.kind === "csr" ? "Certificate request" : `Certificate ${index + 1}`}{cn ? ` · ${cn}` : ""}</h2>
        {badge && <span className={`rounded-full border px-3 py-0.5 text-xs font-mono ${badge.tone}`}>{badge.text}</span>}
        {cert.selfIssued && <span className={`rounded-full border px-3 py-0.5 text-xs font-mono ${toneClass.neutral}`}>Self-issued</span>}
      </div>
      <div className="border border-border rounded-lg px-3">
        <MetaRow label="Subject" value={cert.subject.text} />
        {cert.issuer && <MetaRow label="Issuer" value={cert.issuer.text} />}
        <MetaRow label="Version" value={`v${cert.version}`} copyable={false} />
        {cert.serial && <MetaRow label="Serial number" value={cert.serial} />}
        {cert.notBefore && cert.notAfter && <MetaRow label="Valid from" value={fmt(cert.notBefore)} copyable={false} />}
        {cert.notAfter && <MetaRow label="Valid until" value={fmt(cert.notAfter)} copyable={false} />}
        <MetaRow label="Signature algorithm" value={cert.signatureAlgorithm} copyable={false} />
        <MetaRow label="Public key" value={`${cert.publicKey.algorithm}${cert.publicKey.detail ? ` · ${cert.publicKey.detail}` : ""}`} copyable={false} />
        <MetaRow label="SHA-256 fingerprint" value={cert.fingerprints.sha256} />
        <MetaRow label="SHA-1 fingerprint" value={cert.fingerprints.sha1} />
        {cert.extensions.map((ext) => (
          <MetaRow key={ext.oid} label={ext.name + (ext.critical ? " (critical)" : "")} value={ext.value.join("\n")} copyable={ext.value.length > 0} />
        ))}
      </div>
    </article>
  );
};
