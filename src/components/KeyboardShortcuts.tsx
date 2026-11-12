import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Platform-aware modifier label. */
const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent)
  ? "⌘"
  : "Ctrl";

const GLOBAL: [string, string][] = [
  ["Open command palette", `${mod} K`],
  ["Toggle light / dark theme", `${mod} Shift L`],
  ["Show keyboard shortcuts", "?"],
];

const BY_TOOL: [string, string][] = [
  ["Markdown Editor — save", `${mod} S`],
  ["Markdown Editor — open file", `${mod} O`],
  ["Markdown Editor — find & replace", `${mod} F`],
  ["Markdown Editor — focus mode", "Alt F"],
  ["Markdown Editor — toggle view", "Alt 1 / 2 / 3"],
  ["Encoding Hub — convert", `${mod} Enter`],
  ["API Diff — compare", `${mod} Enter`],
];

function Shortcut({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-b-0">
      <span className="text-sm">{label}</span>
      <kbd className="shrink-0 font-mono text-xs bg-secondary text-secondary-foreground rounded border border-border px-2 py-0.5 whitespace-nowrap">{keys}</kbd>
    </div>
  );
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName);
      if (e.key === "?" && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 font-mono text-xs"
        aria-label="Keyboard shortcuts (?)"
        onClick={() => setOpen(true)}
      >
        <Keyboard className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Use {mod} on Mac or Ctrl on Windows/Linux.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-1">
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Global</p>
              {GLOBAL.map(([label, keys]) => <Shortcut key={label} label={label} keys={keys} />)}
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Per-tool</p>
              {BY_TOOL.map(([label, keys]) => <Shortcut key={label} label={label} keys={keys} />)}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
