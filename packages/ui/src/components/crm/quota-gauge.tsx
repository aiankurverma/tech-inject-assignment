import * as React from "react";
import { cn } from "@/lib/utils";

export interface QuotaGaugeProps {
  /** Closed-won so far. */
  closed: number;
  quota: number;
  /** Weighted open pipeline expected to close this period; drawn as a lighter arc. */
  forecast?: number;
  /** Period bounds used to compute expected pace. */
  periodStart: Date | string;
  periodEnd: Date | string;
  /** Defaults to now. */
  asOf?: Date | string;
  currency?: string;
  locale?: string;
  label?: string;
  size?: number;
  className?: string;
}

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/**
 * Semicircle attainment gauge: closed vs quota, forecast arc, a pace marker for where you should
 * be today, and the daily run-rate still needed to hit the number before period end.
 */
export function QuotaGauge({
  closed,
  quota,
  forecast = 0,
  periodStart,
  periodEnd,
  asOf,
  currency = "USD",
  locale,
  label = "Quota attainment",
  size = 220,
  className,
}: QuotaGaugeProps) {
  const money = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [currency, locale],
  );
  const start = toDate(periodStart).getTime();
  const end = toDate(periodEnd).getTime();
  const now = asOf ? toDate(asOf).getTime() : Date.now();
  const elapsed = end > start ? clamp((now - start) / (end - start)) : 1;
  const safeQuota = quota > 0 ? quota : 0;
  const pct = safeQuota ? closed / safeQuota : 0;
  const fPct = safeQuota ? (closed + forecast) / safeQuota : 0;
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
  const remaining = Math.max(0, safeQuota - closed);
  const perDay = daysLeft > 0 ? remaining / daysLeft : remaining;
  const ahead = pct - elapsed;
  const status = !safeQuota
    ? { text: "No quota set", tone: "text-crm-muted-fg" }
    : pct >= 1
      ? { text: "Quota hit", tone: "text-crm-success" }
      : ahead >= -0.05
        ? { text: "On pace", tone: "text-crm-success" }
        : fPct >= 1
          ? { text: "Behind, forecast covers gap", tone: "text-crm-warning" }
          : { text: "At risk", tone: "text-crm-danger" };

  const stroke = 14;
  const w = size;
  const r = (w - stroke) / 2;
  const cx = w / 2;
  const cy = r + stroke / 2;
  const len = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const paceAngle = Math.PI * (1 - elapsed);
  const px = (rad: number) => cx + rad * Math.cos(paceAngle);
  const py = (rad: number) => cy - rad * Math.sin(paceAngle);

  return (
    <div className={cn("inline-flex flex-col items-center font-crm", className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeQuota}
        aria-valuenow={closed}
        aria-valuetext={`${money.format(closed)} of ${money.format(safeQuota)}, ${Math.round(pct * 100)}%. ${status.text}`}
        className="relative"
        style={{ width: w, height: cy + 4 }}
      >
        <svg width={w} height={cy + 4} aria-hidden>
          <path
            d={arc}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="stroke-crm-track"
          />
          <path
            d={arc}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - clamp(fPct))}
            className="stroke-crm-primary/35 transition-[stroke-dashoffset] duration-700 ease-crm"
          />
          <path
            d={arc}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - clamp(pct))}
            className={cn(
              "transition-[stroke-dashoffset] duration-700 ease-crm",
              pct >= 1 ? "stroke-crm-success" : "stroke-crm-primary",
            )}
          />
          <line
            x1={px(r - stroke)}
            y1={py(r - stroke)}
            x2={px(r + stroke / 2 + 2)}
            y2={py(r + stroke / 2 + 2)}
            strokeWidth={2}
            className="stroke-crm-fg"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-[28px] leading-none font-medium text-crm-fg tabular-nums">
            {Math.round(pct * 100)}%
          </span>
          <span className="mt-1 text-xs text-crm-muted-fg tabular-nums">
            {money.format(closed)} / {money.format(safeQuota)}
          </span>
        </div>
      </div>
      <p className={cn("mt-2 text-xs font-medium", status.tone)}>{status.text}</p>
      <dl className="mt-2 grid w-full grid-cols-3 gap-2 text-center">
        <div>
          <dt className="crm-caption text-[10px] text-crm-muted-fg">Pace</dt>
          <dd className="text-xs text-crm-fg tabular-nums">{Math.round(elapsed * 100)}%</dd>
        </div>
        <div>
          <dt className="crm-caption text-[10px] text-crm-muted-fg">Forecast</dt>
          <dd className="text-xs text-crm-fg tabular-nums">{Math.round(fPct * 100)}%</dd>
        </div>
        <div>
          <dt className="crm-caption text-[10px] text-crm-muted-fg">Need / day</dt>
          <dd className="text-xs text-crm-fg tabular-nums">
            {remaining === 0 ? "—" : daysLeft === 0 ? "Closed" : money.format(perDay)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
