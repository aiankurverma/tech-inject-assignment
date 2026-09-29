import * as React from "react";
import { Clock, Pause } from "lucide-react";
import {
  businessMsBetween,
  formatDuration,
  isWithinBusinessHours,
  type ResolvedBusinessHours,
} from "@/components/crm/pro-ticket-console/business-hours";
import { useSharedClock } from "@/hooks/use-shared-clock";
import { cn } from "@/lib/utils";

export interface SlaTimerProps {
  /** SLA deadline (already computed in business time). */
  dueAt: number | null;
  /** Total business minutes of the target, for the "at risk" threshold. */
  targetMinutes: number;
  hours: ResolvedBusinessHours;
  /** Paused when the ticket waits on the customer or is solved. */
  paused?: boolean;
  now?: Date;
  compact?: boolean;
  className?: string;
}

/** Live countdown in business time; only this leaf re-renders each second. */
export const SlaTimer = React.memo(function SlaTimer({
  dueAt,
  targetMinutes,
  hours,
  paused,
  now: frozen,
  compact,
  className,
}: SlaTimerProps) {
  const now = useSharedClock(1000, frozen);
  if (dueAt === null) return null;
  const left = businessMsBetween(now, dueAt, hours);
  const breached = left <= 0;
  const atRisk = !breached && left < targetMinutes * 60_000 * 0.25;
  const outside = !isWithinBusinessHours(now, hours);
  const label = paused
    ? "SLA paused"
    : breached
      ? `SLA breached by ${formatDuration(-left)}`
      : `${formatDuration(left)} business time left${outside ? " (clock stopped outside hours)" : ""}`;
  return (
    <span
      role="timer"
      aria-live="off"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        paused
          ? "bg-crm-muted text-crm-muted-fg"
          : breached
            ? "bg-crm-danger/15 text-crm-danger"
            : atRisk
              ? "bg-crm-warning/15 text-crm-warning"
              : "bg-crm-success/10 text-crm-success",
        className,
      )}
    >
      {paused || outside ? (
        <Pause className="size-3" aria-hidden />
      ) : (
        <Clock className="size-3" aria-hidden />
      )}
      {paused ? (compact ? "paused" : "SLA paused") : formatDuration(left)}
    </span>
  );
});
