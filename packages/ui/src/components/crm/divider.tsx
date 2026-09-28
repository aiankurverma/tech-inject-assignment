import * as React from "react";
import { cn } from "@/lib/utils";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  /** Optional text on a horizontal divider. */
  label?: React.ReactNode;
  /** Where the label sits along the line. */
  align?: "start" | "center" | "end";
  variant?: "solid" | "dashed";
  /** Purely visual: hidden from assistive technology. */
  decorative?: boolean;
}

/** Thin rule that separates content, optionally with a label. */
export function Divider({
  orientation = "horizontal",
  label,
  align = "center",
  variant = "solid",
  decorative = false,
  className,
  ...props
}: DividerProps) {
  const a11y = decorative
    ? { role: "none" as const }
    : { role: "separator" as const, "aria-orientation": orientation };
  const line = variant === "dashed" ? "border-dashed" : "border-solid";
  if (orientation === "vertical") {
    return (
      <div
        {...a11y}
        className={cn("mx-2 w-0 self-stretch border-l border-crm-border", line, className)}
        {...props}
      />
    );
  }
  if (!label) {
    return (
      <div
        {...a11y}
        className={cn("h-0 w-full border-t border-crm-border", line, className)}
        {...props}
      />
    );
  }
  return (
    <div {...a11y} className={cn("flex w-full items-center gap-3 font-crm", className)} {...props}>
      <span
        aria-hidden
        className={cn("h-0 border-t border-crm-border", line, align === "start" ? "w-4" : "flex-1")}
      />
      <span className="shrink-0 crm-eyebrow text-crm-subtle uppercase">{label}</span>
      <span
        aria-hidden
        className={cn("h-0 border-t border-crm-border", line, align === "end" ? "w-4" : "flex-1")}
      />
    </div>
  );
}
