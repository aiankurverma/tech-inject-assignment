import * as React from "react";
import { cn } from "@/lib/utils";
import {
  formatPct,
  formatQuantity,
  type MeterSummary,
} from "@/components/crm/pro-usage-metering-dashboard/types";

/** Accessible meter bar: solid = used, hatched = forecast, ticks = alert thresholds. */
export function QuotaBar({ summary, className }: { summary: MeterSummary; className?: string }) {
  const { meter, used, projected, ratio, projectedRatio, breached } = summary;
  if (meter.limit === undefined) {
    return (
      <p className={cn("text-xs text-crm-muted-fg", className)}>
        {formatQuantity(used, meter.unit)} used - no limit on this plan
      </p>
    );
  }
  const usedPct = Math.min(100, (ratio ?? 0) * 100);
  const projPct = Math.min(100, (projectedRatio ?? 0) * 100);
  const over = (ratio ?? 0) >= 1;
  const tone = over ? "bg-crm-danger" : breached !== null ? "bg-crm-warning" : "bg-crm-primary";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="meter"
        aria-label={`${meter.name} quota`}
        aria-valuemin={0}
        aria-valuemax={meter.limit}
        aria-valuenow={Math.min(used, meter.limit)}
        aria-valuetext={`${formatQuantity(used, meter.unit)} of ${formatQuantity(meter.limit, meter.unit)} (${formatPct(ratio)}), forecast ${formatPct(projectedRatio)}`}
        className="relative h-2 overflow-hidden rounded-full bg-crm-track"
      >
        <div
          className="absolute inset-y-0 left-0 bg-crm-soft/30 [background-image:repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.18)_3px_6px)]"
          style={{ width: `${projPct}%` }}
        />
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width]", tone)}
          style={{ width: `${usedPct}%` }}
        />
        {(meter.alertThresholds ?? []).map((t) => (
          <span
            key={t}
            className="absolute inset-y-0 w-px bg-crm-fg/60"
            style={{ left: `${Math.min(100, t * 100)}%` }}
            aria-hidden
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-crm-muted-fg">
        <span>
          <span className="text-crm-fg">{formatQuantity(used)}</span> /{" "}
          {formatQuantity(meter.limit, meter.unit)}
        </span>
        <span className={cn((projectedRatio ?? 0) >= 1 && "text-crm-danger")}>
          Forecast {formatQuantity(projected)} ({formatPct(projectedRatio)})
        </span>
      </div>
    </div>
  );
}
