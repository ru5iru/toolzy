import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { generateCodeExamples } from "./jwtUtils";

const LANGS = [
  { key: "nodejs", label: "Node.js" },
  { key: "php", label: "PHP" },
  { key: "python", label: "Python" },
  { key: "curl", label: "cURL" },
] as const;

export const CodeExamples = ({ token }: { token: string }) => {
  const [lang, setLang] = useState<string>("nodejs");
  const examples = generateCodeExamples(token);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {LANGS.map(l => (
          <button
            key={l.key}
            onClick={() => setLang(l.key)}
            className={`px-2 py-1 rounded text-xs font-mono transition-colors ${lang === l.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="bg-muted/50 border border-border rounded-lg p-3 font-mono text-xs overflow-auto max-h-[200px]">
          {examples[lang as keyof typeof examples]}
        </pre>
        <CopyButton
          value={() => examples[lang as keyof typeof examples]}
          message="Code copied"
          ariaLabel="Copy code"
          variant="ghost"
          size="icon"
          className="absolute top-1.5 right-1.5 h-6 w-6"
        />
      </div>
    </div>
  );
};
