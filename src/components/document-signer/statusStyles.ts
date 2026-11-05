/** Semantic status colors built from the app's design tokens. */
export const toneClass = {
  success: "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success-foreground))]",
  warning: "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning-foreground))]",
  danger: "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 text-destructive",
  neutral: "border-border bg-secondary text-muted-foreground",
} as const;
