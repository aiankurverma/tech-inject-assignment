import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/crm/sparkline";

export interface Kpi {
  label: string;
  value: React.ReactNode;
  /** Change vs. previous period in percent, e.g. 12.4 or -3. */
  delta?: number;
  /** Set when a drop is good (e.g. churn, response time). */
  invert?: boolean;
  caption?: string;
  icon?: React.ReactNode;
  trend?: number[];
}

export interface KpiGridProps {
  items: Kpi[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

/** Delta pill: green when the change is good, red when bad, neutral at zero. */
export function DeltaPill({ delta, invert }: { delta: number; invert?: boolean }) {
  const good = invert ? delta < 0 : delta > 0;
  const Icon = delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5 text-[11px] font-medium tabular-nums",
        delta === 0
          ? "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text"
          : good
            ? "border-tag-green-border bg-tag-green-bg text-tag-green-text"
            : "border-tag-red-border bg-tag-red-bg text-tag-red-text",
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{delta > 0 ? "up" : delta < 0 ? "down" : "no change"}</span>
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

/** Responsive grid of KPI tiles with value, period delta and optional sparkline. */
export function KpiGrid({ items, columns = 4, className }: KpiGridProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-2 font-crm", cols[columns], className)}>
      {items.map((k) => (
        <div
          key={k.label}
          className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised"
        >
          <dt className="flex items-center gap-1.5 text-xs text-crm-soft [&_svg]:size-3.5">
            {k.icon}
            {k.label}
          </dt>
          <dd className="flex items-end justify-between gap-2">
            <span className="flex flex-col gap-1.5">
              <span className="text-2xl font-semibold tracking-tight text-crm-fg tabular-nums">
                {k.value}
              </span>
              <span className="flex items-center gap-1.5">
                {k.delta !== undefined ? <DeltaPill delta={k.delta} invert={k.invert} /> : null}
                {k.caption ? <span className="text-xs text-crm-subtle">{k.caption}</span> : null}
              </span>
            </span>
            {k.trend ? <Sparkline data={k.trend} height={28} label={`${k.label} trend`} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
