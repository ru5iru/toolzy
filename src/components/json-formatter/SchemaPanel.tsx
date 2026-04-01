import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateJsonSchema, validateJsonAgainstSchema } from "./jsonUtils";
import { FileJson, CheckCircle2, XCircle } from "lucide-react";

interface SchemaPanelProps {
  parsedData: any | null;
}

export const SchemaPanel = ({ parsedData }: SchemaPanelProps) => {
  const [schema, setSchema] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);

  const handleGenerate = () => {
    if (parsedData === null) {
      toast.error("No valid JSON to generate schema from");
      return;
    }
    const s = generateJsonSchema(parsedData);
    setSchema(JSON.stringify(s, null, 2));
    setValidationErrors(null);
    toast.success("Schema generated");
  };

  const handleValidate = () => {
    if (parsedData === null) {
      toast.error("No valid JSON to validate");
      return;
    }
    try {
      const s = JSON.parse(schema);
      const errors = validateJsonAgainstSchema(parsedData, s);
      setValidationErrors(errors);
      if (errors.length === 0) toast.success("JSON is valid against schema");
      else toast.error(`${errors.length} validation error(s)`);
    } catch {
      toast.error("Invalid schema JSON");
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-lg bg-card border border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileJson className="w-3.5 h-3.5" /> JSON Schema
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerate} className="h-7 text-xs">Generate</Button>
          <Button variant="outline" size="sm" onClick={handleValidate} disabled={!schema} className="h-7 text-xs">Validate</Button>
        </div>
      </div>
      <Textarea
        value={schema}
        onChange={(e) => { setSchema(e.target.value); setValidationErrors(null); }}
        placeholder="Generate a schema from your JSON or paste one to validate against..."
        className="min-h-[120px] font-mono text-xs bg-background border-border resize-none"
      />
      {validationErrors !== null && (
        <div className="text-xs space-y-1">
          {validationErrors.length === 0 ? (
            <p className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Valid — JSON matches the schema</p>
          ) : (
            validationErrors.map((e, i) => (
              <p key={i} className="text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5 shrink-0" /> {e}</p>
            ))
          )}
        </div>
      )}
    </div>
  );
};
