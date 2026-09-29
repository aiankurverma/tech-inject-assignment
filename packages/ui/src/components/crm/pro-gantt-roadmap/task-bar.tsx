import * as React from "react";
import { cn } from "@/lib/utils";
import { useGantt, useGanttApi, type DragMode } from "@/hooks/use-gantt-store";

export interface TaskBarProps {
  id: string;
  name: string;
  /** Day indices on the timeline axis (end exclusive). */
  s: number;
  e: number;
  bs?: number;
  be?: number;
  dayWidth: number;
  rowHeight: number;
  progress: number;
  summary: boolean;
  milestone: boolean;
  critical: boolean;
  conflict: boolean;
  color?: string;
  readOnly?: boolean;
  onCommit: (id: string, ds: number, de: number) => void;
  onHover: (id: string | null, el: HTMLElement | null) => void;
}

function BarImpl({
  id,
  name,
  s,
  e,
  bs,
  be,
  dayWidth: dw,
  rowHeight,
  progress,
  summary,
  milestone,
  critical,
  conflict,
  color,
  readOnly,
  onCommit,
  onHover,
}: TaskBarProps) {
  const api = useGanttApi();
  const preview = useGantt((st) => (st.preview?.id === id ? st.preview : null));
  const showBaseline = useGantt((st) => st.showBaseline);
  const drag = React.useRef<{ mode: DragMode; x: number; ds: number; de: number } | null>(null);

  const ds = preview?.ds ?? 0;
  const de = preview?.de ?? 0;
  const left = (s + ds) * dw;
  const width = Math.max((e + de - (s + ds)) * dw, milestone ? 0 : Math.max(dw, 4));
  const barH = summary ? 8 : 20;
  const top = (rowHeight - barH) / 2 - (showBaseline && bs != null ? 4 : 0);

  const begin = (mode: DragMode) => (ev: React.PointerEvent<HTMLElement>) => {
    if (readOnly || summary || ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    drag.current = { mode, x: ev.clientX, ds: 0, de: 0 };
    api.getState().select(id);
  };
  const move = (ev: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((ev.clientX - d.x) / dw);
    const nds = d.mode === "end" ? 0 : delta;
    let nde = d.mode === "start" ? 0 : delta;
    // Keep at least one day when resizing.
    if (d.mode === "end" && e + nde <= s) nde = s - e + 1;
    const fixedDs = d.mode === "start" && s + nds >= e ? e - s - 1 : nds;
    if (fixedDs !== d.ds || nde !== d.de) {
      d.ds = fixedDs;
      d.de = nde;
      api.getState().setPreview({ id, ds: fixedDs, de: nde });
    }
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d) onCommit(id, d.ds, d.de);
  };

  const tone = critical
    ? "bg-crm-danger/85"
    : (color ?? (summary ? "bg-crm-soft" : "bg-crm-primary"));

  return (
    <>
      {showBaseline && bs != null && be != null && !summary && (
        <div
          aria-hidden
          className="absolute h-1.5 rounded-full bg-crm-faint"
          style={{ left: bs * dw, width: Math.max((be - bs) * dw, 3), top: rowHeight / 2 + 7 }}
        />
      )}
      {milestone ? (
        <div
          data-bar={id}
          onPointerDown={begin("move")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerEnter={(ev) => onHover(id, ev.currentTarget)}
          onPointerLeave={() => onHover(null, null)}
          className={cn(
            "absolute size-3.5 rotate-45 rounded-[2px] border-2 border-crm-card",
            critical ? "bg-crm-danger" : "bg-crm-warning",
            !readOnly && "cursor-grab active:cursor-grabbing",
          )}
          style={{ left: left - 7, top: rowHeight / 2 - 7 }}
        />
      ) : (
        <div
          data-bar={id}
          onPointerDown={begin("move")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerEnter={(ev) => onHover(id, ev.currentTarget)}
          onPointerLeave={() => onHover(null, null)}
          className={cn(
            "group/bar absolute overflow-hidden",
            summary ? "rounded-[2px]" : "rounded-[5px] shadow-crm-raised",
            conflict && "ring-2 ring-crm-warning",
            !readOnly && !summary && "cursor-grab active:cursor-grabbing",
            preview && "opacity-90 ring-2 ring-crm-ring",
          )}
          style={{ left, width, top, height: barH }}
        >
          <div className={cn("absolute inset-0 opacity-40", tone)} />
          <div
            className={cn("absolute inset-y-0 left-0", tone)}
            style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }}
          />
          {!summary && width > 60 && (
            <span className="relative block truncate px-2 text-[11px] leading-5 text-crm-fg">
              {name}
            </span>
          )}
          {!readOnly && !summary && (
            <>
              <span
                onPointerDown={begin("start")}
                onPointerMove={move}
                onPointerUp={end}
                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover/bar:bg-crm-fg/40 group-hover/bar:opacity-100"
              />
              <span
                onPointerDown={begin("end")}
                onPointerMove={move}
                onPointerUp={end}
                className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover/bar:bg-crm-fg/40 group-hover/bar:opacity-100"
              />
            </>
          )}
        </div>
      )}
      {!summary && (milestone || width <= 60) && (
        <span
          className="pointer-events-none absolute truncate text-[11px] whitespace-nowrap text-crm-soft"
          style={{
            left: left + (milestone ? 12 : width + 6),
            top: rowHeight / 2 - 8,
            maxWidth: 220,
          }}
        >
          {name}
        </span>
      )}
    </>
  );
}

export const TaskBar = React.memo(BarImpl);
