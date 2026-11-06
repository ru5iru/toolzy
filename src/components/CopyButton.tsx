import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children" | "value"> {
  /** Text to copy (or a function producing it lazily). */
  value: string | (() => string);
  /** Visible label; omit for an icon-only button. */
  label?: string;
  /** Accessible name when icon-only. */
  ariaLabel?: string;
  /** Toast message on success. */
  message?: string;
}

/** One copy control for the whole app: icon swaps to a check for 1.5 s and a toast confirms. */
export function CopyButton({ value, label, ariaLabel = "Copy", message = "Copied to clipboard", variant = "ghost", size, disabled, ...rest }: CopyButtonProps) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof value === "function" ? value() : value);
      setDone(true);
      toast.success(message);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Copy failed. Select the text and copy it manually.");
    }
  };

  const Icon = done ? Check : Copy;
  return (
    <Button type="button" variant={variant} size={size ?? (label ? "sm" : "icon")} disabled={disabled} onClick={copy} aria-label={label ? undefined : ariaLabel} {...rest}>
      <Icon className={done ? "text-success" : undefined} />
      {label && <span>{done ? "Copied" : label}</span>}
    </Button>
  );
}
