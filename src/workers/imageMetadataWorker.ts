import { inspectImage } from "@/components/image-metadata/metadataUtils";

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    const result = await inspectImage(await file.arrayBuffer(), file);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Unable to inspect image metadata." });
  }
};