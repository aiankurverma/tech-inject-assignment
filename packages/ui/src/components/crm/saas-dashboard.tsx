import * as React from "react";
import { Activity, DollarSign, Repeat, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/crm/card";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type MrrMovementType = "new" | "expansion" | "contraction" | "churn" | "reactivation";

export interface MrrMovement {
  account: string;
  type: MrrMovementType;
  /** Signed MRR change (negative for contraction / churn). */
  amount: number;
  /** ISO date. */
  date: string;
}

export interface SaasDashboardPeriod {
  label: string;
  startingMrr: number;
  startingCustomers: number;
  /** Customer acquisition spend in the period (for CAC payback). */
  salesMarketingSpend: number;
  /** Gross margin 0–1 used for payback. */
  grossMargin: number;
  movements: MrrMovement[];
  mrrTrend: number[];
}

export interface SaasDashboardProps {
  periods: Record<string, SaasDashboardPeriod>;
  defaultPeriod?: string;
  currency?: string;
  locale?: string;
  className?: string;
}

const typeMeta: Record<MrrMovementType, { label: string; color: TagColor; bar: string }> = {
  new: { label: "New", color: "green", bar: "bg-crm-success" },
  reactivation: { label: "Reactivation", color: "teal", bar: "bg-crm-success/70" },
  expansion: { label: "Expansion", color: "blue", bar: "bg-crm-primary" },
  contraction: { label: "Contraction", color: "amber", bar: "bg-crm-warning" },
  churn: { label: "Churn", color: "red", bar: "bg-crm-danger" },
};
const order: MrrMovementType[] = ["new", "reactivation", "expansion", "contraction", "churn"];

/** Computes MRR bridge totals and retention metrics from raw movements. */
export function mrrBridge(p: SaasDashboardPeriod) {
  const sum = (t: MrrMovementType) =>
    p.movements.filter((m) => m.type === t).reduce((s, m) => s + m.amount, 0);
  const by = Object.fromEntries(order.map((t) => [t, sum(t)])) as Record<MrrMovementType, number>;
  const net = order.reduce((s, t) => s + by[t], 0);
  const ending = p.startingMrr + net;
  const grr = p.startingMrr ? (p.startingMrr + by.contraction + by.churn) / p.startingMrr : 0;
  const nrr = p.startingMrr
    ? (p.startingMrr + by.expansion + by.contraction + by.churn) / p.startingMrr
    : 0;
  const churnedLogos = new Set(p.movements.filter((m) => m.type === "churn").map((m) => m.account))
    .size;
  const newLogos = new Set(p.movements.filter((m) => m.type === "new").map((m) => m.account)).size;
  const logoChurn = p.startingCustomers ? churnedLogos / p.startingCustomers : 0;
  const payback =
    by.new > 0 && p.grossMargin > 0 ? p.salesMarketingSpend / (by.new * p.grossMargin) : null;
  return { by, net, ending, grr, nrr, churnedLogos, newLogos, logoChurn, payback };
}

/** SaaS metrics dashboard: MRR bridge waterfall, NRR/GRR, logo churn, CAC payback and a filterable movements ledger. */
export function SaasDashboard({
  periods,
  defaultPeriod,
  currency = "USD",
  locale = "en-US",
  className,
}: SaasDashboardProps) {
  const keys = Object.keys(periods);
  const [period, setPeriod] = React.useState(defaultPeriod ?? keys[0] ?? "");
  const [type, setType] = React.useState<"all" | MrrMovementType>("all");
  const p = periods[period];
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const compact = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  if (!p)
    return (
      <p role="status" className={cn("font-crm text-sm text-crm-soft", className)}>
        No data for this period.
      </p>
    );

  const b = mrrBridge(p);
  // Waterfall geometry: running total from starting MRR.
  const steps: {
    key: string;
    label: string;
    from: number;
    to: number;
    bar: string;
    value: number;
  }[] = [];
  let run = p.startingMrr;
  steps.push({
    key: "start",
    label: "Starting MRR",
    from: 0,
    to: run,
    bar: "bg-crm-subtle",
    value: run,
  });
  for (const t of order) {
    const v = b.by[t];
    if (!v) continue;
    steps.push({
      key: t,
      label: typeMeta[t].label,
      from: run,
      to: run + v,
      bar: typeMeta[t].bar,
      value: v,
    });
    run += v;
  }
  steps.push({
    key: "end",
    label: "Ending MRR",
    from: 0,
    to: run,
    bar: "bg-crm-fg/70",
    value: run,
  });
  const max = Math.max(...steps.map((s) => Math.max(s.from, s.to)), 1);

  const ledger = p.movements
    .filter((m) => type === "all" || m.type === type)
    .sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount));

  return (
    <section aria-label="SaaS metrics" className={cn("flex flex-col gap-3 font-crm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-crm-fg">Revenue metrics · {p.label}</h2>
        <SegmentedControl
          label="Period"
          size="sm"
          value={period}
          onValueChange={setPeriod}
          options={keys.map((k) => ({ value: k, label: periods[k]?.label ?? k }))}
        />
      </div>

      <KpiGrid
        items={[
          {
            label: "Ending MRR",
            value: compact.format(b.ending),
            delta: p.startingMrr ? (b.net / p.startingMrr) * 100 : 0,
            caption: `${b.net >= 0 ? "+" : ""}${compact.format(b.net)} net new`,
            icon: <DollarSign />,
            trend: p.mrrTrend,
          },
          {
            label: "Net revenue retention",
            value: `${(b.nrr * 100).toFixed(1)}%`,
            caption: `GRR ${(b.grr * 100).toFixed(1)}%`,
            icon: <Repeat />,
          },
          {
            label: "Logo churn",
            value: `${(b.logoChurn * 100).toFixed(1)}%`,
            caption: `${b.churnedLogos} lost · ${b.newLogos} won`,
            icon: <UserMinus />,
          },
          {
            label: "CAC payback",
            value: b.payback === null ? "—" : `${b.payback.toFixed(1)} mo`,
            caption: `${compact.format(p.salesMarketingSpend)} S&M`,
            icon: <Activity />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            bordered
            title="MRR bridge"
            description={`${money.format(p.startingMrr)} → ${money.format(b.ending)}`}
          />
          <CardBody>
            <ol className="flex flex-col gap-2" aria-label="MRR waterfall">
              {steps.map((s) => {
                const lo = Math.min(s.from, s.to);
                const hi = Math.max(s.from, s.to);
                return (
                  <li
                    key={s.key}
                    className="grid grid-cols-[96px_minmax(0,1fr)_88px] items-center gap-2 text-xs"
                  >
                    <span className="text-crm-soft">{s.label}</span>
                    <span className="relative h-4 rounded-sm bg-crm-muted/40" aria-hidden>
                      <span
                        className={cn("absolute inset-y-0 rounded-sm", s.bar)}
                        style={{
                          left: `${(lo / max) * 100}%`,
                          width: `${Math.max(0.5, ((hi - lo) / max) * 100)}%`,
                        }}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-right tabular-nums",
                        s.key === "start" || s.key === "end"
                          ? "font-medium text-crm-fg"
                          : s.value < 0
                            ? "text-crm-danger"
                            : "text-crm-success",
                      )}
                    >
                      {s.key !== "start" && s.key !== "end" && s.value > 0 ? "+" : ""}
                      {money.format(s.value)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            bordered
            title="Movements"
            description={`${ledger.length} changes, largest first`}
            action={
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "all" | MrrMovementType)}
                aria-label="Movement type"
                className="h-7 rounded-crm border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
              >
                <option value="all">All types</option>
                {order.map((t) => (
                  <option key={t} value={t}>
                    {typeMeta[t].label}
                  </option>
                ))}
              </select>
            }
          />
          <CardBody className="max-h-72 overflow-y-auto">
            {ledger.length === 0 ? (
              <p role="status" className="py-6 text-center text-xs text-crm-soft">
                No {type === "all" ? "" : typeMeta[type].label.toLowerCase()} movements this period.
              </p>
            ) : (
              <ul className="flex flex-col">
                {ledger.map((m, i) => (
                  <li
                    key={`${m.account}-${m.type}-${i}`}
                    className="flex items-center justify-between gap-2 border-b border-crm-border py-2 text-sm last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-crm-fg">{m.account}</span>
                      <span className="text-xs text-crm-subtle">
                        {dateFmt.format(new Date(`${m.date}T00:00:00`))}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Tag size="sm" color={typeMeta[m.type].color}>
                        {typeMeta[m.type].label}
                      </Tag>
                      <span
                        className={cn(
                          "w-20 text-right text-xs tabular-nums",
                          m.amount < 0 ? "text-crm-danger" : "text-crm-success",
                        )}
                      >
                        {m.amount > 0 ? "+" : ""}
                        {money.format(m.amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
