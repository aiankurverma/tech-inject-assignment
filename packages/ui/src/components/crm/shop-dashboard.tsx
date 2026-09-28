import * as React from "react";
import { ArrowDown, ArrowUp, RotateCcw, ShoppingBag, ShoppingCart, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Sparkline } from "@/components/crm/sparkline";

export type SalesChannel = "web" | "mobile" | "marketplace" | "pos";

export interface ShopOrderLine {
  product: string;
  qty: number;
  revenue: number;
}

export interface ShopOrder {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  channel: SalesChannel;
  customerId: string;
  lines: ShopOrderLine[];
  /** Refunded amount, 0 when none. */
  refunded: number;
}

export interface ShopDashboardProps {
  orders: ShopOrder[];
  /** Reference "today"; defaults to now. */
  now?: Date;
  currency?: string;
  locale?: string;
  defaultRange?: 7 | 30 | 90;
  className?: string;
}

const channelLabel: Record<SalesChannel, string> = {
  web: "Web store",
  mobile: "Mobile app",
  marketplace: "Marketplace",
  pos: "In-store POS",
};
const channelColor: Record<SalesChannel, string> = {
  web: "bg-crm-primary",
  mobile: "bg-crm-success",
  marketplace: "bg-crm-warning",
  pos: "bg-crm-soft",
};

const DAY = 86_400_000;
const orderTotal = (o: ShopOrder) => o.lines.reduce((s, l) => s + l.revenue, 0);
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round(((a - b) / b) * 1000) / 10);

interface RangeSlice {
  orders: ShopOrder[];
  revenue: number;
  refunds: number;
  customers: Set<string>;
}

function slice(orders: ShopOrder[], from: number, to: number): RangeSlice {
  const inRange = orders.filter((o) => {
    const t = new Date(o.date).getTime();
    return t > from && t <= to;
  });
  return {
    orders: inRange,
    revenue: inRange.reduce((s, o) => s + orderTotal(o), 0),
    refunds: inRange.reduce((s, o) => s + o.refunded, 0),
    customers: new Set(inRange.map((o) => o.customerId)),
  };
}

type SortKey = "revenue" | "qty" | "refundRate";

/** Store performance dashboard: range-aware KPIs, daily revenue, channel mix and top products. */
export function ShopDashboard({
  orders,
  now,
  currency = "USD",
  locale = "en-US",
  defaultRange = 30,
  className,
}: ShopDashboardProps) {
  const [range, setRange] = React.useState<number>(defaultRange);
  const [channel, setChannel] = React.useState<"all" | SalesChannel>("all");
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "revenue",
    desc: true,
  });
  const end = React.useMemo(() => {
    const d = now ?? new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }, [now]);

  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );
  const compact = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact" }),
    [locale, currency],
  );

  const filtered = React.useMemo(
    () => (channel === "all" ? orders : orders.filter((o) => o.channel === channel)),
    [orders, channel],
  );
  const cur = slice(filtered, end - range * DAY, end);
  const prev = slice(filtered, end - 2 * range * DAY, end - range * DAY);

  const aov = cur.orders.length ? cur.revenue / cur.orders.length : 0;
  const prevAov = prev.orders.length ? prev.revenue / prev.orders.length : 0;
  const refundRate = cur.revenue ? (cur.refunds / cur.revenue) * 100 : 0;
  const prevRefundRate = prev.revenue ? (prev.refunds / prev.revenue) * 100 : 0;

  const daily = React.useMemo(() => {
    const buckets = new Array<number>(range).fill(0);
    for (const o of cur.orders) {
      const idx = range - 1 - Math.floor((end - new Date(o.date).getTime()) / DAY);
      if (idx >= 0 && idx < range) buckets[idx] = (buckets[idx] ?? 0) + orderTotal(o);
    }
    return buckets;
  }, [cur.orders, end, range]);

  const mix = React.useMemo(() => {
    const all = slice(orders, end - range * DAY, end);
    const by = new Map<SalesChannel, number>();
    for (const o of all.orders) by.set(o.channel, (by.get(o.channel) ?? 0) + orderTotal(o));
    return { total: all.revenue, by };
  }, [orders, end, range]);

  const products = React.useMemo(() => {
    const m = new Map<
      string,
      { product: string; qty: number; revenue: number; refunded: number }
    >();
    for (const o of cur.orders) {
      const total = orderTotal(o) || 1;
      for (const l of o.lines) {
        const p = m.get(l.product) ?? { product: l.product, qty: 0, revenue: 0, refunded: 0 };
        p.qty += l.qty;
        p.revenue += l.revenue;
        p.refunded += (o.refunded * l.revenue) / total;
        m.set(l.product, p);
      }
    }
    const list = [...m.values()].map((p) => ({
      ...p,
      refundRate: p.revenue ? (p.refunded / p.revenue) * 100 : 0,
    }));
    list.sort((a, b) => (sort.desc ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]));
    return list.slice(0, 8);
  }, [cur.orders, sort]);

  const header = (key: SortKey, label: string) => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}
      className="py-1.5 text-right font-normal"
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-sm text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
      >
        {label}
        {sort.key === key ? (
          sort.desc ? (
            <ArrowDown className="size-3" aria-hidden />
          ) : (
            <ArrowUp className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  return (
    <section aria-label="Store dashboard" className={cn("flex flex-col gap-3 font-crm", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="crm-eyebrow">Store performance</span>
          <span className="text-xs text-crm-subtle">
            Last {range} days vs previous {range} days
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs text-crm-soft">
            Channel
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as "all" | SalesChannel)}
              className="h-7 rounded-crm border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-primary"
            >
              <option value="all">All channels</option>
              {(Object.keys(channelLabel) as SalesChannel[]).map((c) => (
                <option key={c} value={c}>
                  {channelLabel[c]}
                </option>
              ))}
            </select>
          </label>
          <SegmentedControl
            size="sm"
            label="Date range"
            value={String(range)}
            onValueChange={(v) => setRange(Number(v))}
            options={[
              { value: "7", label: "7d" },
              { value: "30", label: "30d" },
              { value: "90", label: "90d" },
            ]}
          />
        </div>
      </header>

      <KpiGrid
        items={[
          {
            label: "Net revenue",
            value: compact.format(cur.revenue - cur.refunds),
            delta: pct(cur.revenue - cur.refunds, prev.revenue - prev.refunds),
            icon: <Wallet />,
            trend: daily.length > 1 ? daily : undefined,
          },
          {
            label: "Orders",
            value: cur.orders.length.toLocaleString(locale),
            delta: pct(cur.orders.length, prev.orders.length),
            caption: `${cur.customers.size} customers`,
            icon: <ShoppingCart />,
          },
          {
            label: "Avg order value",
            value: money.format(aov),
            delta: pct(aov, prevAov),
            icon: <ShoppingBag />,
          },
          {
            label: "Refund rate",
            value: `${refundRate.toFixed(1)}%`,
            delta: Math.round((refundRate - prevRefundRate) * 10) / 10,
            invert: true,
            caption: "pts change",
            icon: <RotateCcw />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <span className="crm-caption text-crm-soft">Revenue by channel</span>
          {mix.total === 0 ? (
            <p className="text-xs text-crm-subtle">No orders in this range.</p>
          ) : (
            <>
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-crm-muted"
                role="img"
                aria-label="Channel revenue share"
              >
                {(Object.keys(channelLabel) as SalesChannel[]).map((c) => (
                  <span
                    key={c}
                    className={cn(
                      channelColor[c],
                      channel !== "all" && channel !== c && "opacity-30",
                    )}
                    style={{ width: `${((mix.by.get(c) ?? 0) / mix.total) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="flex flex-col gap-1.5 text-xs">
                {(Object.keys(channelLabel) as SalesChannel[]).map((c) => {
                  const v = mix.by.get(c) ?? 0;
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        aria-pressed={channel === c}
                        onClick={() => setChannel(channel === c ? "all" : c)}
                        className="flex w-full items-center gap-2 rounded-sm px-1 py-0.5 outline-none hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-primary"
                      >
                        <span className={cn("size-2 rounded-full", channelColor[c])} aria-hidden />
                        <span className="flex-1 text-left text-crm-soft">{channelLabel[c]}</span>
                        <span className="text-crm-fg tabular-nums">{money.format(v)}</span>
                        <span className="w-10 text-right text-crm-subtle tabular-nums">
                          {((v / mix.total) * 100).toFixed(0)}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-xs text-crm-subtle">Daily revenue</span>
                <Sparkline data={daily} height={40} label="Daily revenue" className="w-full" />
              </div>
            </>
          )}
        </div>

        <div className="overflow-x-auto rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <span className="crm-caption text-crm-soft">Top products</span>
          {products.length === 0 ? (
            <p className="py-6 text-center text-xs text-crm-subtle">No product sales yet.</p>
          ) : (
            <table className="mt-2 w-full min-w-[420px] text-xs">
              <thead>
                <tr>
                  <th scope="col" className="py-1.5 text-left font-normal text-crm-subtle">
                    Product
                  </th>
                  {header("qty", "Units")}
                  {header("revenue", "Revenue")}
                  {header("refundRate", "Refund %")}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product} className="border-t border-crm-border">
                    <td className="py-1.5 pr-2 text-crm-fg">{p.product}</td>
                    <td className="py-1.5 text-right text-crm-soft tabular-nums">{p.qty}</td>
                    <td className="py-1.5 text-right text-crm-fg tabular-nums">
                      {money.format(p.revenue)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 text-right tabular-nums",
                        p.refundRate > 10 ? "text-crm-danger" : "text-crm-soft",
                      )}
                    >
                      {p.refundRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
