/**
 * Pages are left-aligned so the left edge matches across tools.
 * Page width tiers (see DESIGN.md §2). One source of truth so every tool page uses the same container.
 * - fluid:  data-heavy, side-by-side tools; use the whole content area
 * - wide:   capped at 1440 px for very wide screens (unused today; prefer fluid)
 * - narrow: single-purpose forms
 */
export type ToolWidth = "fluid" | "wide" | "narrow";

const widthClass: Record<ToolWidth, string> = {
  fluid: "max-w-none",
  wide: "max-w-[1440px]",
  narrow: "max-w-3xl",
};

export const toolPageClass = (width: ToolWidth = "fluid") => `w-full space-y-4 ${widthClass[width]}`;
