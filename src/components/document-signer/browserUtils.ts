import { toast } from "sonner";
import { localObjectUrl } from "@/components/image-metadata/inspectionSession";

export function downloadBytes(filename: string, data: BlobPart | Uint8Array<ArrayBufferLike>, type = "application/octet-stream") {
  const bytes: BlobPart = data instanceof Uint8Array ? data.slice() : data;
  const resource = localObjectUrl(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.href = resource.url;
  anchor.download = filename;
  anchor.click();
  // Give the browser time to begin the download before releasing its URL.
  setTimeout(resource.release, 1000);
}

export async function copyText(value: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label);
  } catch {
    toast.error("Clipboard access failed. Select and copy the value manually.");
  }
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function shortFingerprint(fingerprint: string): string {
  return fingerprint.split(":").slice(0, 8).join(":") + "…";
}
