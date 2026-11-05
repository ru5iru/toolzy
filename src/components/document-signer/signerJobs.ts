import { signDocument, type SignDocumentInput, type SignDocumentResult } from "./signingUtils";
import { verifyDocument, type VerifyDocumentInput, type VerifyResult } from "./verifyUtils";

export type SignerJob =
  | { op: "sign"; input: SignDocumentInput }
  | { op: "verify"; input: VerifyDocumentInput };

export type SignerJobResult =
  | { op: "sign"; result: SignDocumentResult }
  | { op: "verify"; result: VerifyResult };

/** The one entry point used both on the main thread and inside the worker. */
export async function runSignerJob(job: SignerJob): Promise<SignerJobResult> {
  return job.op === "sign"
    ? { op: "sign", result: await signDocument(job.input) }
    : { op: "verify", result: await verifyDocument(job.input) };
}
