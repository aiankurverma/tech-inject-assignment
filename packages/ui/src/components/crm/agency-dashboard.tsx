import * as React from "react";
import { AlertTriangle, Clock, DollarSign, Percent, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Card, CardBody, CardHeader } from "@/components/crm/card";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface AgencyTeamMember {
  name: string;
  role: string;
  /** Available hours in the period. */
  capacity: number;
  billableHours: number;
  nonBillableHours: number;
}

export interface AgencyClientRevenue {
  client: string;
  revenue: number;
}

export interface AgencyDashboardPeriod {
  label: string;
  revenue: number;
  previousRevenue: number;
  /** Direct delivery cost (salaries allocated + contractors). */
  deliveryCost: number;
  previousDeliveryCost: number;
  /** Signed but not yet invoiced work. */
  backlog: number;
  revenueTrend: number[];
  team: AgencyTeamMember[];
  clients: AgencyClientRevenue[];
}

export interface AgencyDashboardProps {
  /** Keyed by period id, e.g. { month: …, quarter: … }. */
  periods: Record<string, AgencyDashboardPeriod>;
  defaultPeriod?: string;
  /** Target billable utilisation (0–1). */
  utilisationTarget?: number;
  /** Warn when one client exceeds this revenue share (0–1). */
  concentrationLimit?: number;
  currency?: string;
  locale?: string;
  className?: string;
}

const pct = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : 0);

/** Agency operations dashboard: revenue, gross margin, utilisation vs. target per person, client concentration risk. */
export function AgencyDashboard({
  periods,
  defaultPeriod,
  utilisationTarget = 0.75,
  concentrationLimit = 0.3,
  currency = "USD",
  locale = "en-US",
  className,
}: AgencyDashboardProps) {
  const keys = Object.keys(periods);
  const [period, setPeriod] = React.useState(defaultPeriod ?? keys[0] ?? "");
  const [teamSort, setTeamSort] = React.useState<"util" | "name">("util");
  const data = periods[period];
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });

  if (!data)
    return (
      <p role="status" className={cn("font-crm text-sm text-crm-soft", className)}>
        No data for this period.
      </p>
    );

  const margin = data.revenue ? (data.revenue - data.deliveryCost) / data.revenue : 0;
  const prevMargin = data.previousRevenue
    ? (data.previousRevenue - data.previousDeliveryCost) / data.previousRevenue
    : 0;
  const cap = data.team.reduce((s, m) => s + m.capacity, 0);
  const billable = data.team.reduce((s, m) => s + m.billableHours, 0);
  const util = cap ? billable / cap : 0;
  const effRate = billable ? data.revenue / billable : 0;

  const team = [...data.team].sort((a, b) =>
    teamSort === "name"
      ? a.name.localeCompare(b.name)
      : b.billableHours / (b.capacity || 1) - a.billableHours / (a.capacity || 1),
  );
  const clientTotal = data.clients.reduce((s, c) => s + c.revenue, 0);
  const clients = [...data.clients].sort((a, b) => b.revenue - a.revenue);
  const top = clients[0];
  const topShare = top && clientTotal ? top.revenue / clientTotal : 0;

  return (
    <section
      aria-label="Agency dashboard"
      className={cn("flex flex-col gap-3 font-crm", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-crm-fg">Studio performance · {data.label}</h2>
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
            label: "Revenue",
            value: money.format(data.revenue),
            delta: pct(data.revenue, data.previousRevenue),
            caption: "vs prior",
            icon: <DollarSign />,
            trend: data.revenueTrend,
          },
          {
            label: "Gross margin",
            value: `${(margin * 100).toFixed(1)}%`,
            delta: (margin - prevMargin) * 100,
            caption: "pts vs prior",
            icon: <Percent />,
          },
          {
            label: "Billable utilisation",
            value: `${Math.round(util * 100)}%`,
            caption: `target ${Math.round(utilisationTarget * 100)}%`,
            icon: <Clock />,
          },
          {
            label: "Effective rate",
            value: `${money.format(effRate)}/h`,
            caption: `${money.format(data.backlog)} backlog`,
            icon: <Users />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader
            bordered
            title="Team utilisation"
            description={`${billable}h billable of ${cap}h capacity`}
            action={
              <SegmentedControl
                label="Sort team"
                size="sm"
                value={teamSort}
                onValueChange={(v) => setTeamSort(v as "util" | "name")}
                options={[
                  { value: "util", label: "Utilisation" },
                  { value: "name", label: "Name" },
                ]}
              />
            }
          />
          <CardBody>
            <ul className="flex flex-col gap-3">
              {team.map((m) => {
                const b = m.capacity ? m.billableHours / m.capacity : 0;
                const nb = m.capacity ? m.nonBillableHours / m.capacity : 0;
                const over = b + nb > 1;
                return (
                  <li key={m.name} className="flex items-center gap-3">
                    <Avatar name={m.name} size="md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate text-crm-fg">
                          {m.name} <span className="text-crm-subtle">· {m.role}</span>
                        </span>
                        <span
                          className={cn(
                            "tabular-nums",
                            b < utilisationTarget - 0.15
                              ? "text-crm-warning"
                              : over
                                ? "text-crm-danger"
                                : "text-crm-fg",
                          )}
                        >
                          {Math.round(b * 100)}%{over ? " · overbooked" : ""}
                        </span>
                      </div>
                      <div
                        className="relative flex h-2 overflow-hidden rounded-full bg-crm-muted"
                        role="img"
                        aria-label={`${m.name}: ${m.billableHours}h billable, ${m.nonBillableHours}h non-billable of ${m.capacity}h`}
                      >
                        <span
                          className="h-full bg-crm-primary"
                          style={{ width: `${Math.min(100, b * 100)}%` }}
                        />
                        <span
                          className="h-full bg-crm-subtle"
                          style={{ width: `${Math.max(0, Math.min(100 - b * 100, nb * 100))}%` }}
                        />
                        <span
                          aria-hidden
                          className="absolute inset-y-0 w-px bg-crm-fg"
                          style={{ left: `${utilisationTarget * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader bordered title="Revenue by client" description={money.format(clientTotal)} />
          <CardBody className="flex flex-col gap-3">
            {topShare > concentrationLimit && top ? (
              <p
                role="alert"
                className="flex items-start gap-1.5 rounded-crm border border-tag-amber-border bg-tag-amber-bg p-2 text-xs text-tag-amber-text"
              >
                <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                {top.client} is {Math.round(topShare * 100)}% of revenue — above the{" "}
                {Math.round(concentrationLimit * 100)}% concentration limit.
              </p>
            ) : null}
            <ol className="flex flex-col gap-2">
              {clients.map((c, i) => {
                const share = clientTotal ? c.revenue / clientTotal : 0;
                return (
                  <li key={c.client} className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-crm-fg">
                        <span className="mr-1.5 text-crm-faint tabular-nums">{i + 1}</span>
                        {c.client}
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {money.format(c.revenue)}
                        <Tag size="sm" color={share > concentrationLimit ? "amber" : "neutral"}>
                          {Math.round(share * 100)}%
                        </Tag>
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-crm-muted" aria-hidden>
                      <div
                        className="h-full rounded-full bg-crm-primary"
                        style={{ width: `${share * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
