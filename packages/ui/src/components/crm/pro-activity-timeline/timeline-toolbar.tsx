import { memo } from "react";
import { Clock, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/components/crm/pro-activity-timeline/activity-item";
import {
  ACTIVITY_TYPES,
  type ActivityType,
  type TimeMode,
} from "@/components/crm/pro-activity-timeline/types";

export interface TimelineToolbarProps {
  available: readonly ActivityType[];
  types: ActivityType[];
  onTypesChange: (types: ActivityType[]) => void;
  timeMode: TimeMode;
  onTimeModeChange: (mode: TimeMode) => void;
  loadedCount: number;
  fetching: boolean;
}

export const TimelineToolbar = memo(function TimelineToolbar({
  available,
  types,
  onTypesChange,
  timeMode,
  onTimeModeChange,
  loadedCount,
  fetching,
}: TimelineToolbarProps) {
  const all = types.length === available.length;
  const toggle = (t: ActivityType) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    // keep canonical order so the query key is stable regardless of click order
    onTypesChange(ACTIVITY_TYPES.filter((x) => next.includes(x)));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2.5">
      <div
        role="group"
        aria-label="Filter by activity type"
        className="flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          aria-pressed={all}
          onClick={() => onTypesChange(all ? [] : [...available])}
          className={chip(all)}
        >
          All
        </button>
        {available.map((t) => {
          const m = TYPE_META[t];
          const on = types.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t)}
              className={chip(on)}
            >
              <m.icon className="size-3" aria-hidden />
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs tabular-nums text-crm-muted-fg" aria-live="polite">
          {fetching ? "Loading…" : `${loadedCount.toLocaleString()} loaded`}
        </span>
        <button
          type="button"
          onClick={() => onTimeModeChange(timeMode === "relative" ? "absolute" : "relative")}
          aria-label={timeMode === "relative" ? "Show absolute times" : "Show relative times"}
          className="inline-flex h-7 items-center gap-1.5 rounded-crm border border-crm-border px-2 text-xs text-crm-soft hover:bg-crm-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
        >
          {timeMode === "relative" ? (
            <History className="size-3.5" aria-hidden />
          ) : (
            <Clock className="size-3.5" aria-hidden />
          )}
          {timeMode === "relative" ? "Relative" : "Absolute"}
        </button>
      </div>
    </div>
  );
});

function chip(on: boolean) {
  return cn(
    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
    on
      ? "border-crm-primary/60 bg-crm-primary/15 text-crm-fg"
      : "border-crm-border text-crm-muted-fg hover:bg-crm-raised hover:text-crm-fg",
  );
}
