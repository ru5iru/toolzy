import { useNavigate } from "react-router-dom";
import { Braces, Binary, Link, Fingerprint, Palette, KeyRound, GitCompare, Users, FileText, Hash, Clock, Regex } from "lucide-react";
import { ToolSEO } from "@/components/ToolSEO";

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
      <ToolSEO
        title="Toolzy"
        description="Toolzy — Free collection of online developer tools. JSON formatter, Base64 encoder, UUID generator, JWT decoder, regex tester, hash generator, color converter, and more. 100% client-side."
        canonicalPath="/"
        keywords={["developer tools", "online dev tools", "free developer utilities", "web developer tools", "JSON formatter", "Base64 encoder", "UUID generator"]}
        faq={[
          { question: "What developer tools are available?", answer: "Toolzy offers 12+ free utilities including JSON formatter, Base64 encoder/decoder, URL encoder, UUID generator, color converter, JWT decoder, API diff tool, fake data generator, env file builder, hash generator, date/time toolkit, and regex playground." },
          { question: "Are these developer tools free?", answer: "Yes, all tools are 100% free, run entirely in your browser, and require no sign-up or installation." },
          { question: "Is my data safe?", answer: "All processing happens client-side in your browser. No data is sent to any server." },
        ]}
      />
      <div className="mb-10">
        <h1 className="text-3xl font-mono font-bold text-foreground mb-2">Toolzy</h1>
        <p className="text-muted-foreground">Free developer tools — 100% client-side, no sign-up required.</p>
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
