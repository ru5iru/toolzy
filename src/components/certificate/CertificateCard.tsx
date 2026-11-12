import { MetaRow } from "@/components/document-signer/SignerControls";
import { toneClass } from "@/components/document-signer/statusStyles";
import { validityState, type ParsedCertificate } from "./certUtils";

const fmt = (d: Date) => d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

/** Human-readable duration for days (e.g. "1 year 3 months" or "47 days"). */
function humanDays(days: number): string {
  const abs = Math.abs(days);
  if (abs >= 365) {
    const years = Math.floor(abs / 365);
    const rem = Math.round((abs % 365) / 30);
    return rem > 0 ? `${years} yr ${rem} mo` : `${years} yr`;
  }
  if (abs >= 30) {
    const months = Math.floor(abs / 30);
    const remDays = abs % 30;
    return remDays > 0 ? `${months} mo ${remDays} d` : `${months} mo`;
  }
  return `${abs} day${abs === 1 ? "" : "s"}`;
}

export const CertificateCard = ({ cert, index, total }: { cert: ParsedCertificate; index: number; total?: number }) => {
  const validity = validityState(cert);
  const badge = validity && (validity.state === "valid"
    ? { text: `Valid · ${humanDays(validity.daysLeft)} left`, tone: validity.daysLeft < 30 ? toneClass.warning : toneClass.success }
    : validity.state === "expired" ? { text: `Expired ${humanDays(validity.daysLeft)} ago`, tone: toneClass.danger }
    : { text: "Not valid yet", tone: toneClass.warning });
  const cn = cert.subject.parts.find((p) => p.label === "CN")?.value;

  // Validity progress bar
  const lifetimePct = cert.notBefore && cert.notAfter
    ? Math.min(100, Math.max(0, Math.round(
        (Date.now() - cert.notBefore.getTime()) /
        (cert.notAfter.getTime() - cert.notBefore.getTime()) * 100
      )))
    : undefined;

  // Chain position label
  const chainLabel = total && total > 1
    ? index === 0 ? " · End-entity" : index === total - 1 ? " · Root CA" : " · Intermediate CA"
    : "";

  return (
    <article className="space-y-3 min-w-0" aria-label={`${cert.kind === "csr" ? "Request" : "Certificate"} ${index + 1}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-sm font-semibold break-all">
          {cert.kind === "csr" ? "Certificate request" : `Certificate ${index + 1}${chainLabel}`}{cn ? ` · ${cn}` : ""}
        </h2>
        {badge && <span className={`rounded-full border px-3 py-0.5 text-xs font-mono ${badge.tone}`}>{badge.text}</span>}
        {cert.selfIssued && <span className={`rounded-full border px-3 py-0.5 text-xs font-mono ${toneClass.neutral}`}>Self-issued</span>}
      </div>

      {/* Validity progress bar */}
      {lifetimePct !== undefined && cert.notAfter && validity && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Issued {fmt(cert.notBefore!)}</span>
            <span>Expires {fmt(cert.notAfter)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden" role="meter" aria-label={`${lifetimePct}% of certificate lifetime elapsed`} aria-valuenow={lifetimePct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`h-full rounded-full transition-all ${validity.state === "expired" ? "bg-destructive" : lifetimePct >= 85 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${Math.min(lifetimePct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{lifetimePct}% of lifetime elapsed</p>
        </div>
      )}

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
