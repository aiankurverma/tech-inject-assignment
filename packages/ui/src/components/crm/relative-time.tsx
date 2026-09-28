import * as React from "react";
import { cn } from "@/lib/utils";

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** Format a date relative to `now`, e.g. "3 hours ago" or "in 2 days" ("3h ago" when short). */
export function formatRelative(
  date: Date,
  now: Date = new Date(),
  { style = "long", locale }: { style?: "long" | "short"; locale?: string } = {},
): string {
  const diff = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return style === "short" ? "now" : "just now";
  for (const [unit, secs] of units) {
    if (abs >= secs || unit === "minute") {
      const n = Math.round(diff / secs);
      if (style === "short") {
        const suffix = unit === "month" ? "mo" : unit[0];
        return n < 0 ? `${-n}${suffix} ago` : `in ${n}${suffix}`;
      }
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(n, unit);
    }
  }
  return "";
}

export interface RelativeTimeProps extends Omit<
  React.HTMLAttributes<HTMLTimeElement>,
  "title" | "style"
> {
  date: Date | string | number;
  format?: "long" | "short";
  locale?: string;
  /** Re-render interval in ms so the text stays fresh. 0 disables. */
  updateInterval?: number;
}

/**
 * "3 hours ago" in a semantic <time> element. The absolute date is exposed as a native title
 * tooltip and in the datetime attribute; the label refreshes on an interval.
 */
export function RelativeTime({
  date,
  format = "long",
  locale,
  updateInterval = 60_000,
  className,
  ...props
}: RelativeTimeProps) {
  const d = React.useMemo(() => (date instanceof Date ? date : new Date(date)), [date]);
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!updateInterval) return;
    const id = setInterval(() => setNow(new Date()), updateInterval);
    return () => clearInterval(id);
  }, [updateInterval]);
  if (Number.isNaN(d.getTime())) return null;
  const full = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    d,
  );
  return (
    <time
      dateTime={d.toISOString()}
      title={full}
      className={cn(
        "font-crm whitespace-nowrap text-crm-soft tabular-nums underline decoration-crm-faint decoration-dotted underline-offset-2",
        className,
      )}
      {...props}
    >
      {formatRelative(d, now, { style: format, locale })}
    </time>
  );
}
