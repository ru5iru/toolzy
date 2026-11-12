import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Braces, FileCode2, KeyRound, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const POPULAR = [
  { title: "JSON Formatter", url: "/json", icon: Braces },
  { title: "HTML Editor", url: "/html-editor", icon: FileCode2 },
  { title: "JWT Hub", url: "/jwt", icon: KeyRound },
  { title: "Document Signer", url: "/document-signer", icon: ShieldCheck },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Minimal top bar matching ToolPageLayout */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors">
          <span className="font-mono text-primary">toolzy</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="font-mono text-6xl font-bold text-primary mb-2" aria-hidden="true">404</p>
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-1">
          <span className="font-mono break-all">{location.pathname}</span> doesn't exist.
        </p>
        <p className="text-sm text-muted-foreground mb-8">It may have been removed or the URL might be wrong.</p>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <Button asChild>
            <Link to="/"><ArrowLeft />Back to all tools</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/?q="><Search />Search tools</Link>
          </Button>
        </div>

        <section aria-labelledby="popular-heading">
          <h2 id="popular-heading" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Popular tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl w-full">
            {POPULAR.map(({ title, url, icon: Icon }) => (
              <Link
                key={url}
                to={url}
                className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:border-primary hover:bg-secondary transition-colors"
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-medium text-center leading-tight">{title}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFound;
