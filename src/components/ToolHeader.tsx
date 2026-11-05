import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PrivacyBadge } from "@/components/json-formatter/PrivacyBadge";

interface ToolHeaderProps {
  title: string;
  /** One plain line saying what the tool does. */
  description?: ReactNode;
  icon?: LucideIcon;
  /** Right-aligned controls (history, clock, reset…). */
  actions?: ReactNode;
  /** Hide the "Local only" chip for tools that explain their own storage or network use. */
  hidePrivacy?: boolean;
}

/** The single page header used by every tool. See DESIGN.md §2. */
export const ToolHeader = ({ title, description, icon: Icon, actions, hidePrivacy }: ToolHeaderProps) => (
  <header className="mb-4 flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <div className="flex min-w-0 items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />}
      <div className="min-w-0">
        <h1 className="font-mono text-base font-semibold leading-6 text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {actions}
      {!hidePrivacy && <PrivacyBadge />}
    </div>
  </header>
);
