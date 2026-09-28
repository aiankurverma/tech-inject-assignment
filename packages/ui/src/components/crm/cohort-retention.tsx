import * as React from "react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface Cohort {
  /** e.g. "Jan 2026". */
  label: string;
  /** Customers (or revenue) at period 0. */
  size: number;
  /** Retained amount for period 1..n (period 0 is implied = size). Shorter for newer cohorts. */
  retained: number[];
}

export interface CohortRetentionProps {
  cohorts: Cohort[];
  /** Period unit shown in the header, e.g. "Month". */
  periodLabel?: string;
  /** "logo" = customer counts, "revenue" = money (allows >100% net retention). */
  kind?: "logo" | "revenue";
  currency?: string;
  mode?: "percent" | "count";
  defaultMode?: "percent" | "count";
  onModeChange?: (mode: "percent" | "count") => void;
  /** Retention % below which cells are flagged. */
  alertBelow?: number;
  className?: string;
}

/** Heat colour from retention ratio; >100% (expansion) gets a success tint. */
function heat(ratio: number) {
  if (ratio > 1)
    return { background: "color-mix(in oklab, var(--color-crm-success) 55%, transparent)" };
  const pct = Math.round(12 + ratio * 70);
  return { background: `color-mix(in oklab, var(--color-crm-primary) ${pct}%, transparent)` };
}

/**
 * Cohort retention triangle: each row is a signup cohort, each column a period since start.
 * Weighted-average row, percent/count toggle, below-threshold flags and arrow-key grid navigation.
 */
export function CohortRetention({
  cohorts,
  periodLabel = "Month",
  kind = "logo",
  currency = "USD",
  mode,
  defaultMode = "percent",
  onModeChange,
  alertBelow,
  className,
}: CohortRetentionProps) {
  const [innerMode, setInnerMode] = React.useState(defaultMode);
  const md = mode ?? innerMode;
  const [active, setActive] = React.useState<{ r: number; c: number } | null>(null);
  const cellRefs = React.useRef(new Map<string, HTMLTableCellElement>());

  const periods = Math.max(0, ...cohorts.map((c) => c.retained.length)) + 1;
  const rows = cohorts.map((c) => [c.size, ...c.retained]);

  // Weighted average per period uses only cohorts old enough to have that period.
  const avg = Array.from({ length: periods }, (_, p) => {
    let num = 0;
    let den = 0;
    cohorts.forEach((c, i) => {
      const v = rows[i]?.[p];
      if (v !== undefined) {
        num += v;
        den += c.size;
      }
    });
    return den ? num / den : undefined;
  });

  const fmt = (v: number, size: number) => {
    if (md === "percent")
      return `${((v / size) * 100).toFixed(v / size >= 0.995 && v / size < 1.005 ? 0 : 1)}%`;
    return kind === "revenue"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(v)
      : v.toLocaleString("en-US");
  };

  const move = (r: number, c: number) => {
    const row = rows[r];
    if (!row || c < 0 || c >= row.length) return;
    setActive({ r, c });
    cellRefs.current.get(`${r}:${c}`)?.focus();
  };

  const onKey = (e: React.KeyboardEvent, r: number, c: number) => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
      Home: [r, 0],
      End: [r, (rows[r]?.length ?? 1) - 1],
    };
    const t = map[e.key];
    if (!t) return;
    e.preventDefault();
    const [nr, nc] = t;
    const target = rows[nr];
    if (target) move(nr, Math.min(nc, target.length - 1));
  };

  const activeCohort = active ? cohorts[active.r] : undefined;
  const activeVal = active ? rows[active.r]?.[active.c] : undefined;

  return (
    <section
      aria-label="Cohort retention"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">
            {kind === "revenue" ? "Net revenue retention" : "Logo retention"}
          </p>
          <h2 className="text-base font-semibold">
            {cohorts.length} cohorts · {periods - 1} {periodLabel.toLowerCase()}s
          </h2>
        </div>
        <SegmentedControl
          label="Display"
          size="sm"
          value={md}
          onValueChange={(v) => {
            const n = v as "percent" | "count";
            if (mode === undefined) setInnerMode(n);
            onModeChange?.(n);
          }}
          options={[
            { value: "percent", label: "%" },
            { value: "count", label: kind === "revenue" ? "Amount" : "Count" },
          ]}
        />
      </header>

      {cohorts.length === 0 ? (
        <p className="py-10 text-center text-sm text-crm-subtle">
          Not enough history yet — cohorts appear after the first full {periodLabel.toLowerCase()}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table role="grid" className="w-full border-separate border-spacing-[2px] text-xs">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="crm-caption sticky left-0 bg-crm-card px-2 text-left font-normal text-crm-subtle"
                >
                  Cohort
                </th>
                <th scope="col" className="crm-caption px-2 text-right font-normal text-crm-subtle">
                  Size
                </th>
                {Array.from({ length: periods }, (_, p) => (
                  <th
                    key={p}
                    scope="col"
                    className="crm-caption min-w-12 px-1 text-center font-normal text-crm-subtle"
                  >
                    {periodLabel[0]}
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c, r) => (
                <tr key={c.label}>
                  <th
                    scope="row"
                    className="sticky left-0 bg-crm-card px-2 text-left font-medium whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                  <td className="px-2 text-right text-crm-soft tabular-nums">
                    {kind === "revenue"
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency,
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(c.size)
                      : c.size.toLocaleString("en-US")}
                  </td>
                  {Array.from({ length: periods }, (_, p) => {
                    const v = rows[r]?.[p];
                    if (v === undefined) return <td key={p} aria-hidden className="h-8" />;
                    const ratio = c.size ? v / c.size : 0;
                    const flagged = alertBelow !== undefined && p > 0 && ratio * 100 < alertBelow;
                    const isActive = active?.r === r && active.c === p;
                    return (
                      <td
                        key={p}
                        ref={(el) => {
                          if (el) cellRefs.current.set(`${r}:${p}`, el);
                          else cellRefs.current.delete(`${r}:${p}`);
                        }}
                        role="gridcell"
                        tabIndex={isActive || (!active && r === 0 && p === 0) ? 0 : -1}
                        aria-label={`${c.label}, ${periodLabel} ${p}: ${fmt(v, c.size)}${flagged ? ", below threshold" : ""}`}
                        onFocus={() => setActive({ r, c: p })}
                        onMouseEnter={() => setActive({ r, c: p })}
                        onKeyDown={(e) => onKey(e, r, p)}
                        style={heat(ratio)}
                        className={cn(
                          "h-8 rounded-sm px-1 text-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                          ratio > 0.55 ? "text-crm-primary-fg" : "text-crm-fg",
                          flagged && "ring-1 ring-crm-danger ring-inset",
                        )}
                      >
                        {fmt(v, c.size)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 bg-crm-card px-2 pt-2 text-left font-medium text-crm-soft"
                >
                  Weighted avg
                </th>
                <td />
                {avg.map((a, p) => (
                  <td
                    key={p}
                    className="px-1 pt-2 text-center font-medium text-crm-soft tabular-nums"
                  >
                    {a === undefined ? "—" : `${(a * 100).toFixed(1)}%`}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="min-h-5 text-xs text-crm-subtle" aria-live="polite">
        {activeCohort && activeVal !== undefined && active
          ? `${activeCohort.label} · ${periodLabel} ${active.c}: ${fmt(activeVal, activeCohort.size)} of starting ${
              kind === "revenue" ? "revenue" : "customers"
            }${active.c > 0 && rows[active.r]?.[active.c - 1] ? ` · ${((((rows[active.r]?.[active.c - 1] ?? 0) - activeVal) / (rows[active.r]?.[active.c - 1] ?? 1)) * 100).toFixed(1)}% lost vs previous ${periodLabel.toLowerCase()}` : ""}`
          : "Hover or use arrow keys to inspect a cell."}
      </p>
    </section>
  );
}
