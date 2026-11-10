import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toolNav } from "@/components/toolNav";

/** Extra search words so "base64", "uuid", "cron" and similar land on the right tool. */
const aliases: Record<string, string> = {
  "/encode": "base64 url encode decode html entities",
  "/crypto": "hash sha md5 hmac uuid password secrets",
  "/jwt": "token jws jwk decode encode",
  "/datetime": "timestamp unix timezone cron date",
  "/json": "validate minify yaml csv xml schema",
  "/color": "hex rgb hsl palette contrast",
  "/diff": "compare api response",
  "/certificate": "x509 csr pem tls ssl",
  "/document-signer": "sign verify signature pdf",
  "/image-metadata": "exif gps strip",
  "/text": "case slug sort dedupe lines count",
  "/sql": "sql formatter mysql postgresql sqlite tsql plsql bigquery snowflake beautifier",
  "/number-base": "binary decimal hex octal bitwise base converter",
  "/cron": "cron expression schedule crontab aws github actions timer",
  "/text-diff": "diff compare text code side by side unified patch",
  "/yaml": "yaml json toml convert config format converter",
  "/chmod": "chmod permissions octal unix linux file permission calculator",
  "/password": "password generator passphrase secure random crypto entropy strength",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (url: string) => { setOpen(false); navigate(url); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search tools (Ctrl or Command K)"
        className="ml-auto flex h-8 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:border-[hsl(var(--border-hover))] hover:text-foreground">
        <Search className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Search tools</span>
        <kbd className="hidden rounded border border-border px-1 font-mono text-[11px] sm:inline">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a tool…" />
        <CommandList>
          <CommandEmpty>No matching tool.</CommandEmpty>
          <CommandGroup heading="Tools">
            {[{ title: "Home", url: "/", icon: Search }, ...toolNav].map((t) => (
              <CommandItem key={t.url} value={`${t.title} ${aliases[t.url] ?? ""}`} onSelect={() => go(t.url)}>
                <t.icon className="mr-2 h-4 w-4 text-primary" aria-hidden />{t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
