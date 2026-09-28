import * as React from "react";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { SegmentedControl } from "@/components/crm/segmented-control";

export type BillingCycle = "monthly" | "annual";

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  /** Price per seat per month when billed monthly. null = "Contact sales". 0 = free. */
  monthlyPerSeat: number | null;
  /** Price per seat per month when billed annually. Defaults to monthly minus `annualDiscount`. */
  annualPerSeat?: number;
  minSeats?: number;
  maxSeats?: number;
  /** Short bullet list on the card. */
  highlights: string[];
  ctaLabel?: string;
  recommended?: boolean;
}

export interface PricingFeatureRow {
  group: string;
  label: string;
  /** planId -> true / false / text like "10k / mo". */
  values: Record<string, boolean | string>;
}

export interface PricingTableProps {
  plans: PricingPlan[];
  /** Comparison matrix under the cards. */
  comparison?: PricingFeatureRow[];
  currency?: string;
  locale?: string;
  /** Fraction off for annual billing when a plan has no annualPerSeat. */
  annualDiscount?: number;
  cycle?: BillingCycle;
  defaultCycle?: BillingCycle;
  onCycleChange?: (cycle: BillingCycle) => void;
  defaultSeats?: number;
  onSelectPlan?: (plan: PricingPlan, quote: PlanQuote) => void;
  /** planId of the customer's current plan. */
  currentPlanId?: string;
  className?: string;
}

export interface PlanQuote {
  cycle: BillingCycle;
  seats: number;
  perSeatMonthly: number | null;
  /** Amount charged per billing period. */
  total: number | null;
  /** Saving over 12 months vs monthly billing. */
  annualSaving: number;
}

export function quotePlan(
  plan: PricingPlan,
  cycle: BillingCycle,
  seatsInput: number,
  annualDiscount: number,
): PlanQuote {
  const seats = Math.min(Math.max(seatsInput, plan.minSeats ?? 1), plan.maxSeats ?? Infinity);
  if (plan.monthlyPerSeat === null)
    return { cycle, seats, perSeatMonthly: null, total: null, annualSaving: 0 };
  const annual =
    plan.annualPerSeat ?? Math.round(plan.monthlyPerSeat * (1 - annualDiscount) * 100) / 100;
  const perSeatMonthly = cycle === "annual" ? annual : plan.monthlyPerSeat;
  const total = cycle === "annual" ? perSeatMonthly * seats * 12 : perSeatMonthly * seats;
  const annualSaving = Math.max(0, (plan.monthlyPerSeat - annual) * seats * 12);
  return { cycle, seats, perSeatMonthly, total, annualSaving };
}

/** Pricing cards with monthly/annual toggle, seat calculator (min/max seats clamp), computed totals and savings, current-plan state and a grouped comparison matrix. */
export function PricingTable({
  plans,
  comparison = [],
  currency = "USD",
  locale = "en-US",
  annualDiscount = 0.2,
  cycle,
  defaultCycle = "annual",
  onCycleChange,
  defaultSeats = 5,
  onSelectPlan,
  currentPlanId,
  className,
}: PricingTableProps) {
  const [innerCycle, setInnerCycle] = React.useState<BillingCycle>(defaultCycle);
  const activeCycle = cycle ?? innerCycle;
  const [seats, setSeats] = React.useState(defaultSeats);
  const [seatText, setSeatText] = React.useState(String(defaultSeats));
  const id = React.useId();

  const money = React.useMemo(() => {
    const whole = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    const cents = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
    return (n: number) => (Number.isInteger(n) ? whole.format(n) : cents.format(n));
  }, [currency, locale]);

  const setCycle = (c: string) => {
    const v = c as BillingCycle;
    if (cycle === undefined) setInnerCycle(v);
    onCycleChange?.(v);
  };
  const commitSeats = (n: number) => {
    const v = Number.isFinite(n) ? Math.min(10_000, Math.max(1, Math.round(n))) : 1;
    setSeats(v);
    setSeatText(String(v));
  };

  const groups = React.useMemo(() => {
    const m = new Map<string, PricingFeatureRow[]>();
    for (const r of comparison) m.set(r.group, [...(m.get(r.group) ?? []), r]);
    return [...m.entries()];
  }, [comparison]);

  const maxSaving = React.useMemo(() => {
    let best = 0;
    for (const p of plans) {
      if (!p.monthlyPerSeat) continue;
      const annual = p.annualPerSeat ?? p.monthlyPerSeat * (1 - annualDiscount);
      best = Math.max(best, (p.monthlyPerSeat - annual) / p.monthlyPerSeat);
    }
    return Math.round(best * 100);
  }, [plans, annualDiscount]);

  return (
    <section className={cn("flex w-full flex-col gap-8 font-crm text-crm-fg", className)}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <SegmentedControl
          label="Billing cycle"
          value={activeCycle}
          onValueChange={setCycle}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annual", label: `Annual · save ${maxSaving}%` },
          ]}
        />
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-seats`} className="text-xs text-crm-soft">
            Seats
          </label>
          <div className="flex items-center rounded-full bg-crm-raised shadow-crm-raised">
            <button
              type="button"
              aria-label="Remove a seat"
              disabled={seats <= 1}
              onClick={() => commitSeats(seats - 1)}
              className="grid size-[30px] cursor-pointer place-items-center rounded-full text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <input
              id={`${id}-seats`}
              inputMode="numeric"
              value={seatText}
              onChange={(e) => setSeatText(e.target.value.replace(/\D/g, ""))}
              onBlur={() => commitSeats(Number(seatText))}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSeats(Number(seatText));
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  commitSeats(seats + 1);
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  commitSeats(seats - 1);
                }
              }}
              className="w-12 bg-transparent text-center text-sm text-crm-fg tabular-nums outline-none"
            />
            <button
              type="button"
              aria-label="Add a seat"
              onClick={() => commitSeats(seats + 1)}
              className="grid size-[30px] cursor-pointer place-items-center rounded-full text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <ul
        className={cn(
          "grid gap-4 md:grid-cols-2",
          plans.length === 3 && "xl:grid-cols-3",
          plans.length >= 4 && "xl:grid-cols-4",
        )}
      >
        {plans.map((plan) => {
          const q = quotePlan(plan, activeCycle, seats, annualDiscount);
          const clamped = q.seats !== seats;
          const current = plan.id === currentPlanId;
          return (
            <li
              key={plan.id}
              aria-labelledby={`${id}-${plan.id}`}
              className={cn(
                "relative flex flex-col gap-5 rounded-crm border bg-crm-card p-5 shadow-crm-raised",
                plan.recommended ? "border-crm-primary" : "border-crm-border",
              )}
            >
              {plan.recommended ? (
                <span className="crm-caption absolute -top-2.5 left-5 rounded-full bg-crm-primary px-2 py-1 text-crm-primary-fg">
                  Most popular
                </span>
              ) : null}
              <div className="flex flex-col gap-1">
                <h3 id={`${id}-${plan.id}`} className="text-base font-medium">
                  {plan.name}
                </h3>
                <p className="min-h-8 text-xs text-crm-muted-fg">{plan.description}</p>
              </div>
              <div className="flex flex-col gap-1" aria-live="polite">
                {q.perSeatMonthly === null ? (
                  <p className="text-3xl font-semibold">Custom</p>
                ) : q.perSeatMonthly === 0 ? (
                  <p className="text-3xl font-semibold">Free</p>
                ) : (
                  <p className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tabular-nums">
                      {money(q.perSeatMonthly)}
                    </span>
                    <span className="text-xs text-crm-subtle">/ seat / mo</span>
                    {activeCycle === "annual" && plan.monthlyPerSeat ? (
                      <span className="ml-1 text-xs text-crm-subtle line-through">
                        {money(plan.monthlyPerSeat)}
                      </span>
                    ) : null}
                  </p>
                )}
                <p className="text-xs text-crm-soft tabular-nums">
                  {q.total === null
                    ? "Volume pricing for 50+ seats"
                    : q.total === 0
                      ? `Up to ${plan.maxSeats ?? "unlimited"} seats`
                      : `${money(q.total)} ${activeCycle === "annual" ? "billed yearly" : "billed monthly"} for ${q.seats} ${q.seats === 1 ? "seat" : "seats"}`}
                </p>
                {q.annualSaving > 0 ? (
                  <p className="text-xs text-crm-success tabular-nums">
                    {activeCycle === "annual" ? "You save" : "Save"} {money(q.annualSaving)} / year
                    {activeCycle === "monthly" ? " with annual" : ""}
                  </p>
                ) : null}
                {clamped ? (
                  <p className="text-xs text-crm-warning">
                    {q.seats > seats
                      ? `Minimum ${plan.minSeats} seats`
                      : `Limited to ${plan.maxSeats} seats`}
                  </p>
                ) : null}
              </div>
              <Button
                size="lg"
                variant={current ? "muted" : plan.recommended ? "primary" : "secondary"}
                disabled={current}
                onClick={() => onSelectPlan?.(plan, q)}
              >
                {current
                  ? "Current plan"
                  : (plan.ctaLabel ??
                    (plan.monthlyPerSeat === null ? "Talk to sales" : "Choose " + plan.name))}
              </Button>
              <ul className="flex flex-col gap-2 text-xs text-crm-soft">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <Check className="mt-px size-3.5 shrink-0 text-crm-success" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {groups.length ? (
        <div className="overflow-x-auto rounded-crm border border-crm-border">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <caption className="sr-only">Plan comparison</caption>
            <thead className="sticky top-0 bg-crm-card">
              <tr>
                <th scope="col" className="p-3 text-left font-medium text-crm-subtle">
                  Features
                </th>
                {plans.map((p) => (
                  <th key={p.id} scope="col" className="p-3 text-center font-medium">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map(([group, rows]) => (
              <tbody key={group}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={plans.length + 1}
                    className="crm-eyebrow border-t border-crm-border bg-crm-raised p-3 text-left text-crm-subtle uppercase"
                  >
                    {group}
                  </th>
                </tr>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-crm-border">
                    <th scope="row" className="p-3 text-left font-normal text-crm-soft">
                      {r.label}
                    </th>
                    {plans.map((p) => {
                      const v = r.values[p.id];
                      return (
                        <td key={p.id} className="p-3 text-center">
                          {v === true ? (
                            <Check
                              className="mx-auto size-3.5 text-crm-success"
                              aria-label="Included"
                            />
                          ) : v === false || v === undefined ? (
                            <Minus
                              className="mx-auto size-3.5 text-crm-subtle"
                              aria-label="Not included"
                            />
                          ) : (
                            <span className="text-crm-fg">{v}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : null}
    </section>
  );
}
