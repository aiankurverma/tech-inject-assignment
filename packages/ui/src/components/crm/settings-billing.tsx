import * as React from "react";
import { AlertTriangle, Check, CreditCard, Download, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Tag } from "@/components/crm/tag";

export interface BillingPlan {
  id: string;
  name: string;
  /** Price per seat per month on monthly billing, in major units. */
  seatPrice: number;
  features: string[];
  /** Hard seat cap for the plan, if any. */
  maxSeats?: number;
  recommended?: boolean;
}

export interface BillingUsage {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

export interface BillingInvoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: "paid" | "open" | "failed" | "refunded";
  url?: string;
}

export interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export type BillingCycle = "monthly" | "annual";

export interface BillingSelection {
  planId: string;
  seats: number;
  cycle: BillingCycle;
}

export interface SettingsBillingProps {
  plans: BillingPlan[];
  current: BillingSelection;
  /** Seats in use; you cannot drop below this. */
  seatsInUse: number;
  usage?: BillingUsage[];
  invoices?: BillingInvoice[];
  paymentMethod?: PaymentMethod | null;
  currency?: string;
  locale?: string;
  /** Tax rate applied to the subtotal, e.g. 0.18 for 18% GST. */
  taxRate?: number;
  /** Annual discount, e.g. 0.2 for 20% off. */
  annualDiscount?: number;
  /** ISO date the current period renews; used for proration. */
  renewsOn: string;
  onConfirm?: (next: BillingSelection) => Promise<void> | void;
  onUpdatePaymentMethod?: () => void;
  className?: string;
}

const INVOICE_TAG = {
  paid: { color: "green", label: "Paid" },
  open: { color: "amber", label: "Open" },
  failed: { color: "red", label: "Failed" },
  refunded: { color: "neutral", label: "Refunded" },
} as const;

/** Monthly price per seat after the annual discount. */
export function effectiveSeatPrice(plan: BillingPlan, cycle: BillingCycle, discount: number) {
  return cycle === "annual" ? plan.seatPrice * (1 - discount) : plan.seatPrice;
}

/** Billing page: plan picker with monthly/annual toggle, seat stepper, live prorated quote with tax, usage meters, card expiry warning, invoice history. */
export function SettingsBilling({
  plans,
  current,
  seatsInUse,
  usage = [],
  invoices = [],
  paymentMethod,
  currency = "USD",
  locale = "en-US",
  taxRate = 0,
  annualDiscount = 0.2,
  renewsOn,
  onConfirm,
  onUpdatePaymentMethod,
  className,
}: SettingsBillingProps) {
  const [sel, setSel] = React.useState<BillingSelection>(current);
  const [active, setActive] = React.useState<BillingSelection>(current);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  const plan = plans.find((p) => p.id === sel.planId) ?? plans[0];
  const activePlan = plans.find((p) => p.id === active.planId) ?? plans[0];
  if (!plan || !activePlan) return null;

  const months = sel.cycle === "annual" ? 12 : 1;
  const seatPrice = effectiveSeatPrice(plan, sel.cycle, annualDiscount);
  const subtotal = seatPrice * sel.seats * months;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const activeMonthly = effectiveSeatPrice(activePlan, active.cycle, annualDiscount) * active.seats;
  const nextMonthly = seatPrice * sel.seats;
  const periodDays = active.cycle === "annual" ? 365 : 30;
  const daysLeft = Math.max(
    0,
    Math.min(periodDays, Math.ceil((new Date(renewsOn).getTime() - Date.now()) / 86_400_000)),
  );
  const proration =
    ((nextMonthly - activeMonthly) * (active.cycle === "annual" ? 12 : 1) * daysLeft) / periodDays;
  const changed = JSON.stringify(sel) !== JSON.stringify(active);
  const maxSeats = plan.maxSeats ?? 500;
  const seatError =
    sel.seats < seatsInUse
      ? `You have ${seatsInUse} active members. Remove members before reducing seats.`
      : sel.seats > maxSeats
        ? `${plan.name} supports up to ${maxSeats} seats.`
        : null;

  const now = new Date();
  const cardExpired =
    paymentMethod &&
    new Date(paymentMethod.expYear, paymentMethod.expMonth, 0) < new Date(now.toDateString());
  const cardExpiring =
    paymentMethod &&
    !cardExpired &&
    new Date(paymentMethod.expYear, paymentMethod.expMonth, 0).getTime() - now.getTime() <
      60 * 86_400_000;

  async function confirm() {
    if (seatError) return;
    setBusy(true);
    setMsg(null);
    try {
      await onConfirm?.(sel);
      setActive(sel);
      setMsg({ tone: "ok", text: `Subscription updated to ${plan?.name}, ${sel.seats} seats.` });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Payment failed." });
    } finally {
      setBusy(false);
    }
  }

  const setSeats = (n: number) => setSel((s) => ({ ...s, seats: Math.max(1, Math.round(n) || 1) }));

  return (
    <section className={cn("flex flex-col gap-5 font-crm", className)} aria-labelledby="bill-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="bill-h" className="text-lg font-semibold text-crm-fg">
            Plan & billing
          </h2>
          <p className="text-xs text-crm-soft">
            {activePlan.name} · {active.seats} seats · billed {active.cycle} · renews{" "}
            {new Date(renewsOn).toLocaleDateString(locale, { dateStyle: "medium" })}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Billing cycle"
          className="flex rounded-full bg-crm-muted p-0.5"
        >
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={sel.cycle === c}
              onClick={() => setSel((s) => ({ ...s, cycle: c }))}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                sel.cycle === c ? "bg-crm-raised text-crm-fg shadow-crm-raised" : "text-crm-soft",
              )}
            >
              {c}
              {c === "annual" && annualDiscount > 0 ? (
                <span className="ml-1 text-crm-success">-{Math.round(annualDiscount * 100)}%</span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div role="radiogroup" aria-label="Plan" className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const selected = p.id === sel.planId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSel((s) => ({ ...s, planId: p.id }))}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-crm-card p-4 text-left shadow-crm-raised outline-none transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                selected ? "border-crm-primary" : "border-crm-border hover:border-crm-input",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-sm font-semibold text-crm-fg">{p.name}</span>
                {p.id === active.planId ? (
                  <Tag size="sm">Current</Tag>
                ) : p.recommended ? (
                  <Tag size="sm" color="purple">
                    Popular
                  </Tag>
                ) : null}
              </span>
              <span className="text-2xl font-semibold text-crm-fg tabular-nums">
                {money(effectiveSeatPrice(p, sel.cycle, annualDiscount))}
                <span className="text-xs font-normal text-crm-soft"> /seat/mo</span>
              </span>
              <ul className="flex flex-col gap-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-crm-soft">
                    <Check className="mt-0.5 size-3 shrink-0 text-crm-success" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label htmlFor="bill-seats" className="text-sm font-medium text-crm-fg">
                  Seats
                </label>
                <p className="text-xs text-crm-soft">{seatsInUse} in use</p>
              </div>
              <div className="flex items-center gap-1">
                <Button aria-label="Remove seat" size="sm" onClick={() => setSeats(sel.seats - 1)}>
                  <Minus />
                </Button>
                <input
                  id="bill-seats"
                  inputMode="numeric"
                  value={sel.seats}
                  onChange={(e) => setSeats(Number(e.target.value.replace(/\D/g, "")))}
                  aria-invalid={!!seatError || undefined}
                  aria-describedby="bill-seats-msg"
                  className="h-8 w-16 rounded-crm border border-crm-input/60 bg-crm-raised text-center text-sm text-crm-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/40 aria-[invalid=true]:border-crm-danger"
                />
                <Button aria-label="Add seat" size="sm" onClick={() => setSeats(sel.seats + 1)}>
                  <Plus />
                </Button>
              </div>
            </div>
            {seatError ? (
              <p id="bill-seats-msg" role="alert" className="mt-2 text-xs text-crm-danger">
                {seatError}
              </p>
            ) : null}
          </div>

          {usage.length ? (
            <div className="grid gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised">
              {usage.map((u) => {
                const pct = Math.min(100, Math.round((u.used / Math.max(1, u.limit)) * 100));
                return (
                  <div key={u.label} className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                      <span className="min-w-0 text-crm-soft">{u.label}</span>
                      <span
                        className={cn(
                          "whitespace-nowrap tabular-nums",
                          pct >= 90 ? "text-crm-danger" : "text-crm-fg",
                        )}
                      >
                        {u.used.toLocaleString(locale)} / {u.limit.toLocaleString(locale)} {u.unit}
                      </span>
                    </div>
                    <div
                      role="meter"
                      aria-label={u.label}
                      aria-valuemin={0}
                      aria-valuemax={u.limit}
                      aria-valuenow={u.used}
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-crm-muted"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          pct >= 90
                            ? "bg-crm-danger"
                            : pct >= 75
                              ? "bg-crm-warning"
                              : "bg-crm-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
            <h3 className="border-b border-crm-border px-4 py-3 text-sm font-medium text-crm-fg">
              Invoices
            </h3>
            {invoices.length === 0 ? (
              <p className="p-6 text-center text-xs text-crm-soft">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-crm-border">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block text-crm-fg">{inv.number}</span>
                      <span className="text-xs text-crm-soft">
                        {new Date(inv.date).toLocaleDateString(locale, { dateStyle: "medium" })}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Tag size="sm" color={INVOICE_TAG[inv.status].color}>
                        {INVOICE_TAG[inv.status].label}
                      </Tag>
                      <span className="w-24 text-right text-crm-fg tabular-nums">
                        {money(inv.amount)}
                      </span>
                      {inv.url ? (
                        <a
                          href={inv.url}
                          aria-label={`Download ${inv.number}`}
                          className="text-crm-subtle hover:text-crm-fg"
                        >
                          <Download className="size-3.5" />
                        </a>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="flex h-fit flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised lg:sticky lg:top-4">
          <h3 className="text-sm font-medium text-crm-fg">Order summary</h3>
          <dl className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-crm-soft">
                {plan.name} × {sel.seats} × {months} mo
              </dt>
              <dd className="text-crm-fg tabular-nums">{money(subtotal)}</dd>
            </div>
            {taxRate ? (
              <div className="flex justify-between">
                <dt className="text-crm-soft">Tax ({(taxRate * 100).toFixed(0)}%)</dt>
                <dd className="text-crm-fg tabular-nums">{money(tax)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-crm-border pt-1.5 text-sm font-semibold">
              <dt className="text-crm-fg">Total per {sel.cycle === "annual" ? "year" : "month"}</dt>
              <dd className="text-crm-fg tabular-nums">{money(total)}</dd>
            </div>
            {changed ? (
              <div className="flex justify-between">
                <dt className="text-crm-soft">
                  {proration >= 0 ? "Due today (prorated)" : "Credit (prorated)"}
                </dt>
                <dd
                  className={cn(
                    "tabular-nums",
                    proration >= 0 ? "text-crm-fg" : "text-crm-success",
                  )}
                >
                  {money(Math.abs(proration))}
                </dd>
              </div>
            ) : null}
          </dl>
          <Button
            variant="primary"
            size="lg"
            disabled={!changed || !!seatError || !paymentMethod || !!cardExpired}
            loading={busy}
            onClick={confirm}
          >
            {changed ? "Confirm change" : "No changes"}
          </Button>
          {msg ? (
            <p
              role="status"
              className={cn("text-xs", msg.tone === "ok" ? "text-crm-success" : "text-crm-danger")}
            >
              {msg.text}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2 rounded-crm bg-crm-raised p-3">
            <span className="flex items-center gap-2 text-xs text-crm-fg">
              <CreditCard className="size-4 text-crm-soft" aria-hidden />
              {paymentMethod ? (
                <>
                  {paymentMethod.brand} •••• {paymentMethod.last4}
                  <span
                    className={cn(
                      cardExpired
                        ? "text-crm-danger"
                        : cardExpiring
                          ? "text-crm-warning"
                          : "text-crm-subtle",
                    )}
                  >
                    {String(paymentMethod.expMonth).padStart(2, "0")}/
                    {String(paymentMethod.expYear).slice(-2)}
                  </span>
                </>
              ) : (
                "No card on file"
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={onUpdatePaymentMethod}>
              Update
            </Button>
          </div>
          {cardExpired || cardExpiring ? (
            <p className="flex items-center gap-1.5 text-xs text-crm-warning">
              <AlertTriangle className="size-3.5" aria-hidden />
              {cardExpired ? "Card expired. Update it to change plans." : "Card expires soon."}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
