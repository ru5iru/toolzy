import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

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
      <ToolSEO title="JSON Formatter & Validator" description="Free online JSON formatter, validator, and minifier. Paste your JSON to format, beautify, or compress it instantly in your browser." canonicalPath="/json" keywords={["JSON formatter", "JSON validator", "JSON beautifier", "JSON minifier", "format JSON online"]} faq={[{question:"How do I format JSON online?",answer:"Paste your JSON into the input field and click Format. The tool will parse, validate, and pretty-print your JSON with proper indentation."},{question:"Does this JSON formatter send my data to a server?",answer:"No. All JSON formatting and validation happens entirely in your browser — your data never leaves your machine."}]} howToSteps={["Paste your JSON into the input textarea","Click Format to beautify or Minify to compress","Click Copy to copy the result to your clipboard"]} />
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
