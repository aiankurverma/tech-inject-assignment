import * as React from "react";
import { cn } from "@/lib/utils";
import type { ThreadFilter } from "@/components/crm/pro-comment-threads/types";

const LABELS: Record<ThreadFilter, string> = {
  open: "Open",
  mine: "For me",
  resolved: "Resolved",
  all: "All",
};

/** ARIA tablist with roving focus (Arrow / Home / End). */
export function FilterBar({
  value,
  counts,
  onChange,
  filters = ["open", "mine", "resolved", "all"],
}: {
  value: ThreadFilter;
  counts: Record<ThreadFilter, number>;
  onChange: (f: ThreadFilter) => void;
  filters?: ThreadFilter[];
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % filters.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + filters.length) % filters.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = filters.length - 1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(filters[next]!);
  };
  return (
    <div role="tablist" aria-label="Filter comment threads" className="flex gap-1">
      {filters.map((f, i) => {
        const selected = f === value;
        return (
          <button
            key={f}
            ref={(n) => {
              refs.current[i] = n;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(f)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-crm px-2.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
              selected ? "bg-crm-muted text-crm-fg" : "text-crm-subtle hover:text-crm-fg",
            )}
          >
            {LABELS[f]}
            <span className="rounded-full bg-crm-bg px-1.5 text-[10px] tabular-nums text-crm-soft">
              {counts[f]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
