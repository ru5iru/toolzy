import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Braces, Binary, Link, Fingerprint, Palette, KeyRound, GitCompare, Users, FileText, Hash, Clock, Regex, Search, X, FileSearch, FileSignature, ScrollText, Type, FileCode2 } from "lucide-react";
import { ToolSEO } from "@/components/ToolSEO";

const tools = [
  { title: "HTML Editor", description: "WYSIWYG editor with live HTML source, tables, links, local image embed, and instant download", url: "/html-editor", icon: FileCode2 },
  { title: "Markdown Editor", description: "Write Markdown with live preview, slash suggestions, local autosave, and HTML exports", url: "/markdown", icon: FileText },
  { title: "JSON Formatter", description: "Format, validate & minify JSON — tree view, sort keys, schema inference, CSV/XML/YAML export", url: "/json", icon: Braces },
  { title: "Base64 & Encoding", description: "Encode & decode Base64, URL-safe Base64, URL components, Data URLs, and Unicode", url: "/base64", icon: Binary },
  { title: "JWT Hub", description: "Decode, verify & encode JWTs — security scoring, algorithm details, expiry visualization", url: "/jwt", icon: KeyRound },
  { title: "Crypto Suite", description: "SHA hashes, UUID v1–v5, password generator with strength meter, and secure secrets", url: "/uuid", icon: Fingerprint },
  { title: "Color Converter", description: "Convert HEX/RGB/HSL/HSV/CMYK, build palettes, check contrast, extract from images", url: "/color", icon: Palette },
  { title: "API Diff", description: "Deep-compare JSON/YAML responses — structured diff, ignore rules, Markdown export", url: "/diff", icon: GitCompare },
  { title: "Fake Data Generator", description: "Generate realistic test data in JSON, CSV, SQL, YAML or NDJSON with Faker.js templates", url: "/fake-data", icon: Users },
  { title: "Env Generator", description: "Build .env files from templates — parse, convert to JSON, strip to .example", url: "/env", icon: FileText },
  { title: "Hash Generator", description: "SHA-1, SHA-256, SHA-384, SHA-512 hashes via Web Crypto — file and text input", url: "/hash", icon: Hash },
  { title: "Date & Time", description: "Unix timestamp ↔ date, timezone converter, cron expression builder", url: "/datetime", icon: Clock },
  { title: "Regex Playground", description: "Live regex tester — real-time match highlighting, capture groups, replace preview, snippet library", url: "/regex", icon: Regex },
  { title: "Image Metadata Viewer", description: "Inspect EXIF, GPS, camera details and timestamps — strip metadata, all locally in your browser", url: "/image-metadata", icon: FileSearch },
  { title: "Document Signer", description: "Sign files and verify detached signatures with RSA-PSS or ECDSA keys, privately in your browser", url: "/document-signer", icon: FileSignature },
  { title: "Text Utilities", description: "Change case, sort and dedupe lines, slugify, number lines, and count words & characters", url: "/text", icon: Type },
  { title: "Certificate Inspector", description: "Decode X.509 certificates and CSRs: subject, issuer, validity, SANs, key usage, fingerprints", url: "/certificate", icon: ScrollText },
  { title: "URL Encode", description: "Encode & decode URL components and full URLs", url: "/url-encode", icon: Link },
];

const Index = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Launcher behaviour: search is ready on load, and "/" focuses it from anywhere on the page.
  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "/" && !(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const q = query.trim().toLowerCase();
  const filteredTools = q
    ? tools.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    : tools;

  return (
    <div className="max-w-[1600px]">
      <ToolSEO
        title="Toolzy — Free Online Developer Tools"
        description="Toolzy offers 16+ free browser-based developer tools: JSON formatter, Base64 encoder, UUID generator, JWT decoder, regex tester, hash generator, color converter, HTML editor, text utilities, and more. No sign-up. Nothing uploaded."
        canonicalPath="/"
        isApp={false}
        keywords={["developer tools", "online dev tools", "free developer utilities", "web developer tools", "JSON formatter", "Base64 encoder", "UUID generator", "JWT decoder", "regex tester", "hash generator"]}
        faq={[
          { question: "What developer tools does Toolzy offer?", answer: "Toolzy offers 16+ free utilities including a JSON formatter & validator, Base64 encoder/decoder, URL encoder, UUID generator, color converter, JWT decoder & encoder, API diff tool, fake data generator, env file builder, hash generator, date/time toolkit, regex playground, text utilities, Markdown editor, HTML WYSIWYG editor, image metadata viewer, document signer, and certificate inspector." },
          { question: "Are these developer tools free?", answer: "Yes. All tools are 100% free, run entirely in your browser, and require no sign-up or installation." },
          { question: "Is my data safe when using Toolzy?", answer: "Yes. All processing happens client-side in your browser using the Web Crypto API and local JavaScript. No data, files, or keys are ever sent to any server." },
          { question: "Do the tools work offline?", answer: "Yes. After the page loads, all tools work without a network connection. The only exceptions are static locale files that the Fake Data Generator downloads on demand." },
          { question: "Which formats can the JSON Formatter export?", answer: "The JSON Formatter can export formatted JSON as well as CSV, XML, and YAML. It can also generate a JSON Schema from any JSON payload." },
        ]}
      />
      <header className="mb-4">
        <h1 className="font-mono text-lg font-semibold text-foreground">Toolzy</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Free developer tools that run in your browser. No sign-up, nothing uploaded.</p>
      </header>
      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="sr-only">Available developer tools</h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              if (e.key === "Enter" && filteredTools.length > 0) navigate(filteredTools[0].url);
            }}
            placeholder="Search tools…  (press / to focus, Enter to open)"
            aria-label="Search developer tools"
            className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-9 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-[hsl(var(--border-hover))] focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {filteredTools.length === 0 && (
          <p className="text-sm text-muted-foreground mb-4" role="status">No tools match "{query}".</p>
        )}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredTools.map((tool) => (
            <li key={tool.url}>
              <RouterLink
                to={tool.url}
                aria-label={`Open ${tool.title} — ${tool.description}`}
                className="group flex h-full items-start gap-3 rounded-lg border border-border bg-card p-3.5 transition-[border-color,background-color,transform] duration-150 hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary transition-colors group-hover:bg-primary/15">
                  <tool.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-semibold text-card-foreground">{tool.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{tool.description}</span>
                </span>
              </RouterLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Index;
