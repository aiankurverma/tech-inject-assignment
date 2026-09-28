import * as React from "react";
import { cn } from "@/lib/utils";

export type PresenceStatus = "online" | "away" | "busy" | "offline";

const colors: Record<PresenceStatus, string> = {
  online: "bg-crm-success",
  away: "bg-crm-warning",
  busy: "bg-crm-danger",
  offline: "bg-crm-faint",
};

const labels: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

const sizes = { sm: "size-1.5", md: "size-2", lg: "size-2.5" } as const;

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: PresenceStatus;
  size?: keyof typeof sizes;
  /** Soft pulsing halo for live states. Hidden when the user prefers reduced motion. */
  pulse?: boolean;
  /** Render the status text next to the dot. */
  showLabel?: boolean;
  /** Overrides the default text ("Online", "Away", ...). */
  label?: string;
}

/** Small coloured dot for presence or live status, always with a text alternative. */
export function StatusDot({
  status = "online",
  size = "md",
  pulse = false,
  showLabel = false,
  label,
  className,
  ...props
}: StatusDotProps) {
  const text = label ?? labels[status];
  return (
    <span
      role="img"
      aria-label={text}
      className={cn(
        "inline-flex items-center gap-1.5 font-crm crm-caption text-crm-soft",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("relative inline-flex shrink-0", sizes[size])}>
        {pulse ? (
          <span
            className={cn(
              "absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden",
              colors[status],
            )}
          />
        ) : null}
        <span className={cn("relative size-full rounded-full", colors[status])} />
      </span>
      {showLabel ? <span aria-hidden>{text}</span> : null}
    </span>
  );
}
