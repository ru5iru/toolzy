import type { ComponentProps, ReactNode } from "react";
import { ToolHeader } from "@/components/ToolHeader";

interface ToolPageLayoutProps extends Omit<ComponentProps<typeof ToolHeader>, "title"> {
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

/** Standard tool page: header, optional toolbar, then content on a 24 px rhythm. */
export const ToolPageLayout = ({ title, toolbar, children, maxWidth = "6xl", ...header }: ToolPageLayoutProps) => (
  <div className={`${maxWidthClass[maxWidth]} mx-auto space-y-5`}>
    <ToolHeader title={title} {...header} />
    {toolbar && <div>{toolbar}</div>}
    {children}
  </div>
);
