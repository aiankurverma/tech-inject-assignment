import * as React from "react";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { DeltaPill } from "@/components/crm/kpi-grid";
import { Sparkline } from "@/components/crm/sparkline";
import { Tag } from "@/components/crm/tag";

export interface ExecMetric {
  id: string;
  label: string;
  group: string;
  /** Values per period, oldest first; last is the current period. */
  series: number[];
  target?: number;
  format: "currency" | "percent" | "number" | "months";
  /** Lower is better (e.g. burn, churn, CAC payback). */
  invert?: boolean;
  owner?: string;
}

export interface ExecNote {
  kind: "highlight" | "risk" | "ask";
  text: string;
}

export interface ExecutiveSummaryProps {
  title: string;
  /** Labels for each series point, e.g. ["Q1 FY25", …]. */
  periods: string[];
  metrics: ExecMetric[];
  notes?: ExecNote[];
  currency?: string;
  /** Allowed variance from target (fraction) before status turns red. Default 0.1. */
  tolerance?: number;
  className?: string;
}

type Rag = "green" | "amber" | "red" | "none";

function rag(m: ExecMetric, tol: number): Rag {
  const v = m.series[m.series.length - 1];
  if (m.target === undefined || v === undefined) return "none";
  const ratio = m.invert ? m.target / Math.max(v, 1e-9) : v / (m.target || 1e-9);
  if (ratio >= 1) return "green";
  return ratio >= 1 - tol ? "amber" : "red";
}

const ragLabel = { green: "On track", amber: "At risk", red: "Off track", none: "No target" };
const noteColor = { highlight: "green", risk: "red", ask: "purple" } as const;

/** Board-level summary: grouped metrics with RAG vs target, period compare, narrative, print-ready. */
export function ExecutiveSummary({
  title,
  periods,
  metrics,
  notes = [],
  currency = "USD",
  tolerance = 0.1,
  className,
}: ExecutiveSummaryProps) {
  const [compare, setCompare] = React.useState(1);
  const [only, setOnly] = React.useState<Rag | "all">("all");
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
  const fmt = (m: ExecMetric, v: number | undefined) => {
    if (v === undefined) return "—";
    if (m.format === "currency") return money.format(v);
    if (m.format === "percent") return `${v.toFixed(1)}%`;
    if (m.format === "months") return `${v.toFixed(1)} mo`;
    return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  const statuses = metrics.map((m) => ({ m, s: rag(m, tolerance) }));
  const counts = { green: 0, amber: 0, red: 0, none: 0 };
  for (const x of statuses) counts[x.s]++;
  const groups = [...new Set(metrics.map((m) => m.group))];
  const cur = periods[periods.length - 1] ?? "";
  const base = periods[periods.length - 1 - compare];

  return (
    <article
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-5 font-crm text-crm-fg shadow-crm-raised print:border-0 print:shadow-none",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="crm-eyebrow">Executive summary · {cur}</p>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Filter by status">
            {(["all", "green", "amber", "red"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={only === k}
                onClick={() => setOnly(k)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none",
                  only === k
                    ? "border-crm-primary text-crm-fg"
                    : "border-crm-border text-crm-soft hover:text-crm-fg",
                )}
              >
                {k === "all" ? `All ${metrics.length}` : `${ragLabel[k]} ${counts[k]}`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <label className="flex items-center gap-1.5 text-xs text-crm-soft">
            Compare to
            <select
              value={compare}
              onChange={(e) => setCompare(Number(e.target.value))}
              className="h-7 rounded-md border border-crm-border bg-crm-card px-1.5 text-xs text-crm-fg"
            >
              {periods.slice(0, -1).map((p, i, arr) => (
                <option key={p} value={arr.length - i}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print
          </Button>
        </div>
      </header>

      {groups.map((g) => {
        const rows = statuses.filter((x) => x.m.group === g && (only === "all" || x.s === only));
        if (!rows.length) return null;
        return (
          <section key={g} aria-label={g} className="flex flex-col gap-2">
            <h3 className="crm-eyebrow">{g}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="text-left text-crm-soft">
                  <tr className="border-b border-crm-border">
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      Metric
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-right font-medium">
                      {cur}
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-right font-medium">
                      vs {base ?? "—"}
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-right font-medium">
                      Target
                    </th>
                    <th scope="col" className="px-3 py-1.5 font-medium">
                      Trend
                    </th>
                    <th scope="col" className="py-1.5 pl-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map(({ m, s }) => {
                    const v = m.series[m.series.length - 1];
                    const b = m.series[m.series.length - 1 - compare];
                    const delta = v !== undefined && b ? ((v - b) / Math.abs(b)) * 100 : undefined;
                    return (
                      <tr key={m.id} className="border-b border-crm-border/60 last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-medium">
                          {m.label}
                          {m.owner ? (
                            <span className="block text-[11px] font-normal text-crm-subtle">
                              {m.owner}
                            </span>
                          ) : null}
                        </th>
                        <td className="px-3 py-2 text-right text-sm font-semibold">{fmt(m, v)}</td>
                        <td className="px-3 py-2 text-right">
                          {delta !== undefined ? (
                            <DeltaPill delta={Number(delta.toFixed(1))} invert={m.invert} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-crm-soft">{fmt(m, m.target)}</td>
                        <td className="px-3 py-2">
                          <Sparkline data={m.series} height={20} label={`${m.label} trend`} />
                        </td>
                        <td className="py-2 pl-3">
                          <Tag size="sm" color={s === "none" ? "neutral" : s}>
                            {ragLabel[s]}
                          </Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {notes.length ? (
        <section
          aria-label="Commentary"
          className="grid gap-3 border-t border-crm-border pt-4 md:grid-cols-3"
        >
          {(["highlight", "risk", "ask"] as const).map((k) => {
            const list = notes.filter((n) => n.kind === k);
            return (
              <div key={k} className="flex flex-col gap-1.5">
                <Tag size="sm" color={noteColor[k]} className="self-start">
                  {k === "highlight" ? "Highlights" : k === "risk" ? "Risks" : "Asks of the board"}
                </Tag>
                {list.length ? (
                  <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-crm-muted-fg">
                    {list.map((n) => (
                      <li key={n.text}>{n.text}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-crm-subtle">None this period.</p>
                )}
              </div>
            );
          })}
        </section>
      ) : null}
    </article>
  );
}
