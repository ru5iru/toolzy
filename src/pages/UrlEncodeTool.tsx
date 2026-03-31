import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

const UrlEncodeTool = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const encode = () => {
    setOutput(encodeURIComponent(input));
    toast.success("Encoded");
  };

  const decode = () => {
    try {
      setOutput(decodeURIComponent(input));
      toast.success("Decoded");
    } catch {
      toast.error("Invalid encoded string");
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <ToolSEO title="URL Encoder & Decoder" description="Free online URL encoder and decoder. Encode special characters for URLs or decode percent-encoded strings instantly." canonicalPath="/url-encode" keywords={["URL encoder", "URL decoder", "percent encoding", "encodeURIComponent", "URL encode online"]} faq={[{question:"What is URL encoding?",answer:"URL encoding (percent-encoding) replaces special characters with a % sign followed by two hex digits, making strings safe for use in URLs."},{question:"When should I URL encode?",answer:"Encode query parameters, form data, and any user input that will be included in a URL to prevent parsing errors and injection attacks."}]} howToSteps={["Enter text in the input field","Click Encode to URL-encode or Decode to URL-decode","Click Copy to copy the result"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground mb-6">URL Encode / Decode</h1>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Input</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter URL or encoded string..."
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

export default UrlEncodeTool;
