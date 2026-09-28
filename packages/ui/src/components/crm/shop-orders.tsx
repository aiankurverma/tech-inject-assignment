import * as React from "react";
import { AlertTriangle, ChevronRight, PackageCheck, ShieldAlert, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type PaymentStatus = "paid" | "pending" | "refunded" | "partially-refunded" | "failed";
export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled" | "returned";

export interface OrderLine {
  sku: string;
  title: string;
  variant?: string;
  qty: number;
  unitPrice: number;
}

export interface ShopOrder {
  id: string;
  /** Display number, e.g. "#1042". */
  number: string;
  customer: string;
  /** ISO datetime the order was placed. */
  placedAt: string;
  channel: "online" | "pos" | "marketplace";
  payment: PaymentStatus;
  fulfillment: FulfillmentStatus;
  lines: OrderLine[];
  discount?: number;
  shipping?: number;
  /** Tax rate 0–1 applied to (subtotal − discount). */
  taxRate?: number;
  /** Fraud analysis result. */
  risk?: "low" | "medium" | "high";
  currency?: string;
}

export interface ShopOrdersProps {
  orders: ShopOrder[];
  /** Hours an order may stay unfulfilled before it's flagged late. */
  fulfilSlaHours?: number;
  now?: Date;
  currency?: string;
  locale?: string;
  loading?: boolean;
  error?: string;
  /** Called with ids when the user bulk-fulfils. Omit to hide the action. */
  onFulfill?: (ids: string[]) => void;
  onOpenOrder?: (order: ShopOrder) => void;
  className?: string;
}

const payMeta: Record<PaymentStatus, { label: string; color: TagColor }> = {
  paid: { label: "Paid", color: "green" },
  pending: { label: "Payment pending", color: "amber" },
  refunded: { label: "Refunded", color: "neutral" },
  "partially-refunded": { label: "Partially refunded", color: "orange" },
  failed: { label: "Payment failed", color: "red" },
};
const fulMeta: Record<FulfillmentStatus, { label: string; color: TagColor }> = {
  unfulfilled: { label: "Unfulfilled", color: "yellow" },
  partial: { label: "Partially fulfilled", color: "blue" },
  fulfilled: { label: "Fulfilled", color: "neutral" },
  returned: { label: "Returned", color: "purple" },
};

/** Order money breakdown with rounding to cents. */
export function orderTotals(o: ShopOrder) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const subtotal = r(o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const discount = r(Math.min(o.discount ?? 0, subtotal));
  const tax = r((subtotal - discount) * (o.taxRate ?? 0));
  const shipping = r(o.shipping ?? 0);
  return { subtotal, discount, tax, shipping, total: r(subtotal - discount + tax + shipping) };
}

type View = "all" | "to-fulfil" | "unpaid" | "risk" | "done";

/** Order management list: status views with counts, fulfilment SLA timers, fraud risk flags, expandable line items with tax/discount math and bulk fulfilment. */
export function ShopOrders({
  orders,
  fulfilSlaHours = 48,
  now = new Date(),
  currency = "USD",
  locale = "en-US",
  loading,
  error,
  onFulfill,
  onOpenOrder,
  className,
}: ShopOrdersProps) {
  const [view, setView] = React.useState<View>("to-fulfil");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [sel, setSel] = React.useState<string[]>([]);
  const fmt = (n: number, cur?: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: cur ?? currency }).format(n);
  const dt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const canShip = (o: ShopOrder) =>
    (o.fulfillment === "unfulfilled" || o.fulfillment === "partial") && o.payment === "paid";
  const ageHours = (o: ShopOrder) => (now.getTime() - new Date(o.placedAt).getTime()) / 3_600_000;
  const tests: Record<View, (o: ShopOrder) => boolean> = {
    all: () => true,
    "to-fulfil": canShip,
    unpaid: (o) => o.payment === "pending" || o.payment === "failed",
    risk: (o) => o.risk === "high" || o.risk === "medium",
    done: (o) => o.fulfillment === "fulfilled" || o.fulfillment === "returned",
  };

  const q = query.trim().toLowerCase();
  const rows = orders
    .filter(tests[view])
    .filter(
      (o) =>
        !q ||
        `${o.number} ${o.customer} ${o.lines.map((l) => `${l.sku} ${l.title}`).join(" ")}`
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  const selectable = rows.filter(canShip);
  const selVisible = sel.filter((id) => selectable.some((o) => o.id === id));
  const late = orders.filter((o) => canShip(o) && ageHours(o) > fulfilSlaHours).length;
  const grand = rows.reduce((s, o) => s + orderTotals(o).total, 0);
  const mixedCurrency = rows.some((o) => (o.currency ?? currency) !== currency);

  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section
      aria-label="Orders"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Order view"
          size="sm"
          value={view}
          onValueChange={(v) => {
            setView(v as View);
            setSel([]);
          }}
          options={(
            [
              ["to-fulfil", "To fulfil"],
              ["unpaid", "Unpaid"],
              ["risk", "Risk review"],
              ["done", "Completed"],
              ["all", "All"],
            ] as [View, string][]
          ).map(([value, label]) => ({ value, label, count: orders.filter(tests[value]).length }))}
        />
        {late ? (
          <span role="status" className="inline-flex items-center gap-1 text-xs text-crm-danger">
            <AlertTriangle className="size-3" aria-hidden />
            {late} past {fulfilSlaHours}h SLA
          </span>
        ) : null}
        <SearchInput
          size="sm"
          className="ml-auto w-56"
          placeholder="Order #, customer, SKU…"
          value={query}
          onValueChange={setQuery}
          aria-label="Search orders"
        />
      </div>

      {onFulfill && selectable.length ? (
        <div className="flex items-center gap-2 border-b border-crm-border bg-crm-raised px-3 py-2 text-xs text-crm-soft">
          <input
            type="checkbox"
            aria-label="Select all fulfillable orders"
            checked={selVisible.length === selectable.length}
            onChange={() =>
              setSel(selVisible.length === selectable.length ? [] : selectable.map((o) => o.id))
            }
            className="size-3.5 accent-crm-primary"
          />
          <span aria-live="polite">
            {selVisible.length
              ? `${selVisible.length} ready to ship`
              : `${selectable.length} paid orders can ship`}
          </span>
          <Button
            size="sm"
            className="ml-auto"
            disabled={!selVisible.length}
            onClick={() => {
              onFulfill(selVisible);
              setSel([]);
            }}
          >
            <PackageCheck className="size-3" aria-hidden /> Mark fulfilled
          </Button>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Couldn't load orders"
          description={error}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart />}
          title={view === "to-fulfil" ? "All caught up" : "No orders in this view"}
          description={
            view === "to-fulfil" ? "Every paid order has shipped." : "Try another view or search."
          }
        />
      ) : (
        <ul>
          {rows.map((o) => {
            const t = orderTotals(o);
            const isOpen = open.has(o.id);
            const age = ageHours(o);
            const ship = canShip(o);
            const isLate = ship && age > fulfilSlaHours;
            const items = o.lines.reduce((s, l) => s + l.qty, 0);
            return (
              <li key={o.id} className="border-b border-crm-border last:border-b-0">
                <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  {onFulfill ? (
                    <input
                      type="checkbox"
                      disabled={!ship}
                      aria-label={`Select order ${o.number}`}
                      checked={sel.includes(o.id)}
                      onChange={() =>
                        setSel((s) =>
                          s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id],
                        )
                      }
                      className="size-3.5 accent-crm-primary disabled:opacity-30"
                    />
                  ) : null}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`${o.id}-lines`}
                    aria-label={`${isOpen ? "Hide" : "Show"} items for ${o.number}`}
                    onClick={() => toggleOpen(o.id)}
                    className="grid size-6 cursor-pointer place-items-center rounded-full text-crm-soft hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                  >
                    <ChevronRight
                      className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenOrder?.(o)}
                    className="flex min-w-40 cursor-pointer flex-col rounded-sm text-left focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                  >
                    <span className="font-medium text-crm-fg">
                      {o.number} <span className="font-normal text-crm-soft">· {o.customer}</span>
                    </span>
                    <span className="text-xs text-crm-subtle">
                      {dt.format(new Date(o.placedAt))} · {o.channel} · {items} item
                      {items === 1 ? "" : "s"}
                    </span>
                  </button>
                  <span className="flex flex-wrap items-center gap-1">
                    <Tag size="sm" color={payMeta[o.payment].color}>
                      {payMeta[o.payment].label}
                    </Tag>
                    <Tag size="sm" color={fulMeta[o.fulfillment].color}>
                      {fulMeta[o.fulfillment].label}
                    </Tag>
                    {o.risk && o.risk !== "low" ? (
                      <Tag size="sm" color={o.risk === "high" ? "red" : "orange"}>
                        <ShieldAlert className="size-3" aria-hidden />
                        {o.risk} risk
                      </Tag>
                    ) : null}
                  </span>
                  <span className="ml-auto flex flex-col items-end">
                    <span className="font-medium text-crm-fg tabular-nums">
                      {fmt(t.total, o.currency)}
                    </span>
                    {ship ? (
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          isLate ? "text-crm-danger" : "text-crm-subtle",
                        )}
                      >
                        {isLate
                          ? `${Math.floor(age - fulfilSlaHours)}h past SLA`
                          : `ship within ${Math.max(0, Math.ceil(fulfilSlaHours - age))}h`}
                      </span>
                    ) : null}
                  </span>
                </div>
                {isOpen ? (
                  <div
                    id={`${o.id}-lines`}
                    className="border-t border-crm-border bg-crm-raised/40 px-3 py-2 sm:pl-16"
                  >
                    <table className="w-full text-xs">
                      <caption className="sr-only">Line items for {o.number}</caption>
                      <thead>
                        <tr className="text-crm-subtle">
                          <th scope="col" className="py-1 text-left font-normal">
                            Item
                          </th>
                          <th scope="col" className="py-1 text-right font-normal">
                            Qty
                          </th>
                          <th scope="col" className="py-1 text-right font-normal">
                            Price
                          </th>
                          <th scope="col" className="py-1 text-right font-normal">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.lines.map((l) => (
                          <tr key={l.sku} className="text-crm-fg">
                            <td className="py-1">
                              {l.title}
                              {l.variant ? (
                                <span className="text-crm-subtle"> · {l.variant}</span>
                              ) : null}
                              <span className="block font-mono text-[10px] text-crm-faint">
                                {l.sku}
                              </span>
                            </td>
                            <td className="text-right tabular-nums">{l.qty}</td>
                            <td className="text-right tabular-nums">
                              {fmt(l.unitPrice, o.currency)}
                            </td>
                            <td className="text-right tabular-nums">
                              {fmt(l.qty * l.unitPrice, o.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="text-crm-soft">
                        {(
                          [
                            ["Subtotal", t.subtotal],
                            ["Discount", -t.discount],
                            [`Tax${o.taxRate ? ` (${(o.taxRate * 100).toFixed(2)}%)` : ""}`, t.tax],
                            ["Shipping", t.shipping],
                          ] as [string, number][]
                        )
                          .filter(([label, v]) => v !== 0 || label === "Subtotal")
                          .map(([label, v]) => (
                            <tr key={label}>
                              <th scope="row" colSpan={3} className="pt-1 text-right font-normal">
                                {label}
                              </th>
                              <td className="pt-1 text-right tabular-nums">{fmt(v, o.currency)}</td>
                            </tr>
                          ))}
                        <tr className="text-crm-fg">
                          <th scope="row" colSpan={3} className="pt-1 text-right font-medium">
                            Total
                          </th>
                          <td className="pt-1 text-right font-medium tabular-nums">
                            {fmt(t.total, o.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !error && rows.length ? (
        <p className="border-t border-crm-border px-3 py-2 text-right text-xs text-crm-soft tabular-nums">
          {rows.length} orders ·{" "}
          {mixedCurrency ? "mixed currencies — totals shown per order" : `${fmt(grand)} gross`}
        </p>
      ) : null}
    </section>
  );
}
