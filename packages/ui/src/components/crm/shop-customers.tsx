import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Mail, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { SearchInput } from "@/components/crm/search-input";
import { Tag, type TagColor } from "@/components/crm/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableFooterBar,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/crm/data-table";

export interface ShopCustomer {
  id: string;
  name: string;
  email: string;
  city?: string;
  orders: number;
  /** Lifetime net spend (after refunds). */
  totalSpent: number;
  /** ISO date of first order. */
  firstOrder: string;
  /** ISO date of last order. */
  lastOrder: string;
  acceptsMarketing: boolean;
}

export type RfmSegment = "champions" | "loyal" | "new" | "at-risk" | "hibernating" | "lost";

export interface ShopCustomersProps {
  customers: ShopCustomer[];
  today?: Date;
  currency?: string;
  locale?: string;
  loading?: boolean;
  error?: string;
  onOpenCustomer?: (customer: ShopCustomer) => void;
  /** Receives customers of the active segment that accept marketing. */
  onExportSegment?: (segment: RfmSegment | "all", customers: ShopCustomer[]) => void;
  className?: string;
}

const segMeta: Record<RfmSegment, { label: string; color: TagColor; hint: string }> = {
  champions: {
    label: "Champions",
    color: "green",
    hint: "Bought recently, often, and spend the most",
  },
  loyal: { label: "Loyal", color: "teal", hint: "Repeat buyers with steady spend" },
  new: { label: "New", color: "blue", hint: "First order in the last 30 days" },
  "at-risk": { label: "At risk", color: "amber", hint: "Valuable but haven't ordered in a while" },
  hibernating: { label: "Hibernating", color: "neutral", hint: "Low frequency, long gap" },
  lost: { label: "Lost", color: "red", hint: "No order in 180+ days" },
};

const DAY = 86_400_000;

/** Scores 1–5 by rank position within the dataset (ties share the lower score). */
function rankScore(values: number[], v: number) {
  if (values.length <= 1) return 3;
  const below = values.filter((x) => x < v).length;
  return 1 + Math.floor((below / values.length) * 5);
}

/** RFM segmentation relative to the provided customer base. Returns a map of id → { r, f, m, segment }. */
export function rfmSegments(customers: ShopCustomer[], today: Date) {
  const recency = (c: ShopCustomer) =>
    Math.max(0, (today.getTime() - new Date(`${c.lastOrder}T00:00:00`).getTime()) / DAY);
  const rec = customers.map((c) => -recency(c));
  const freq = customers.map((c) => c.orders);
  const mon = customers.map((c) => c.totalSpent);
  const out = new Map<
    string,
    { r: number; f: number; m: number; days: number; segment: RfmSegment }
  >();
  for (const c of customers) {
    const days = recency(c);
    const r = rankScore(rec, -days);
    const f = rankScore(freq, c.orders);
    const m = rankScore(mon, c.totalSpent);
    const firstAge = (today.getTime() - new Date(`${c.firstOrder}T00:00:00`).getTime()) / DAY;
    let segment: RfmSegment;
    if (days > 180) segment = "lost";
    else if (firstAge <= 30 && c.orders <= 1) segment = "new";
    else if (r >= 4 && f >= 4 && m >= 4) segment = "champions";
    else if (r <= 2 && (f >= 3 || m >= 4)) segment = "at-risk";
    else if (f >= 3) segment = "loyal";
    else segment = "hibernating";
    out.set(c.id, { r, f, m, days: Math.round(days), segment });
  }
  return out;
}

type SortKey = "totalSpent" | "orders" | "aov" | "lastOrder";

/** E-commerce customer list with automatic RFM segmentation, segment revenue share, AOV and marketing-consent aware export. */
export function ShopCustomers({
  customers,
  today = new Date(),
  currency = "USD",
  locale = "en-US",
  loading,
  error,
  onOpenCustomer,
  onExportSegment,
  className,
}: ShopCustomersProps) {
  const [segment, setSegment] = React.useState<RfmSegment | "all">("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "totalSpent",
    dir: -1,
  });
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const money2 = new Intl.NumberFormat(locale, { style: "currency", currency });

  const rfm = rfmSegments(customers, today);
  const total = customers.reduce((s, c) => s + c.totalSpent, 0);
  const segs = (Object.keys(segMeta) as RfmSegment[]).map((s) => {
    const list = customers.filter((c) => rfm.get(c.id)?.segment === s);
    return { s, count: list.length, revenue: list.reduce((a, c) => a + c.totalSpent, 0) };
  });

  const q = query.trim().toLowerCase();
  const aov = (c: ShopCustomer) => (c.orders ? c.totalSpent / c.orders : 0);
  const rows = customers
    .filter((c) => segment === "all" || rfm.get(c.id)?.segment === segment)
    .filter((c) => !q || `${c.name} ${c.email} ${c.city ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const v = (c: ShopCustomer) => (sort.key === "aov" ? aov(c) : c[sort.key]);
      const x = v(a);
      const y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  const reachable = rows.filter((c) => c.acceptsMarketing);
  const rowsRevenue = rows.reduce((s, c) => s + c.totalSpent, 0);
  const rowsOrders = rows.reduce((s, c) => s + c.orders, 0);
  const repeat = rows.filter((c) => c.orders > 1).length;

  const head = (k: SortKey, label: string) => (
    <TableHead
      align="right"
      aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() =>
          setSort((s) =>
            s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: -1 },
          )
        }
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
      >
        {label}
        {sort.key === k ? (
          sort.dir === 1 ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </TableHead>
  );

  return (
    <section aria-label="Shop customers" className={cn("flex flex-col gap-3 font-crm", className)}>
      <div
        role="radiogroup"
        aria-label="Customer segment"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {segs.map(({ s, count, revenue }) => {
          const active = segment === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              title={segMeta[s].hint}
              onClick={() => setSegment(active ? "all" : s)}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-crm border p-3 text-left shadow-crm-raised transition-colors focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none",
                active
                  ? "border-crm-primary bg-crm-raised"
                  : "border-crm-border bg-crm-card hover:bg-crm-raised/60",
              )}
            >
              <Tag size="sm" color={segMeta[s].color} className="self-start">
                {segMeta[s].label}
              </Tag>
              <span className="text-lg font-semibold text-crm-fg tabular-nums">{count}</span>
              <span className="text-xs text-crm-subtle tabular-nums">
                {total ? Math.round((revenue / total) * 100) : 0}% of revenue
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border p-3">
          <p className="text-xs text-crm-soft" aria-live="polite">
            {segment === "all" ? "All customers" : segMeta[segment].hint} · {rows.length} shown
          </p>
          <div className="flex items-center gap-2">
            <SearchInput
              size="sm"
              className="w-56"
              placeholder="Name, email, city…"
              value={query}
              onValueChange={setQuery}
              aria-label="Search customers"
            />
            {onExportSegment ? (
              <button
                type="button"
                disabled={!reachable.length}
                onClick={() => onExportSegment(segment, reachable)}
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-crm-raised px-2.5 text-xs text-crm-fg shadow-crm-raised hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail className="size-3" aria-hidden /> Email {reachable.length} opted-in
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <EmptyState
            tone="error"
            icon={<AlertTriangle />}
            title="Couldn't load customers"
            description={error}
          />
        ) : loading ? (
          <div className="flex flex-col gap-2 p-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No customers here"
            description="Pick another segment or clear the search."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Segment</TableHead>
                {head("orders", "Orders")}
                {head("aov", "AOV")}
                {head("totalSpent", "Lifetime spend")}
                {head("lastOrder", "Last order")}
                <TableHead>RFM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const x = rfm.get(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onOpenCustomer?.(c)}
                        className="flex cursor-pointer items-center gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                      >
                        <Avatar name={c.name} size="md" />
                        <span className="flex flex-col">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-crm-subtle">
                            {c.email}
                            {c.city ? ` · ${c.city}` : ""}
                            {!c.acceptsMarketing ? " · no marketing" : ""}
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      {x ? (
                        <Tag size="sm" color={segMeta[x.segment].color}>
                          {segMeta[x.segment].label}
                        </Tag>
                      ) : null}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {c.orders}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {money2.format(aov(c))}
                    </TableCell>
                    <TableCell align="right" className="font-medium tabular-nums">
                      {money.format(c.totalSpent)}
                    </TableCell>
                    <TableCell
                      align="right"
                      className={cn(
                        "text-xs tabular-nums",
                        (x?.days ?? 0) > 90 ? "text-crm-warning" : "text-crm-soft",
                      )}
                    >
                      {x ? (x.days === 0 ? "Today" : `${x.days}d ago`) : ""}
                    </TableCell>
                    <TableCell>
                      {x ? (
                        <span
                          className="font-mono text-xs text-crm-soft"
                          aria-label={`Recency ${x.r}, frequency ${x.f}, monetary ${x.m}`}
                        >
                          {x.r}
                          {x.f}
                          {x.m}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!loading && !error && rows.length ? (
          <TableFooterBar
            cells={[
              { label: "customers", value: rows.length },
              { label: "revenue", value: money.format(rowsRevenue) },
              { label: "AOV", value: money2.format(rowsOrders ? rowsRevenue / rowsOrders : 0) },
              { label: "repeat rate", value: `${Math.round((repeat / rows.length) * 100)}%` },
              { label: "reachable", value: reachable.length },
            ]}
          />
        ) : null}
      </div>
    </section>
  );
}
