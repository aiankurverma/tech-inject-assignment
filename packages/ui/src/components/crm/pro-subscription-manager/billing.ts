/**
 * Subscription domain types and proration maths. Amounts are integer minor units; proration uses
 * exact seconds-in-period ratios (date-fns for calendar maths) with half-even rounding so previews
 * match what a Stripe-style biller would charge to the cent.
 */
import { addMonths, addYears, differenceInSeconds, isAfter, parseISO } from "date-fns";

export type Interval = "month" | "year";

export interface Plan {
  id: string;
  name: string;
  description?: string;
  /** Rank for upgrade/downgrade direction (higher = better plan). */
  rank: number;
  /** Per-seat price per interval in minor units. */
  prices: Record<Interval, number>;
  features: string[];
  minSeats?: number;
  maxSeats?: number;
  /** Plans flagged legacy cannot be switched to. */
  legacy?: boolean;
}

export type SubscriptionStatus = "active" | "trialing" | "paused" | "past_due" | "canceling";

export interface TimelineEvent {
  id: string;
  at: string;
  kind:
    | "created"
    | "upgrade"
    | "downgrade"
    | "seats"
    | "paused"
    | "resumed"
    | "cancel"
    | "offer"
    | "invoice";
  title: string;
  detail?: string;
}

export interface Subscription {
  id: string;
  customer: string;
  planId: string;
  interval: Interval;
  seats: number;
  currency: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  /** ISO date when a pause ends; null = paused indefinitely. */
  resumesAt?: string | null;
  /** Change scheduled for the period end (downgrades). */
  scheduledChange?: { planId: string; interval: Interval; seats: number } | null;
  /** Account credit balance in minor units (positive = customer credit). */
  creditBalance: number;
  /** Percentage discount in bp applied to recurring charges (e.g. retention offer). */
  discountBp?: number;
  discountEndsAt?: string | null;
  taxRateBp?: number;
  events: TimelineEvent[];
}

export interface RetentionOffer {
  id: string;
  title: string;
  description: string;
  discountBp: number;
  months: number;
}

export interface InvoiceLine {
  description: string;
  amount: number;
  kind: "charge" | "credit" | "discount" | "tax";
}

export interface InvoicePreview {
  date: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  creditApplied: number;
  total: number;
}

function divRound(n: bigint, d: bigint): bigint {
  const neg = n < 0n;
  const a = neg ? -n : n;
  const q = a / d;
  const r = a % d;
  const res = r * 2n > d || (r * 2n === d && q % 2n === 1n) ? q + 1n : q;
  return neg ? -res : res;
}

/** minor * num / den with banker's rounding. */
export function ratio(minor: number, num: number, den: number): number {
  if (den <= 0) return 0;
  return Number(divRound(BigInt(minor) * BigInt(Math.round(num)), BigInt(Math.round(den))));
}

export const bpOf = (minor: number, bp: number) => ratio(minor, bp, 10_000);

export function addInterval(date: Date, interval: Interval): Date {
  return interval === "month" ? addMonths(date, 1) : addYears(date, 1);
}

export function priceFor(plan: Plan, interval: Interval, seats: number): number {
  return plan.prices[interval] * seats;
}

export interface ChangeInput {
  planId: string;
  interval: Interval;
  seats: number;
  timing: "now" | "period_end";
}

export interface ProrationPreview {
  direction: "upgrade" | "downgrade" | "same";
  credit: number;
  charge: number;
  /** Amount due now after credit (negative = credit carried to balance). */
  dueNow: number;
  nextRecurring: number;
  nextBillingDate: string;
  remainingRatio: number;
  lines: InvoiceLine[];
}

/**
 * Preview a plan/interval/seat change.
 * - Same interval, timing now: credit unused time on the old price, charge remaining time on the new.
 * - Interval change, timing now: credit unused time, charge a full new period starting now.
 * - timing period_end: nothing due now; the change applies at renewal.
 */
export function previewChange(
  sub: Subscription,
  plans: ReadonlyMap<string, Plan>,
  input: ChangeInput,
  now: Date = new Date(),
): ProrationPreview {
  const current = plans.get(sub.planId);
  const target = plans.get(input.planId);
  if (!current || !target) throw new RangeError("Unknown plan");
  const oldPrice = priceFor(current, sub.interval, sub.seats);
  const newPrice = priceFor(target, input.interval, input.seats);
  const oldMonthly = sub.interval === "year" ? oldPrice / 12 : oldPrice;
  const newMonthly = input.interval === "year" ? newPrice / 12 : newPrice;
  const direction =
    target.rank !== current.rank
      ? target.rank > current.rank
        ? "upgrade"
        : "downgrade"
      : newMonthly === oldMonthly
        ? "same"
        : newMonthly > oldMonthly
          ? "upgrade"
          : "downgrade";

  const start = parseISO(sub.currentPeriodStart);
  const end = parseISO(sub.currentPeriodEnd);
  const total = Math.max(1, differenceInSeconds(end, start));
  const remaining = Math.min(total, Math.max(0, differenceInSeconds(end, now)));
  const disc = sub.discountBp ?? 0;
  const net = (m: number) => m - bpOf(m, disc);

  if (input.timing === "period_end") {
    return {
      direction,
      credit: 0,
      charge: 0,
      dueNow: 0,
      nextRecurring: net(newPrice),
      nextBillingDate: sub.currentPeriodEnd,
      remainingRatio: remaining / total,
      lines: [],
    };
  }

  const credit = net(ratio(oldPrice, remaining, total));
  const intervalChanged = input.interval !== sub.interval;
  const charge = intervalChanged ? net(newPrice) : net(ratio(newPrice, remaining, total));
  const nextBillingDate = intervalChanged
    ? addInterval(now, input.interval).toISOString()
    : sub.currentPeriodEnd;
  const lines: InvoiceLine[] = [
    {
      kind: "credit",
      description: `Unused time on ${current.name} × ${sub.seats}`,
      amount: -credit,
    },
    {
      kind: "charge",
      description: intervalChanged
        ? `${target.name} × ${input.seats} (${input.interval}ly, new period)`
        : `Remaining time on ${target.name} × ${input.seats}`,
      amount: charge,
    },
  ];
  return {
    direction,
    credit,
    charge,
    dueNow: charge - credit,
    nextRecurring: net(newPrice),
    nextBillingDate,
    remainingRatio: remaining / total,
    lines,
  };
}

/** Next renewal invoice, honouring scheduled changes, pauses, discounts, tax and credit balance. */
export function upcomingInvoice(
  sub: Subscription,
  plans: ReadonlyMap<string, Plan>,
): InvoicePreview | null {
  if (sub.status === "canceling") return null;
  const change = sub.scheduledChange;
  const plan = plans.get(change?.planId ?? sub.planId);
  if (!plan) return null;
  const interval = change?.interval ?? sub.interval;
  const seats = change?.seats ?? sub.seats;
  const date = sub.status === "paused" && sub.resumesAt ? sub.resumesAt : sub.currentPeriodEnd;
  const base = priceFor(plan, interval, seats);
  const lines: InvoiceLine[] = [
    { kind: "charge", description: `${plan.name} × ${seats} seats (${interval}ly)`, amount: base },
  ];
  const discountActive =
    (sub.discountBp ?? 0) > 0 &&
    (!sub.discountEndsAt || isAfter(parseISO(sub.discountEndsAt), parseISO(date)));
  const discount = discountActive ? bpOf(base, sub.discountBp ?? 0) : 0;
  if (discount)
    lines.push({ kind: "discount", description: "Retention discount", amount: -discount });
  const subtotal = base - discount;
  const tax = bpOf(subtotal, sub.taxRateBp ?? 0);
  if (tax) lines.push({ kind: "tax", description: "Tax", amount: tax });
  const creditApplied = Math.min(Math.max(0, sub.creditBalance), subtotal + tax);
  if (creditApplied)
    lines.push({ kind: "credit", description: "Account credit", amount: -creditApplied });
  return { date, lines, subtotal, tax, creditApplied, total: subtotal + tax - creditApplied };
}

const fmts = new Map<string, Intl.NumberFormat>();
export function formatMoney(minor: number, currency: string, locale = "en-US"): string {
  const key = `${locale}|${currency}`;
  let f = fmts.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: "currency", currency });
    fmts.set(key, f);
  }
  const exp = f.resolvedOptions().maximumFractionDigits ?? 2;
  return f.format(minor / 10 ** exp);
}
