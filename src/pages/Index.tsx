import { useNavigate } from "react-router-dom";
import { Braces, Binary, Link, Fingerprint, Palette, KeyRound, GitCompare, Users, FileText, Hash, Clock, Regex } from "lucide-react";

const tools = [
  { title: "JSON Formatter", description: "Format, validate & minify JSON", url: "/json", icon: Braces },
  { title: "Base64", description: "Encode & decode Base64 strings", url: "/base64", icon: Binary },
  { title: "URL Encode", description: "Encode & decode URL components", url: "/url-encode", icon: Link },
  { title: "UUID Generator", description: "Generate v4 UUIDs instantly", url: "/uuid", icon: Fingerprint },
  { title: "Color Converter", description: "Convert between HEX, RGB & HSL", url: "/color", icon: Palette },
  { title: "JWT Decoder", description: "Decode JWTs with expiry visualization", url: "/jwt", icon: KeyRound },
  { title: "API Diff", description: "Compare JSON responses & spot differences", url: "/diff", icon: GitCompare },
  { title: "Fake Data", description: "Generate realistic test data in JSON", url: "/fake-data", icon: Users },
  { title: "Env Generator", description: "Build .env files from templates", url: "/env", icon: FileText },
  { title: "Hash Generator", description: "SHA-1, SHA-256, SHA-384, SHA-512", url: "/hash", icon: Hash },
  { title: "Date & Time", description: "Timestamps, timezones & cron builder", url: "/datetime", icon: Clock },
  { title: "Regex Playground", description: "Live regex tester with match highlighting", url: "/regex", icon: Regex },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-mono font-bold text-foreground mb-2">Developer Tools</h1>
        <p className="text-muted-foreground">A collection of handy utilities for everyday development.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <button
            key={tool.url}
            onClick={() => navigate(tool.url)}
            className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:bg-secondary"
          >
            <tool.icon className="h-6 w-6 text-primary" />
            <div>
              <div className="font-mono text-sm font-semibold text-card-foreground">{tool.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{tool.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Index;
