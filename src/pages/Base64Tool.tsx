import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

const Base64Tool = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const encode = () => {
    try {
      setOutput(btoa(input));
      toast.success("Encoded");
    } catch {
      toast.error("Failed to encode");
    }
  };

  const decode = () => {
    try {
      setOutput(atob(input));
      toast.success("Decoded");
    } catch {
      toast.error("Invalid Base64 string");
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <ToolSEO title="Base64 Encoder & Decoder" description="Free online Base64 encoder and decoder. Convert text to Base64 and back instantly in your browser with no data sent to any server." canonicalPath="/base64" keywords={["Base64 encoder", "Base64 decoder", "encode Base64 online", "decode Base64", "Base64 converter"]} faq={[{question:"What is Base64 encoding?",answer:"Base64 is a binary-to-text encoding scheme that represents binary data as an ASCII string. It is commonly used for embedding images in HTML/CSS, encoding email attachments, and transmitting data over text-based protocols."},{question:"Is Base64 encoding secure?",answer:"Base64 is not encryption — it is a reversible encoding. Do not use it to protect sensitive data."}]} howToSteps={["Enter text in the input field","Click Encode to convert to Base64, or Decode to convert from Base64","Click Copy to copy the result"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground mb-6">Base64 Encode / Decode</h1>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Input</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter text or Base64 string..."
            className="min-h-[200px] font-mono text-sm bg-card border-border resize-none"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={encode}>Encode</Button>
          <Button variant="secondary" onClick={decode}>Decode</Button>
          <Button variant="outline" onClick={copy} disabled={!output}>Copy</Button>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Output</label>
          <Textarea
            value={output}
            readOnly
            className="min-h-[200px] font-mono text-sm bg-card border-border resize-none"
          />
        </div>
      </div>
    </div>
  );
};

export default Base64Tool;
