import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
