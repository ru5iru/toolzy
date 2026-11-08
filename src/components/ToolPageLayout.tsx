import { ReactNode } from "react";
import { PrivacyBadge } from "@/components/json-formatter/PrivacyBadge";

/**
 * ToolPageLayout — the single layout wrapper for every tool page.
 * See DESIGN.md §2 for the full spec.
 *
 * maxWidth values:
 *  - "fluid"  (default) — fills the full available area; use for every tool
 *             with an editor, table, or two-panel workspace.
 *  - "narrow" — max-w-3xl, mx-auto; for single-column forms only.
 *  - "wide"   — max-w-[1440px], mx-auto; for content-heavy pages on very wide screens.
 *  - "4xl"…"7xl" — specific overrides; prefer fluid.
 *
 * Page padding is owned by AppLayout (p-3 / sm:p-4 / lg:p-5).
 * Do NOT add outer padding inside tool pages.
 */
interface ToolPageLayoutProps {
  title: string;
  description?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  maxWidth?: "fluid" | "narrow" | "wide" | "4xl" | "5xl" | "6xl" | "7xl";
}

const maxWidthClass: Record<NonNullable<ToolPageLayoutProps["maxWidth"]>, string> = {
  fluid:  "w-full",
  narrow: "max-w-3xl mx-auto w-full",
  wide:   "max-w-[1440px] mx-auto w-full",
  "4xl":  "max-w-4xl mx-auto w-full",
  "5xl":  "max-w-5xl mx-auto w-full",
  "6xl":  "max-w-6xl mx-auto w-full",
  "7xl":  "max-w-7xl mx-auto w-full",
};

export const ToolPageLayout = ({
  title,
  description,
  toolbar,
  children,
  maxWidth = "fluid",
}: ToolPageLayoutProps) => (
  <div className={`${maxWidthClass[maxWidth]} space-y-4`}>
    <header className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-foreground leading-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{description}</p>
        )}
      </div>
      <PrivacyBadge />
    </header>
    {toolbar && (
      <div className="flex items-center gap-1.5 flex-wrap -mt-2">
        {toolbar}
      </div>
    )}
    {children}
  </div>
);
