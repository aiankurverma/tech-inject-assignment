import * as React from "react";
import {
  DateRangePicker,
  previousPeriod,
  rangeDays,
  type DateRange,
} from "@/components/crm/date-range-picker";

const today = new Date();
const d = (offset: number) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);

// Synthetic closed-won revenue per day, deterministic so totals are stable.
const revenueOn = (day: Date) => {
  const seed = day.getFullYear() * 372 + day.getMonth() * 31 + day.getDate();
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  return weekend ? 0 : 4_000 + (((seed * 9301 + 49297) % 233280) / 233280) * 18_000;
};

const sum = (r: DateRange) => {
  let total = 0;
  for (let i = 0; i < rangeDays(r); i++)
    total += revenueOn(new Date(r.from.getFullYear(), r.from.getMonth(), r.from.getDate() + i));
  return total;
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function Example() {
  const [range, setRange] = React.useState<DateRange | null>({ from: d(-29), to: d(0) });
  const total = range ? sum(range) : 0;
  const prev = range ? sum(previousPeriod(range)) : 0;
  const delta = prev ? ((total - prev) / prev) * 100 : 0;
  return (
    <div className="flex w-[420px] flex-col gap-4 font-crm">
      <div className="flex flex-wrap items-start gap-3">
        <DateRangePicker
          aria-label="Reporting period"
          value={range}
          onChange={setRange}
          max={today}
          maxDays={180}
          showComparison
        />
        <DateRangePicker
          aria-label="Contract term"
          placeholder="Contract term"
          presets={false}
          min={today}
        />
      </div>
      <div className="rounded-crm border border-crm-border bg-crm-card p-4">
        <p className="crm-eyebrow text-crm-subtle">Closed-won revenue</p>
        {range ? (
          <>
            <p className="mt-2 text-2xl font-semibold text-crm-fg tabular-nums">
              {usd.format(total)}
            </p>
            <p className="mt-1 text-xs text-crm-soft">
              {rangeDays(range)} days ·{" "}
              <span className={delta >= 0 ? "text-crm-success" : "text-crm-danger"}>
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}%
              </span>{" "}
              vs previous period
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-crm-soft">Choose a period to see revenue.</p>
        )}
      </div>
    </div>
  );
}
