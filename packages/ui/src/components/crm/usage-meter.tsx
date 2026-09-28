import * as React from "react";
import { cn } from "@/lib/utils";

export interface UsageMeterProps {
  label: string;
  used: number;
  /** Plan limit. null = unlimited. */
  limit: number | null;
  /** Unit label, e.g. "seats", "API calls", "GB". */
  unit?: string;
  /** Fraction (0-1) at which the meter turns amber. */
  warnAt?: number;
  /** Price per unit above the limit; shows a projected overage cost. */
  overageRate?: number;
  /** Units per overage billing block (e.g. 1000 calls). */
  overageBlock?: number;
  currency?: string;
  locale?: string;
  /** ISO date the usage period started, to project end-of-period usage. */
  periodStart?: string;
  /** ISO date the usage period resets. */
  periodEnd?: string;
  now?: Date;
  /** Compact numbers (12.4K) for large volumes. */
  compact?: boolean;
  loading?: boolean;
  action?: React.ReactNode;
  className?: string;
}

/** Seats/API usage vs plan limit with thresholds, overage cost, straight-line end-of-period projection and reset date. */
export function UsageMeter({
  label,
  used,
  limit,
  unit,
  warnAt = 0.8,
  overageRate,
  overageBlock = 1,
  currency = "USD",
  locale,
  periodStart,
  periodEnd,
  now,
  compact,
  loading,
  action,
  className,
}: UsageMeterProps) {
  const id = React.useId();
  const num = new Intl.NumberFormat(locale, compact ? { notation: "compact" } : undefined);
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const ratio = limit ? used / limit : 0;
  const tone =
    limit === null ? "ok" : ratio >= 1 ? "over" : ratio >= warnAt ? "warn" : ("ok" as const);
  const bar = { ok: "bg-crm-primary", warn: "bg-crm-warning", over: "bg-crm-danger" }[tone];

  const t = (now ?? new Date()).getTime();
  const start = periodStart ? new Date(periodStart).getTime() : NaN;
  const end = periodEnd ? new Date(periodEnd).getTime() : NaN;
  const projected =
    Number.isFinite(start) && Number.isFinite(end) && t > start && t < end
      ? Math.round((used / (t - start)) * (end - start))
      : null;
  const overUnits = limit !== null ? Math.max(0, used - limit) : 0;
  const overCost =
    overageRate !== undefined && overUnits > 0
      ? Math.ceil(overUnits / overageBlock) * overageRate
      : null;
  const projectedOver =
    projected !== null && limit !== null && projected > limit && overUnits === 0;
  const resets = Number.isFinite(end)
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(end))
    : null;
  const u = unit ? ` ${unit}` : "";

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 font-crm text-crm-fg", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span id={id} className="truncate text-xs font-medium">
          {label}
        </span>
        {loading ? (
          <span className="h-3 w-20 animate-pulse rounded bg-crm-muted" aria-hidden />
        ) : (
          <span className="shrink-0 text-xs tabular-nums">
            <span className={cn(tone === "over" && "text-crm-danger")}>{num.format(used)}</span>
            <span className="text-crm-soft">
              {" / "}
              {limit === null ? "Unlimited" : `${num.format(limit)}${u}`}
            </span>
          </span>
        )}
      </div>
      <div
        role="meter"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={limit === null ? used : Math.max(limit, used)}
        aria-valuenow={loading ? undefined : used}
        aria-valuetext={
          loading
            ? "Loading"
            : limit === null
              ? `${num.format(used)}${u}, unlimited`
              : `${num.format(used)} of ${num.format(limit)}${u}, ${Math.round(ratio * 100)}%`
        }
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-crm-track"
      >
        {loading ? (
          <span className="absolute inset-0 animate-pulse bg-crm-muted" />
        ) : limit !== null ? (
          <>
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
                bar,
              )}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
            {projected !== null && projected > used ? (
              <span
                className={cn("absolute inset-y-0 rounded-full opacity-30", bar)}
                style={{
                  left: `${Math.min(100, ratio * 100)}%`,
                  width: `${Math.max(0, Math.min(100, (projected / limit) * 100) - Math.min(100, ratio * 100))}%`,
                }}
              />
            ) : null}
            <span
              className="absolute inset-y-0 w-px bg-crm-fg/30"
              style={{ left: `${warnAt * 100}%` }}
              aria-hidden
            />
          </>
        ) : (
          <span className="absolute inset-y-0 left-0 w-full rounded-full bg-crm-primary/40" />
        )}
      </div>
      {!loading ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-crm-soft">
          <span>
            {tone === "over" ? (
              <span className="text-crm-danger">
                {num.format(overUnits)}
                {u} over limit{overCost !== null ? ` · ${money.format(overCost)} overage` : ""}
              </span>
            ) : projectedOver ? (
              <span className="text-crm-warning">
                On pace for {num.format(projected ?? 0)}
                {u} this period
              </span>
            ) : limit !== null ? (
              `${num.format(Math.max(0, limit - used))}${u} remaining`
            ) : (
              "No limit on this plan"
            )}
          </span>
          <span className="flex items-center gap-2">
            {resets ? <span>Resets {resets}</span> : null}
            {action}
          </span>
        </div>
      ) : null}
    </div>
  );
}
