import * as React from "react";
import { AlertTriangle, PackageCheck, PackageOpen, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type ReturnStatus = "requested" | "approved" | "received" | "refunded" | "rejected";
export type ReturnResolution = "refund" | "exchange" | "store_credit";
export type ItemCondition = "unopened" | "like_new" | "damaged" | "defective";

export interface ReturnLine {
  sku: string;
  name: string;
  qty: number;
  /** Unit price paid, in major currency units. */
  unitPrice: number;
  reason: string;
  condition: ItemCondition;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customer: string;
  email: string;
  /** ISO date the original order was delivered. */
  deliveredAt: string;
  /** ISO date the return was requested. */
  requestedAt: string;
  status: ReturnStatus;
  resolution: ReturnResolution;
  lines: ReturnLine[];
  /** Original outbound shipping, refunded only for defective items. */
  shipping?: number;
}

export interface ShopReturnsProps {
  returns: ReturnRequest[];
  /** Fires whenever a return moves to a new status. */
  onStatusChange?: (id: string, status: ReturnStatus, refund: number) => void;
  currency?: string;
  locale?: string;
  /** Return window in days from delivery. */
  windowDays?: number;
  /** Restocking fee in percent, charged on opened non-defective items. */
  restockingFeePct?: number;
  /** Reference "today" for window checks; defaults to now. */
  now?: Date;
  loading?: boolean;
  className?: string;
}

const statusTag: Record<ReturnStatus, { label: string; color: TagColor }> = {
  requested: { label: "Requested", color: "amber" },
  approved: { label: "Approved", color: "blue" },
  received: { label: "Received", color: "purple" },
  refunded: { label: "Refunded", color: "green" },
  rejected: { label: "Rejected", color: "red" },
};

const conditionLabel: Record<ItemCondition, string> = {
  unopened: "Unopened",
  like_new: "Like new",
  damaged: "Damaged",
  defective: "Defective",
};

const resolutionLabel: Record<ReturnResolution, string> = {
  refund: "Refund",
  exchange: "Exchange",
  store_credit: "Store credit",
};

const DAY = 86_400_000;

/** Computes the refundable amount for a return according to the restocking policy. */
export function computeRefund(r: ReturnRequest, restockingFeePct: number) {
  let subtotal = 0;
  let fee = 0;
  let defective = false;
  for (const l of r.lines) {
    const amount = l.qty * l.unitPrice;
    subtotal += amount;
    if (l.condition === "defective") defective = true;
    else if (l.condition !== "unopened") fee += (amount * restockingFeePct) / 100;
    if (l.condition === "damaged") fee += amount * 0.25;
  }
  const shipping = defective ? (r.shipping ?? 0) : 0;
  const bonus = r.resolution === "store_credit" ? subtotal * 0.05 : 0;
  const total = Math.max(0, subtotal - fee + shipping + bonus);
  return {
    subtotal,
    fee: Math.round(fee * 100) / 100,
    shipping,
    bonus,
    total: Math.round(total * 100) / 100,
  };
}

const next: Partial<Record<ReturnStatus, { to: ReturnStatus; label: string }>> = {
  requested: { to: "approved", label: "Approve & send label" },
  approved: { to: "received", label: "Mark received" },
  received: { to: "refunded", label: "Issue refund" },
};

/** E-commerce RMA queue: filter, window checks, restocking math and status workflow. */
export function ShopReturns({
  returns,
  onStatusChange,
  currency = "USD",
  locale = "en-US",
  windowDays = 30,
  restockingFeePct = 15,
  now,
  loading,
  className,
}: ShopReturnsProps) {
  const [rows, setRows] = React.useState(returns);
  React.useEffect(() => setRows(returns), [returns]);
  const [filter, setFilter] = React.useState<"all" | ReturnStatus>("requested");
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const today = React.useMemo(() => (now ?? new Date()).getTime(), [now]);

  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => filter === "all" || r.status === filter)
      .filter(
        (r) =>
          !q ||
          [r.id, r.orderId, r.customer, r.email, ...r.lines.map((l) => l.sku)].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }, [rows, filter, query]);

  const selected = rows.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const outOfWindow = (r: ReturnRequest) =>
    (new Date(r.requestedAt).getTime() - new Date(r.deliveredAt).getTime()) / DAY > windowDays;

  const pendingValue = rows
    .filter((r) => r.status === "approved" || r.status === "received")
    .reduce((s, r) => s + computeRefund(r, restockingFeePct).total, 0);

  const move = (r: ReturnRequest, status: ReturnStatus) => {
    const refund = status === "refunded" ? computeRefund(r, restockingFeePct).total : 0;
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
    onStatusChange?.(r.id, status, refund);
  };

  return (
    <section
      aria-label="Returns"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="crm-eyebrow">Returns & RMAs</span>
          <span className="text-xs text-crm-soft">
            {windowDays}-day window · {restockingFeePct}% restocking on opened items · Liability in
            flight <span className="text-crm-fg tabular-nums">{money.format(pendingValue)}</span>
          </span>
        </div>
        <SearchInput
          size="sm"
          className="w-full sm:w-60"
          placeholder="RMA, order, email or SKU"
          value={query}
          onValueChange={setQuery}
          aria-label="Search returns"
        />
      </header>
      <div className="overflow-x-auto">
        <SegmentedControl
          size="sm"
          label="Filter by status"
          value={filter}
          onValueChange={(v) => setFilter(v as "all" | ReturnStatus)}
          options={[
            { value: "all", label: "All", count: counts.all },
            ...(Object.keys(statusTag) as ReturnStatus[]).map((s) => ({
              value: s,
              label: statusTag[s].label,
              count: counts[s] ?? 0,
            })),
          ]}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading returns">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-crm bg-crm-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-crm border border-dashed border-crm-border py-10 text-center">
          <PackageOpen className="size-5 text-crm-subtle" aria-hidden />
          <p className="text-sm text-crm-fg">No returns match</p>
          <p className="text-xs text-crm-subtle">Try another status or clear the search.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ul role="listbox" aria-label="Return requests" className="flex flex-col gap-1.5">
            {visible.map((r) => {
              const refund = computeRefund(r, restockingFeePct);
              const late = outOfWindow(r);
              const age = Math.floor((today - new Date(r.requestedAt).getTime()) / DAY);
              const active = selected?.id === r.id;
              return (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={active}
                  tabIndex={0}
                  onClick={() => setSelectedId(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(r.id);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-crm border px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                    active
                      ? "border-crm-primary/60 bg-crm-raised"
                      : "border-crm-border hover:bg-crm-raised",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm text-crm-fg">
                      <span className="font-medium">{r.id}</span>
                      <span className="truncate text-crm-soft">{r.customer}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-crm-subtle">
                      {r.orderId} · {r.lines.reduce((s, l) => s + l.qty, 0)} items ·{" "}
                      {resolutionLabel[r.resolution]}
                      {r.status === "requested" && age >= 2 ? (
                        <span className="text-crm-warning">· waiting {age}d</span>
                      ) : null}
                    </span>
                  </div>
                  {late ? (
                    <span title="Requested outside the return window" className="text-crm-danger">
                      <AlertTriangle className="size-4" aria-label="Outside return window" />
                    </span>
                  ) : null}
                  <div className="flex flex-col items-end gap-1">
                    <Tag size="sm" color={statusTag[r.status].color}>
                      {statusTag[r.status].label}
                    </Tag>
                    <span className="text-xs text-crm-fg tabular-nums">
                      {money.format(refund.total)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <ReturnDetail
              r={selected}
              money={money}
              restockingFeePct={restockingFeePct}
              late={outOfWindow(selected)}
              windowDays={windowDays}
              onMove={(s) => move(selected, s)}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function ReturnDetail({
  r,
  money,
  restockingFeePct,
  late,
  windowDays,
  onMove,
}: {
  r: ReturnRequest;
  money: Intl.NumberFormat;
  restockingFeePct: number;
  late: boolean;
  windowDays: number;
  onMove: (s: ReturnStatus) => void;
}) {
  const refund = computeRefund(r, restockingFeePct);
  const step = next[r.status];
  const closed = r.status === "refunded" || r.status === "rejected";
  return (
    <article
      aria-label={`Return ${r.id}`}
      className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-raised p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-crm-fg">
            {r.id} · {r.customer}
          </span>
          <span className="text-xs text-crm-subtle">
            {r.email} · delivered {r.deliveredAt} · requested {r.requestedAt}
          </span>
        </div>
        <Tag size="sm" color={statusTag[r.status].color}>
          {statusTag[r.status].label}
        </Tag>
      </div>
      {late ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-crm border border-tag-red-border bg-tag-red-bg px-2 py-1.5 text-xs text-tag-red-text"
        >
          <AlertTriangle className="size-3.5" aria-hidden />
          Requested after the {windowDays}-day window — approve only as a goodwill exception.
        </p>
      ) : null}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-crm-subtle">
            <th className="py-1 font-normal">Item</th>
            <th className="py-1 font-normal">Reason</th>
            <th className="py-1 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.sku} className="border-t border-crm-border align-top">
              <td className="py-1.5 pr-2">
                <div className="text-crm-fg">
                  {l.qty}× {l.name}
                </div>
                <div className="text-crm-subtle">
                  {l.sku} · {conditionLabel[l.condition]}
                </div>
              </td>
              <td className="py-1.5 pr-2 text-crm-soft">{l.reason}</td>
              <td className="py-1.5 text-right text-crm-fg tabular-nums">
                {money.format(l.qty * l.unitPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-crm-border pt-2 text-xs tabular-nums">
        <dt className="text-crm-soft">Items</dt>
        <dd className="text-right text-crm-fg">{money.format(refund.subtotal)}</dd>
        {refund.fee > 0 ? (
          <>
            <dt className="text-crm-soft">Restocking / damage fees</dt>
            <dd className="text-right text-crm-danger">−{money.format(refund.fee)}</dd>
          </>
        ) : null}
        {refund.shipping > 0 ? (
          <>
            <dt className="text-crm-soft">Shipping (defective)</dt>
            <dd className="text-right text-crm-fg">{money.format(refund.shipping)}</dd>
          </>
        ) : null}
        {refund.bonus > 0 ? (
          <>
            <dt className="text-crm-soft">Store-credit bonus 5%</dt>
            <dd className="text-right text-crm-success">+{money.format(refund.bonus)}</dd>
          </>
        ) : null}
        <dt className="font-medium text-crm-fg">
          {r.resolution === "exchange" ? "Exchange value" : resolutionLabel[r.resolution]}
        </dt>
        <dd className="text-right font-medium text-crm-fg">{money.format(refund.total)}</dd>
      </dl>
      {!closed ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="danger" size="sm" onClick={() => onMove("rejected")}>
            Reject
          </Button>
          {step ? (
            <Button variant="primary" size="sm" onClick={() => onMove(step.to)}>
              {step.to === "received" ? (
                <PackageCheck aria-hidden />
              ) : step.to === "refunded" ? (
                <RotateCcw aria-hidden />
              ) : null}
              {step.label}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-right text-xs text-crm-subtle">This return is closed.</p>
      )}
    </article>
  );
}
