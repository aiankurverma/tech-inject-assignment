import * as React from "react";
import { cn } from "@/lib/utils";
import type { UsageMeter } from "@/components/crm/pro-billing-portal/billing-types";

export function UsagePanel({
  usage,
  creditBalance,
  formatMoney,
  locale,
}: {
  usage: UsageMeter[];
  creditBalance: number;
  formatMoney: (m: number) => string;
  locale: string;
}) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale, { notation: "compact" }), [locale]);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-crm border border-crm-border bg-crm-card p-4">
        <p className="text-xs text-crm-muted-fg">Credit balance</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            creditBalance < 0 && "text-crm-danger",
          )}
        >
          {formatMoney(creditBalance)}
        </p>
        <p className="text-[11px] text-crm-faint">Applied automatically to your next invoice.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {usage.map((m) => {
          const pct = m.limit ? Math.min(100, (m.used / m.limit) * 100) : 0;
          const tone =
            pct >= 100 ? "bg-crm-danger" : pct >= 80 ? "bg-crm-warning" : "bg-crm-primary";
          return (
            <li
              key={m.id}
              className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4"
            >
              <div className="flex items-baseline justify-between text-sm">
                <span>{m.label}</span>
                <span className="tabular-nums text-crm-muted-fg">
                  {nf.format(m.used)}
                  {m.limit != null ? ` / ${nf.format(m.limit)}` : " · unlimited"} {m.unit}
                </span>
              </div>
              {m.limit != null && (
                <div
                  role="progressbar"
                  aria-label={m.label}
                  aria-valuemin={0}
                  aria-valuemax={m.limit}
                  aria-valuenow={m.used}
                  className="h-1.5 overflow-hidden rounded-full bg-crm-track"
                >
                  <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
