import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type DateRange } from "react-day-picker";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRangeValue } from "@/components/crm/pro-usage-metering-dashboard/types";

export interface RangePreset {
  label: string;
  range: (asOf: Date) => DateRangeValue;
}

export const DEFAULT_PRESETS: RangePreset[] = [
  { label: "This billing month", range: (d) => ({ from: startOfMonth(d), to: endOfMonth(d) }) },
  {
    label: "Last month",
    range: (d) => ({ from: startOfMonth(subMonths(d, 1)), to: endOfMonth(subMonths(d, 1)) }),
  },
  { label: "Last 30 days", range: (d) => ({ from: subDays(d, 29), to: d }) },
  { label: "Last 90 days", range: (d) => ({ from: subDays(d, 89), to: d }) },
];

/** Popover range picker (react-day-picker) with presets; commits only complete ranges. */
export function DateRangePicker({
  value,
  onChange,
  asOf,
  presets = DEFAULT_PRESETS,
  disabled,
}: {
  value: DateRangeValue;
  onChange: (r: DateRangeValue) => void;
  asOf: Date;
  presets?: RangePreset[];
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(value);
  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const commit = (r: DateRangeValue) => {
    onChange(r);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        className="inline-flex h-8 items-center gap-2 rounded-crm border border-crm-border bg-crm-raised px-3 text-xs text-crm-fg hover:bg-crm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-50"
        aria-label={`Date range: ${format(value.from, "MMM d, yyyy")} to ${format(value.to, "MMM d, yyyy")}`}
      >
        <CalendarDays className="h-3.5 w-3.5 text-crm-icon" aria-hidden />
        <span className="tabular-nums">
          {format(value.from, "MMM d")} - {format(value.to, "MMM d, yyyy")}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-popover p-3 text-crm-fg shadow-crm-raised sm:flex-row"
        >
          <ul className="flex flex-row flex-wrap gap-1 sm:w-36 sm:flex-col" aria-label="Presets">
            {presets.map((p) => (
              <li key={p.label}>
                <button
                  type="button"
                  onClick={() => commit(p.range(asOf))}
                  className="w-full rounded-crm px-2 py-1.5 text-left text-xs text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
          <div>
            <DayPicker
              mode="range"
              numberOfMonths={2}
              defaultMonth={subMonths(value.to, 1)}
              selected={draft}
              onSelect={setDraft}
              weekStartsOn={1}
              classNames={{
                root: "relative",
                months: "flex flex-col gap-4 sm:flex-row",
                month_caption: "mb-2 text-xs font-medium text-crm-fg",
                nav: "absolute right-3 top-3 flex gap-1",
                button_previous:
                  "h-6 w-6 rounded-crm text-crm-muted-fg hover:bg-crm-muted [&_svg]:mx-auto [&_svg]:h-3 [&_svg]:w-3 [&_svg]:fill-current",
                button_next:
                  "h-6 w-6 rounded-crm text-crm-muted-fg hover:bg-crm-muted [&_svg]:mx-auto [&_svg]:h-3 [&_svg]:w-3 [&_svg]:fill-current",
                weekday: "h-7 w-8 text-[10px] font-normal text-crm-muted-fg",
                day: "h-8 w-8 p-0 text-center text-xs",
                day_button:
                  "h-8 w-8 rounded-crm tabular-nums hover:bg-crm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                today: "font-semibold text-crm-primary",
                outside: "text-crm-faint",
                disabled: "text-crm-faint opacity-50",
                range_start: "[&>button]:bg-crm-primary [&>button]:text-crm-primary-fg",
                range_end: "[&>button]:bg-crm-primary [&>button]:text-crm-primary-fg",
                range_middle: "bg-crm-primary/20",
                selected: "",
              }}
            />
            <div className="mt-2 flex items-center justify-end gap-2 border-t border-crm-border pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 rounded-crm px-3 text-xs text-crm-muted-fg hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft?.from || !draft?.to}
                onClick={() =>
                  draft?.from && draft.to && commit({ from: draft.from, to: draft.to })
                }
                className={cn(
                  "h-7 rounded-crm bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg hover:opacity-90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-40",
                )}
              >
                Apply
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
