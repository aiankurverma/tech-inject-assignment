import * as React from "react";
import { cn } from "@/lib/utils";

const sizes = { xs: "size-3", sm: "size-4", md: "size-5", lg: "size-8" } as const;
const tones = {
  default: "text-crm-soft",
  primary: "text-crm-primary",
  inherit: "text-current",
} as const;

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  /** Announced to screen readers. Pass an empty string when a parent already announces loading. */
  label?: string;
}

/** Circular loading indicator. Slows down instead of disappearing under reduced motion. */
export function Spinner({
  size = "sm",
  tone = "default",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "status" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "shrink-0 animate-spin motion-reduce:[animation-duration:2.5s]",
        sizes[size],
        tones[tone],
        className,
      )}
      {...props}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path
        d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
