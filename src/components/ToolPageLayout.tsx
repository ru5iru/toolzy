import { ReactNode } from "react";
import { PrivacyBadge } from "@/components/json-formatter/PrivacyBadge";

interface ToolPageLayoutProps {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
  maxWidth?: "4xl" | "5xl" | "6xl" | "7xl";
}

const maxWidthClass = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export const ToolPageLayout = ({ title, toolbar, children, maxWidth = "6xl" }: ToolPageLayoutProps) => (
  <div className={`${maxWidthClass[maxWidth]} mx-auto`}>
    <header className="flex items-center justify-between mb-2 gap-2 flex-wrap">
      <h1 className="text-lg font-mono font-bold text-foreground">{title}</h1>
      <PrivacyBadge />
    </header>
    {toolbar && <div className="mb-2">{toolbar}</div>}
    {children}
  </div>
);
