import * as React from "react";
import { ArrowDownRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FunnelStage {
  key: string;
  label: string;
  /** Records that reached this stage. */
  count: number;
  /** Optional money value at this stage (e.g. pipeline amount). */
  value?: number;
  /** Benchmark stage-to-stage conversion (0-1) used to flag leaks. */
  benchmark?: number;
}

export interface FunnelChartProps {
  stages: FunnelStage[];
  /** ISO currency for `value`, e.g. "USD". */
  currency?: string;
  /** "count" sizes bars by records, "value" by money. */
  measure?: "count" | "value";
  onStageClick?: (stage: FunnelStage) => void;
  loading?: boolean;
  emptyMessage?: string;
  label?: string;
  className?: string;
}

const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

/**
 * Stage conversion funnel: tapering bars, step and cumulative conversion, drop-off counts and a
 * warning where conversion falls under the stage benchmark. The biggest leak is highlighted.
 */
export function FunnelChart({
  stages,
  currency = "USD",
  measure = "count",
  onStageClick,
  loading,
  emptyMessage = "No records entered this funnel",
  label = "Conversion funnel",
  className,
}: FunnelChartProps) {
  const money = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [currency],
  );
  const num = new Intl.NumberFormat("en-US");
  const metric = (s: FunnelStage) => (measure === "value" ? (s.value ?? 0) : s.count);
  const top = Math.max(1, ...stages.map(metric));
  const first = stages[0]?.count ?? 0;

  const rows = stages.map((s, i) => {
    const prev = stages[i - 1];
    const step = prev && prev.count > 0 ? s.count / prev.count : 1;
    return {
      stage: s,
      step,
      overall: first > 0 ? s.count / first : 0,
      drop: prev ? prev.count - s.count : 0,
      leak: prev && s.benchmark != null && step < s.benchmark,
    };
  });
  const worst = rows
    .slice(1)
    .reduce<number>((w, r, i) => (w < 0 || r.step < (rows[w]?.step ?? Infinity) ? i + 1 : w), -1);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading funnel"
        className={cn("flex flex-col gap-2", className)}
      >
        {[100, 78, 55, 34, 20].map((w) => (
          <span
            key={w}
            className="h-9 animate-pulse rounded-crm bg-crm-muted"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    );
  }
  const last = rows[rows.length - 1];
  if (!last || first === 0) {
    return (
      <p
        role="status"
        className={cn(
          "rounded-crm border border-dashed border-crm-border p-6 text-center font-crm text-xs text-crm-subtle",
          className,
        )}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <figure className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="crm-eyebrow text-crm-subtle">{label}</span>
        <span className="text-xs text-crm-soft">
          Overall <span className="font-medium text-crm-fg tabular-nums">{pct(last.overall)}</span>{" "}
          · {num.format(first)} → {num.format(last.stage.count)}
        </span>
      </figcaption>
      <ol className="flex flex-col gap-1">
        {rows.map((r, i) => {
          const width = Math.max(3, Math.sqrt(metric(r.stage) / top) * 100);
          const Row = onStageClick ? "button" : "div";
          return (
            <li key={r.stage.key}>
              {i > 0 ? (
                <p
                  className={cn(
                    "flex items-center gap-1.5 py-0.5 pl-2 text-[11px]",
                    r.leak ? "text-crm-warning" : "text-crm-subtle",
                  )}
                >
                  {r.leak ? (
                    <TriangleAlert className="size-3" aria-hidden />
                  ) : (
                    <ArrowDownRight className="size-3" aria-hidden />
                  )}
                  <span className="tabular-nums">{pct(r.step)} converted</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">−{num.format(r.drop)} dropped</span>
                  {r.leak && r.stage.benchmark != null ? (
                    <span>(benchmark {pct(r.stage.benchmark)})</span>
                  ) : null}
                  {i === worst ? (
                    <span className="ml-auto rounded-full border border-tag-red-border bg-tag-red-bg px-1.5 text-tag-red-text">
                      Biggest leak
                    </span>
                  ) : null}
                </p>
              ) : null}
              <Row
                {...(onStageClick
                  ? { type: "button" as const, onClick: () => onStageClick(r.stage) }
                  : {})}
                className={cn(
                  "group grid w-full grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-crm text-left outline-none",
                  onStageClick &&
                    "cursor-pointer focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                )}
                aria-label={`${r.stage.label}: ${num.format(r.stage.count)} records, ${pct(r.overall)} of entries`}
              >
                <span className="truncate text-xs font-medium text-crm-fg">{r.stage.label}</span>
                <span className="relative h-7 min-w-0 rounded-crm bg-crm-muted/40">
                  <span
                    className="absolute inset-y-0 left-0 rounded-crm bg-crm-primary/80 transition-[width] duration-300 group-hover:bg-crm-primary"
                    style={{ width: `${width}%`, opacity: 1 - i * 0.1 }}
                    aria-hidden
                  />
                </span>
                <span className="flex w-28 flex-col items-end text-xs leading-tight">
                  <span className="font-medium tabular-nums">{num.format(r.stage.count)}</span>
                  <span className="text-crm-subtle tabular-nums">
                    {r.stage.value != null ? money.format(r.stage.value) : pct(r.overall)}
                  </span>
                </span>
              </Row>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
