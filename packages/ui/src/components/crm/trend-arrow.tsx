import * as React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrendArrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Change amount; the sign sets the direction. */
  value: number;
  /** How the number is printed. */
  format?: "percent" | "number";
  /** When true, a decrease is good (e.g. churn, cost) and is coloured green. */
  inverse?: boolean;
  /** Render as a tinted pill instead of plain text. */
  variant?: "plain" | "pill";
  size?: "sm" | "md";
  /** Extra context for screen readers, e.g. "vs last month". */
  context?: string;
}

/** Up/down delta indicator with direction-aware colour and a spoken description. */
export function TrendArrow({
  value,
  format = "percent",
  inverse = false,
  variant = "plain",
  size = "md",
  context,
  className,
  ...props
}: TrendArrowProps) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const good = dir === "flat" ? null : (dir === "up") !== inverse;
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : ArrowRight;
  const abs = Math.abs(value);
  const text =
    format === "percent"
      ? `${abs.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
      : abs.toLocaleString();
  const spoken = `${dir === "up" ? "Up" : dir === "down" ? "Down" : "No change"}${dir === "flat" ? "" : ` ${text}`}${context ? ` ${context}` : ""}`;
  return (
    <span
      role="img"
      aria-label={spoken}
      className={cn(
        "inline-flex items-center gap-0.5 font-crm font-medium tabular-nums",
        size === "md" ? "text-xs" : "text-[11px]",
        good === null ? "text-crm-soft" : good ? "text-crm-trend" : "text-crm-danger",
        variant === "pill" &&
          cn(
            "rounded-full border px-1.5 py-0.5",
            good === null
              ? "border-tag-neutral-border bg-tag-neutral-bg"
              : good
                ? "border-tag-green-border bg-tag-green-bg"
                : "border-tag-red-border bg-tag-red-bg",
          ),
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className={size === "md" ? "size-3.5" : "size-3"} />
      <span aria-hidden>{text}</span>
    </span>
  );
}
