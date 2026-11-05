import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Long explanatory text lives here, collapsed by default, so the tool stays the first thing on the page.
 * The content remains in the DOM for search engines and readers. See DESIGN.md §2.
 */
export const AboutTool = ({ title = "About this tool", children }: { title?: string; children: ReactNode }) => (
  <details className="group rounded-lg border border-border bg-card/50">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
      {title}
    </summary>
    <div className="space-y-6 border-t border-border p-4 max-w-3xl">{children}</div>
  </details>
);
