import { createCleanCopy, type CleanOptions } from "@/components/image-metadata/cleanUtils";

self.onmessage = async (event: MessageEvent<{ file: File; options: CleanOptions }>) => {
  try {
    const { file, options } = event.data;
    const result = await createCleanCopy(await file.arrayBuffer(), file, options);
    (self as unknown as Worker).postMessage({ result }, [result.output]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Unable to create a clean copy." });
  }
};
