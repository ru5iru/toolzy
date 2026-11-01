import { inspectImage, type RemovalInfo } from "@/components/image-metadata/metadataUtils";
import { presentKinds, scanStructure } from "@/components/image-metadata/cleanUtils";

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    const buffer = await file.arrayBuffer();
    const result = await inspectImage(buffer, file);
    let removal: RemovalInfo;
    try { const s = scanStructure(new Uint8Array(buffer)); removal = { kinds: presentKinds(s), orientation: s.orientation, animated: s.animated }; }
    catch (error) { removal = { error: error instanceof Error ? error.message : "Metadata removal is unavailable for this file." }; }
    self.postMessage({ result: { ...result, removal } });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Unable to inspect image metadata." });
  }
};
