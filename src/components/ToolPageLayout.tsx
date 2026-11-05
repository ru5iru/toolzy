import type { ComponentProps, ReactNode } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { toolPageClass, type ToolWidth } from "@/lib/toolLayout";

interface ToolPageLayoutProps extends Omit<ComponentProps<typeof ToolHeader>, "title"> {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
  width?: ToolWidth;
}

/** Standard tool page: header, optional toolbar, then content on a 16 px rhythm. */
export const ToolPageLayout = ({ title, toolbar, children, width = "fluid", ...header }: ToolPageLayoutProps) => (
  <div className={toolPageClass(width)}>
    <ToolHeader title={title} {...header} />
    {toolbar && <div>{toolbar}</div>}
    {children}
  </div>
);
