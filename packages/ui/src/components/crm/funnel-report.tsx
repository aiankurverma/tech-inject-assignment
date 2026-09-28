import * as React from "react";
import { TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeltaPill } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface FunnelStage {
  id: string;
  label: string;
  /** Count per segment, e.g. { SMB: 1200, "Mid-market": 400 }. */
  counts: Record<string, number>;
  /** Same shape for the comparison period (optional). */
  previous?: Record<string, number>;
  /** Median days spent in this stage. */
  medianDays?: number;
  /** Average deal value reaching this stage. */
  avgValue?: number;
}

export interface FunnelReportProps {
  stages: FunnelStage[];
  title?: string;
  /** Segment names; "All" is added automatically. */
  segments: string[];
  segment?: string;
  defaultSegment?: string;
  onSegmentChange?: (segment: string) => void;
  onStageSelect?: (stageId: string) => void;
  currency?: string;
  className?: string;
}

const sum = (r?: Record<string, number>, seg = "All") =>
  !r ? undefined : seg === "All" ? Object.values(r).reduce((a, b) => a + b, 0) : (r[seg] ?? 0);

/**
 * Conversion funnel report: stage bars proportional to volume, step and cumulative
 * conversion, period-over-period change, biggest drop-off callout and segment filter.
 */
export function FunnelReport({
  stages,
  title = "Pipeline funnel",
  segments,
  segment,
  defaultSegment = "All",
  onSegmentChange,
  onStageSelect,
  currency = "USD",
  className,
}: FunnelReportProps) {
  const [innerSeg, setInnerSeg] = React.useState(defaultSegment);
  const seg = segment ?? innerSeg;
  const [selected, setSelected] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    const top = sum(stages[0]?.counts, seg) ?? 0;
    const prevTop = sum(stages[0]?.previous, seg);
    return stages.map((s, i) => {
      const n = sum(s.counts, seg) ?? 0;
      const prior = i > 0 ? (sum(stages[i - 1]?.counts, seg) ?? 0) : n;
      const p = sum(s.previous, seg);
      const prevPrior = i > 0 ? sum(stages[i - 1]?.previous, seg) : p;
      const step = prior ? n / prior : 0;
      const prevStep = p !== undefined && prevPrior ? p / prevPrior : undefined;
      return {
        s,
        n,
        step,
        cum: top ? n / top : 0,
        prevCum: p !== undefined && prevTop ? p / prevTop : undefined,
        stepDelta: prevStep !== undefined && i > 0 ? (step - prevStep) * 100 : undefined,
        lost: prior - n,
      };
    });
  }, [stages, seg]);

  const worst = rows
    .slice(1)
    .reduce<(typeof rows)[number] | undefined>(
      (w, r) => (!w || r.step < w.step ? r : w),
      undefined,
    );
  const max = Math.max(1, ...rows.map((r) => r.n));
  const last = rows[rows.length - 1];
  const money = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Funnel</p>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <SegmentedControl
          label="Segment"
          size="sm"
          value={seg}
          onValueChange={(v) => {
            if (segment === undefined) setInnerSeg(v);
            onSegmentChange?.(v);
          }}
          options={["All", ...segments].map((s) => ({ value: s, label: s }))}
        />
      </header>

      {stages.length === 0 || (rows[0]?.n ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-crm-subtle">
          No records entered this funnel for {seg}.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-crm bg-crm-muted/50 p-3">
              <p className="text-xs text-crm-subtle">Overall conversion</p>
              <p className="text-xl font-semibold tabular-nums">
                {((last?.cum ?? 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-crm bg-crm-muted/50 p-3">
              <p className="text-xs text-crm-subtle">Median cycle</p>
              <p className="text-xl font-semibold tabular-nums">
                {stages.reduce((a, s) => a + (s.medianDays ?? 0), 0)} days
              </p>
            </div>
            {worst ? (
              <div className="rounded-crm border border-tag-red-border bg-tag-red-bg p-3 text-tag-red-text">
                <p className="flex items-center gap-1 text-xs">
                  <TrendingDown className="size-3.5" aria-hidden /> Biggest drop-off
                </p>
                <p className="text-sm font-semibold">
                  → {worst.s.label}: {(worst.step * 100).toFixed(0)}% (
                  {worst.lost.toLocaleString("en-US")} lost)
                </p>
              </div>
            ) : null}
          </div>

          <ol className="flex flex-col gap-1.5">
            {rows.map((r, i) => {
              const isSel = selected === r.s.id;
              return (
                <li key={r.s.id}>
                  {i > 0 ? (
                    <div className="flex items-center gap-2 py-0.5 pl-3 text-[11px] text-crm-subtle">
                      <span aria-hidden>↓</span>
                      <span
                        className={cn("tabular-nums", r === worst && "font-medium text-crm-danger")}
                      >
                        {(r.step * 100).toFixed(1)}% step conversion
                      </span>
                      {r.stepDelta !== undefined ? <DeltaPill delta={r.stepDelta} /> : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => {
                      setSelected(isSel ? null : r.s.id);
                      onStageSelect?.(r.s.id);
                    }}
                    className={cn(
                      "grid w-full grid-cols-[110px_1fr_auto] items-center gap-3 rounded-crm px-2 py-1.5 text-left hover:bg-crm-muted/50 focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none sm:grid-cols-[160px_1fr_auto]",
                      isSel && "bg-crm-muted",
                    )}
                  >
                    <span className="truncate text-sm font-medium">{r.s.label}</span>
                    <span className="flex h-7 justify-center">
                      <span
                        className="h-full rounded-sm bg-crm-primary transition-[width] duration-300"
                        style={{
                          width: `${Math.max(2, (r.n / max) * 100)}%`,
                          opacity: 1 - i * (0.5 / Math.max(1, rows.length - 1)),
                        }}
                      />
                    </span>
                    <span className="flex w-28 flex-col items-end">
                      <span className="text-sm font-semibold tabular-nums">
                        {r.n.toLocaleString("en-US")}
                      </span>
                      <span className="text-[11px] text-crm-subtle tabular-nums">
                        {(r.cum * 100).toFixed(1)}% of top
                      </span>
                    </span>
                  </button>
                  {isSel ? (
                    <dl className="mx-2 mt-1 grid grid-cols-2 gap-2 rounded-crm border border-crm-border p-3 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-crm-subtle">Lost at step</dt>
                        <dd className="font-medium tabular-nums">
                          {i ? r.lost.toLocaleString("en-US") : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-crm-subtle">Median days</dt>
                        <dd className="font-medium tabular-nums">{r.s.medianDays ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-crm-subtle">Avg value</dt>
                        <dd className="font-medium tabular-nums">
                          {r.s.avgValue !== undefined ? money(r.s.avgValue) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-crm-subtle">Prev. period cum.</dt>
                        <dd className="font-medium tabular-nums">
                          {r.prevCum !== undefined ? `${(r.prevCum * 100).toFixed(1)}%` : "—"}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
