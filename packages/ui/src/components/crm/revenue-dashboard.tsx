import * as React from "react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface MrrMovement {
  /** "YYYY-MM" */
  month: string;
  newMrr: number;
  expansion: number;
  /** Positive number: MRR lost to downgrades. */
  contraction: number;
  /** Positive number: MRR lost to cancellations. */
  churn: number;
  customers?: number;
}

export interface RevenueDashboardProps {
  /** MRR at the start of the first month. */
  startingMrr: number;
  movements: MrrMovement[];
  currency?: string;
  className?: string;
}

interface Row extends MrrMovement {
  opening: number;
  closing: number;
  net: number;
}

/** SaaS revenue dashboard: MRR/ARR, NRR/GRR, quick ratio and a monthly movement breakdown. */
export function RevenueDashboard({
  startingMrr,
  movements,
  currency = "USD",
  className,
}: RevenueDashboardProps) {
  const [range, setRange] = React.useState("12");
  const [focus, setFocus] = React.useState<string | null>(null);
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

  const all = React.useMemo(() => {
    let open = startingMrr;
    return [...movements]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map<Row>((m) => {
        const net = m.newMrr + m.expansion - m.contraction - m.churn;
        const row = { ...m, opening: open, closing: open + net, net };
        open = row.closing;
        return row;
      });
  }, [movements, startingMrr]);

  const rows = all.slice(-Number(range));
  if (rows.length === 0) {
    return (
      <p
        className={cn("rounded-crm border border-crm-border p-6 text-sm text-crm-soft", className)}
      >
        No revenue movements recorded yet.
      </p>
    );
  }
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const sum = (k: keyof MrrMovement) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const exp = sum("expansion");
  const con = sum("contraction");
  const chu = sum("churn");
  const nw = sum("newMrr");
  const nrr = first.opening ? ((first.opening + exp - con - chu) / first.opening) * 100 : 0;
  const grr = first.opening ? ((first.opening - con - chu) / first.opening) * 100 : 0;
  const quick = con + chu ? (nw + exp) / (con + chu) : Infinity;
  const growth = first.opening ? ((last.closing - first.opening) / first.opening) * 100 : 0;
  const maxBar = Math.max(
    1,
    ...rows.map((r) => Math.max(r.newMrr + r.expansion, r.contraction + r.churn)),
  );
  const focused = rows.find((r) => r.month === focus) ?? last;
  const label = (m: string) =>
    new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  return (
    <section
      aria-label="Revenue dashboard"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Recurring revenue</h2>
        <SegmentedControl
          size="sm"
          label="Range"
          value={range}
          onValueChange={setRange}
          options={[
            { value: "3", label: "3M" },
            { value: "6", label: "6M" },
            { value: "12", label: "12M" },
          ]}
        />
      </div>
      <KpiGrid
        items={[
          {
            label: "MRR",
            value: money.format(last.closing),
            delta: growth,
            caption: `over ${rows.length} mo`,
            trend: rows.map((r) => r.closing),
          },
          { label: "ARR", value: money.format(last.closing * 12), caption: "run-rate" },
          {
            label: "Net revenue retention",
            value: `${nrr.toFixed(1)}%`,
            caption: `GRR ${grr.toFixed(1)}%`,
          },
          {
            label: "Quick ratio",
            value: Number.isFinite(quick) ? quick.toFixed(2) : "∞",
            caption: quick >= 4 ? "efficient growth" : quick >= 1 ? "growing" : "shrinking",
          },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">MRR movements</h3>
            <span className="flex items-center gap-3 text-[11px] text-crm-soft">
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-sm bg-crm-success" /> New
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-sm bg-crm-primary" /> Expansion
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-sm bg-crm-warning" /> Contraction
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-sm bg-crm-danger" /> Churn
              </span>
            </span>
          </div>
          <div
            role="group"
            aria-label="Monthly MRR movements"
            className="flex h-48 items-stretch gap-1"
          >
            {rows.map((r) => {
              const on = r.month === focused.month;
              return (
                <button
                  key={r.month}
                  type="button"
                  onClick={() => setFocus(r.month)}
                  onFocus={() => setFocus(r.month)}
                  aria-pressed={on}
                  aria-label={`${label(r.month)}: net ${money.format(r.net)}`}
                  className={cn(
                    "group relative flex flex-1 flex-col rounded-sm focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none",
                    on && "bg-crm-muted/50",
                  )}
                >
                  <span className="flex h-1/2 flex-col justify-end px-[15%]">
                    <span
                      className="bg-crm-primary"
                      style={{ height: `${(r.expansion / maxBar) * 100}%` }}
                    />
                    <span
                      className="bg-crm-success"
                      style={{ height: `${(r.newMrr / maxBar) * 100}%` }}
                    />
                  </span>
                  <span className="h-px bg-crm-border" />
                  <span className="flex h-1/2 flex-col px-[15%]">
                    <span
                      className="bg-crm-warning"
                      style={{ height: `${(r.contraction / maxBar) * 100}%` }}
                    />
                    <span
                      className="bg-crm-danger"
                      style={{ height: `${(r.churn / maxBar) * 100}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 text-[10px] text-crm-subtle">
            {rows.map((r) => (
              <span key={r.month} className="flex-1 truncate text-center">
                {label(r.month).split(" ")[0]}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <h3 className="text-sm font-medium">{label(focused.month)} bridge</h3>
          <dl className="flex flex-col text-xs tabular-nums">
            {(
              [
                ["Opening MRR", focused.opening, "text-crm-fg"],
                ["+ New", focused.newMrr, "text-crm-success"],
                ["+ Expansion", focused.expansion, "text-crm-primary"],
                ["− Contraction", -focused.contraction, "text-crm-warning"],
                ["− Churn", -focused.churn, "text-crm-danger"],
              ] as const
            ).map(([k, v, tone]) => (
              <div key={k} className="flex justify-between border-b border-crm-border/60 py-1.5">
                <dt className="text-crm-soft">{k}</dt>
                <dd className={tone}>{money.format(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between py-1.5 font-semibold">
              <dt>Closing MRR</dt>
              <dd>{money.format(focused.closing)}</dd>
            </div>
          </dl>
          <p className="crm-caption">
            Net {focused.net >= 0 ? "gain" : "loss"} {money.format(Math.abs(focused.net))}
            {focused.customers ? ` · ${focused.customers} customers` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
