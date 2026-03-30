import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const JsonFormatter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const format = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      toast.success("JSON formatted");
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
      toast.error("Invalid JSON");
    }
  };

  const minify = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      toast.success("JSON minified");
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
      toast.error("Invalid JSON");
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-mono font-bold text-foreground mb-6">JSON Formatter</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Input</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"key": "value"}'
            className="min-h-[400px] font-mono text-sm bg-card border-border resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Output</label>
          <Textarea
            value={output}
            readOnly
            className="min-h-[400px] font-mono text-sm bg-card border-border resize-none"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button onClick={format}>Format</Button>
        <Button variant="secondary" onClick={minify}>Minify</Button>
        <Button variant="outline" onClick={copy} disabled={!output}>Copy</Button>
      </div>
    </div>
  );
};

export default JsonFormatter;
