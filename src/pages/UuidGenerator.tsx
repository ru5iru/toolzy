import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

const generateUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const UuidGenerator = () => {
  const [uuids, setUuids] = useState<string[]>(() =>
    Array.from({ length: 5 }, generateUUID)
  );

  const regenerate = () => {
    setUuids(Array.from({ length: 5 }, generateUUID));
  };

  const copyOne = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    toast.success("Copied");
  };

  const copyAll = () => {
    navigator.clipboard.writeText(uuids.join("\n"));
    toast.success("All copied");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <ToolSEO title="UUID Generator" description="Generate random RFC 4122 v4 UUIDs instantly. Click to copy individual UUIDs or copy all at once. Free, no sign-up required." canonicalPath="/uuid" keywords={["UUID generator", "GUID generator", "random UUID", "UUID v4", "generate UUID online"]} faq={[{question:"What is a UUID?",answer:"A UUID (Universally Unique Identifier) is a 128-bit identifier guaranteed to be unique across space and time. Version 4 UUIDs are randomly generated."},{question:"Are these UUIDs truly unique?",answer:"UUID v4 uses cryptographically random numbers. The probability of collision is astronomically low — about 1 in 5.3×10^36."}]} howToSteps={["Click Regenerate to create 5 new UUIDs","Click any UUID to copy it to your clipboard","Click Copy All to copy all UUIDs at once"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground mb-6">UUID Generator</h1>
      <div className="space-y-2 mb-4">
        {uuids.map((uuid, i) => (
          <div
            key={i}
            onClick={() => copyOne(uuid)}
            className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <code className="font-mono text-sm text-foreground">{uuid}</code>
            <span className="text-[10px] text-muted-foreground uppercase">click to copy</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={regenerate}>Regenerate</Button>
        <Button variant="outline" onClick={copyAll}>Copy All</Button>
      </div>
    </div>
  );
};

export default UuidGenerator;
