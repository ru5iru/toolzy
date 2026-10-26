import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Braces, Binary, Link, Fingerprint, Palette, KeyRound, GitCompare, Users, FileText, Hash, Clock, Regex, Search, X, FileSearch } from "lucide-react";
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
  { title: "Image Metadata Viewer", description: "Inspect EXIF, GPS, camera details, timestamps, and other image metadata privately in your browser.", url: "/image-metadata", icon: FileSearch },
];

const Index = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filteredTools = q
    ? tools.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    : tools;

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
      <header className="mb-10">
        <h1 className="text-3xl font-mono font-bold text-foreground mb-2">Toolzy — Free Online Developer Tools</h1>
        <p className="text-muted-foreground">A collection of fast, browser-based utilities for developers — 100% client-side, no sign-up required.</p>
      </header>
      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="sr-only">Available developer tools</h2>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            aria-label="Search developer tools"
            className="w-full h-10 rounded-lg border border-border bg-card pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {filteredTools.length === 0 && (
          <p className="text-sm text-muted-foreground mb-4">No tools match "{query}".</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <button
              key={tool.url}
              onClick={() => navigate(tool.url)}
              aria-label={`Open ${tool.title} — ${tool.description}`}
              className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:bg-secondary"
            >
              <tool.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <div>
                <div className="font-mono text-sm font-semibold text-card-foreground">{tool.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{tool.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
