import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Tag } from "@/components/crm/tag";
import type { TagColor } from "@/components/crm/tag";

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: string;
  status: "active" | "paused" | "ended";
  spend: number;
  leads: number;
  /** Sales-qualified leads. */
  sqls: number;
  customers: number;
  /** Attributed closed-won revenue. */
  revenue: number;
}

export interface MarketingDashboardProps {
  campaigns: MarketingCampaign[];
  /** Map channel -> tag color for the source chips. */
  channelColors?: Record<string, TagColor>;
  currency?: string;
  className?: string;
}

type SortKey = "name" | "spend" | "leads" | "cpl" | "sqlRate" | "cac" | "roas";

const statusColor = { active: "green", paused: "amber", ended: "neutral" } as const;

/** Marketing dashboard: funnel KPIs, leads by source, and a sortable campaign ROI table. */
export function MarketingDashboard({
  campaigns,
  channelColors = {},
  currency = "USD",
  className,
}: MarketingDashboardProps) {
  const [channel, setChannel] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "roas", dir: -1 });
  const money = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    [currency],
  );

  const channels = React.useMemo(() => {
    const m = new Map<string, { leads: number; spend: number; sqls: number }>();
    for (const c of campaigns) {
      const v = m.get(c.channel) ?? { leads: 0, spend: 0, sqls: 0 };
      v.leads += c.leads;
      v.spend += c.spend;
      v.sqls += c.sqls;
      m.set(c.channel, v);
    }
    return [...m.entries()].sort((a, b) => b[1].leads - a[1].leads);
  }, [campaigns]);
  const totalLeadsAll = channels.reduce((s, [, v]) => s + v.leads, 0);

  const scoped = channel ? campaigns.filter((c) => c.channel === channel) : campaigns;
  const t = scoped.reduce(
    (a, c) => ({
      spend: a.spend + c.spend,
      leads: a.leads + c.leads,
      sqls: a.sqls + c.sqls,
      customers: a.customers + c.customers,
      revenue: a.revenue + c.revenue,
    }),
    { spend: 0, leads: 0, sqls: 0, customers: 0, revenue: 0 },
  );

  const rows = scoped
    .map((c) => ({
      ...c,
      cpl: c.leads ? c.spend / c.leads : Infinity,
      sqlRate: c.leads ? (c.sqls / c.leads) * 100 : 0,
      cac: c.customers ? c.spend / c.customers : Infinity,
      roas: c.spend ? c.revenue / c.spend : 0,
    }))
    .sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });

  const th = (key: SortKey, label: string, right = true) => {
    const on = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
        className={cn("px-3 py-2 font-medium", right && "text-right")}
      >
        <button
          type="button"
          onClick={() => setSort({ key, dir: on ? (sort.dir === 1 ? -1 : 1) : -1 })}
          className="inline-flex items-center gap-1 hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
        >
          {label}
          {on ? (
            sort.dir === 1 ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : null}
        </button>
      </th>
    );
  };

  const inf = (n: number, f: (n: number) => string) => (Number.isFinite(n) ? f(n) : "—");

  return (
    <section
      aria-label="Marketing dashboard"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Marketing performance</h2>
        {channel ? (
          <button
            type="button"
            onClick={() => setChannel(null)}
            className="text-xs text-crm-soft underline-offset-2 hover:text-crm-fg hover:underline focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
          >
            Clear filter: {channel}
          </button>
        ) : null}
      </div>
      <KpiGrid
        items={[
          { label: "Spend", value: money.format(t.spend) },
          {
            label: "Leads",
            value: t.leads.toLocaleString(),
            caption: inf(t.spend / t.leads, (n) => `${money.format(n)} CPL`),
          },
          {
            label: "Lead → SQL",
            value: t.leads ? `${((t.sqls / t.leads) * 100).toFixed(1)}%` : "—",
            caption: `${t.sqls} SQLs`,
          },
          {
            label: "Blended CAC",
            value: inf(t.spend / t.customers, money.format),
            caption: t.spend ? `ROAS ${(t.revenue / t.spend).toFixed(1)}×` : undefined,
          },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <h3 className="text-sm font-medium">Leads by source</h3>
          {channels.length === 0 ? (
            <p className="text-sm text-crm-soft">No campaigns yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {channels.map(([name, v]) => {
                const share = totalLeadsAll ? (v.leads / totalLeadsAll) * 100 : 0;
                const on = channel === name;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setChannel(on ? null : name)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-md p-2 text-left focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none",
                        on ? "bg-crm-muted" : "hover:bg-crm-muted/50",
                        channel && !on && "opacity-60",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <Tag size="sm" color={channelColors[name] ?? "neutral"}>
                          {name}
                        </Tag>
                        <span className="text-crm-soft tabular-nums">
                          {v.leads.toLocaleString()} · {share.toFixed(0)}%
                        </span>
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-crm-muted">
                        <span
                          className="block h-full rounded-full bg-crm-primary"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="overflow-x-auto rounded-crm border border-crm-border bg-crm-card shadow-crm-raised lg:col-span-2">
          <table className="w-full min-w-[640px] text-xs">
            <caption className="sr-only">Campaigns</caption>
            <thead className="border-b border-crm-border text-left text-crm-soft">
              <tr>
                {th("name", "Campaign", false)}
                {th("spend", "Spend")}
                {th("leads", "Leads")}
                {th("cpl", "CPL")}
                {th("sqlRate", "SQL %")}
                {th("cac", "CAC")}
                {th("roas", "ROAS")}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-crm-soft">
                    No campaigns for this source.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-crm-border/60 last:border-0 hover:bg-crm-muted/40"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag size="sm" color={statusColor[c.status]}>
                          {c.status}
                        </Tag>
                        <span className="truncate font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{money.format(c.spend)}</td>
                    <td className="px-3 py-2 text-right">{c.leads}</td>
                    <td className="px-3 py-2 text-right">{inf(c.cpl, money.format)}</td>
                    <td className="px-3 py-2 text-right">{c.sqlRate.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{inf(c.cac, money.format)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-medium",
                        c.roas >= 3
                          ? "text-crm-success"
                          : c.roas < 1
                            ? "text-crm-danger"
                            : "text-crm-fg",
                      )}
                    >
                      {c.roas.toFixed(1)}×
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
