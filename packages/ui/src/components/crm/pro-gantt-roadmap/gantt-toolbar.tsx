import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronsDownUp, ChevronsUpDown, GitBranch, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGantt } from "@/hooks/use-gantt-store";
import type { GanttZoom } from "@/components/crm/pro-gantt-roadmap/types";

const ZOOMS: { id: GanttZoom; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "quarter", label: "Quarter" },
];

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-2.5 text-xs text-crm-soft transition-colors hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none";

export function GanttToolbar({
  title,
  stats,
  onToday,
  onExpandAll,
  onCollapseAll,
  onZoom,
}: {
  title: string;
  stats: { tasks: number; critical: number; end: Date | null; cycles: number };
  onToday: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onZoom: (z: GanttZoom) => void;
}) {
  const zoom = useGantt((s) => s.zoom);
  const showCritical = useGantt((s) => s.showCritical);
  const showBaseline = useGantt((s) => s.showBaseline);
  const setFlag = useGantt((s) => s.setFlag);
  const zoomRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
      <div className="mr-auto min-w-0">
        <h2 className="truncate text-base font-medium text-crm-fg">{title}</h2>
        <p className="text-xs text-crm-muted-fg tabular-nums">
          {stats.tasks.toLocaleString()} tasks · {stats.critical.toLocaleString()} critical
          {stats.end && ` · finishes ${format(stats.end, "d MMM yyyy")}`}
          {stats.cycles > 0 && (
            <span className="text-crm-warning"> · {stats.cycles} in dependency cycles</span>
          )}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Zoom"
        className="flex rounded-crm border border-crm-border p-0.5"
      >
        {ZOOMS.map((z, i) => (
          <button
            key={z.id}
            ref={(el) => {
              zoomRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={zoom === z.id}
            tabIndex={zoom === z.id ? 0 : -1}
            onClick={() => onZoom(z.id)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const n = (i + d + ZOOMS.length) % ZOOMS.length;
              zoomRefs.current[n]?.focus();
              onZoom(ZOOMS[n]!.id);
            }}
            className={cn(
              "h-7 rounded-[6px] px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
              zoom === z.id ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {z.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={showCritical}
        onClick={() => setFlag("showCritical", !showCritical)}
        className={cn(btn, showCritical && "border-crm-danger/50 text-crm-fg")}
      >
        <GitBranch className="size-3.5" aria-hidden /> Critical path
      </button>
      <button
        type="button"
        aria-pressed={showBaseline}
        onClick={() => setFlag("showBaseline", !showBaseline)}
        className={cn(btn, showBaseline && "border-crm-ring text-crm-fg")}
      >
        <Layers className="size-3.5" aria-hidden /> Baseline
      </button>
      <button type="button" className={btn} onClick={onToday}>
        <CalendarDays className="size-3.5" aria-hidden /> Today
      </button>
      <button type="button" className={btn} onClick={onExpandAll} aria-label="Expand all">
        <ChevronsUpDown className="size-3.5" aria-hidden />
      </button>
      <button type="button" className={btn} onClick={onCollapseAll} aria-label="Collapse all">
        <ChevronsDownUp className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
