import * as React from "react";
import { TZDate } from "@date-fns/tz";
import { format, formatDistanceStrict } from "date-fns";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CronNextRunsProps {
  runs: Date[];
  timezone: string;
  /** date-fns pattern for each run. */
  dateFormat?: string;
  invalid?: boolean;
  className?: string;
}

/** Upcoming fire times rendered in the chosen timezone with relative offsets. */
export const CronNextRuns = React.memo(function CronNextRuns({
  runs,
  timezone,
  dateFormat = "EEE d MMM yyyy, HH:mm",
  invalid,
  className,
}: CronNextRunsProps) {
  const now = new Date();
  return (
    <section aria-label="Next runs" className={cn("grid gap-2", className)}>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-crm-fg">
        <CalendarClock className="size-3.5 text-crm-icon" aria-hidden />
        Next {runs.length || ""} runs
        <span className="font-normal text-crm-muted-fg">in {timezone}</span>
      </h3>
      {invalid || runs.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border px-3 py-4 text-center text-xs text-crm-muted-fg">
          {invalid ? "Fix the expression to preview upcoming runs." : "This schedule never fires."}
        </p>
      ) : (
        <ol className="grid gap-px overflow-hidden rounded-crm border border-crm-border bg-crm-border">
          {runs.map((run, i) => {
            const zoned = new TZDate(run.getTime(), timezone);
            const gap = i > 0 ? formatDistanceStrict(run, runs[i - 1]!) : null;
            return (
              <li
                key={run.getTime()}
                className="flex items-center justify-between gap-3 bg-crm-card px-3 py-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-right tabular-nums text-crm-faint">{i + 1}</span>
                  <time dateTime={run.toISOString()} className="truncate tabular-nums text-crm-fg">
                    {format(zoned, dateFormat)}
                  </time>
                </span>
                <span className="shrink-0 text-crm-muted-fg">
                  {i === 0 ? `in ${formatDistanceStrict(run, now)}` : `+${gap}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
});
