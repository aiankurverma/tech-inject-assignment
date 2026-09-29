import { memo } from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpanNode } from "@/components/crm/pro-trace-waterfall/types";
import { formatDuration } from "@/components/crm/pro-trace-waterfall/time-scale";

export interface SpanRowProps {
  node: SpanNode;
  top: number;
  height: number;
  labelWidth: number;
  /** Visible window in trace time. */
  t0: number;
  span: number;
  color: string;
  collapsed: boolean;
  active: boolean;
  dimmed: boolean;
  /** Critical-path segments in trace time, or undefined when not on the path / highlight off. */
  critical?: [number, number][];
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
  onOpen: (id: string) => void;
}

const INDENT = 14;
const pct = (t: number, t0: number, span: number) => ((t - t0) / span) * 100;

/** One virtualised treegrid row: indented tree label + positioned bar. */
export const SpanRow = memo(function SpanRow({
  node,
  top,
  height,
  labelWidth,
  t0,
  span,
  color,
  collapsed,
  active,
  dimmed,
  critical,
  onToggle,
  onActivate,
  onOpen,
}: SpanRowProps) {
  const s = node.span;
  const hasKids = node.children.length > 0;
  const isErr = s.status === "error";
  const left = pct(s.startTime, t0, span);
  const width = Math.max((s.duration / span) * 100, 0.08);
  const labelRight = left + width < 78;
  return (
    <div
      id={`span-${s.spanId}`}
      role="row"
      aria-level={node.depth + 1}
      aria-expanded={hasKids ? !collapsed : undefined}
      aria-selected={active}
      onClick={() => onActivate(s.spanId)}
      onDoubleClick={() => onOpen(s.spanId)}
      style={{ height, transform: `translateY(${top}px)` }}
      className={cn(
        "absolute inset-x-0 top-0 flex cursor-default border-b border-crm-border/60 text-xs",
        active ? "bg-crm-muted" : "hover:bg-crm-raised",
        dimmed && "opacity-35",
      )}
    >
      <div
        role="gridcell"
        className="flex shrink-0 items-center gap-1 overflow-hidden border-r border-crm-border pr-2"
        style={{ width: labelWidth, paddingLeft: 6 + node.depth * INDENT }}
      >
        {hasKids ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={collapsed ? `Expand ${s.name}` : `Collapse ${s.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(s.spanId);
            }}
            className="rounded p-0.5 text-crm-muted-fg hover:text-crm-fg"
          >
            <ChevronRight
              className={cn("size-3 transition-transform", !collapsed && "rotate-90")}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span
          aria-hidden
          className="h-3 w-0.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <span className="shrink-0 font-medium text-crm-soft">{s.service}</span>
        <span className="truncate text-crm-fg">{s.name}</span>
        {(isErr || (collapsed && node.subtreeError)) && (
          <AlertCircle
            className={cn("size-3 shrink-0", isErr ? "text-crm-danger" : "text-crm-warning")}
            aria-label={isErr ? "Span errored" : "Error in collapsed children"}
          />
        )}
        {collapsed && hasKids && (
          <span className="ml-auto shrink-0 rounded bg-crm-muted px-1 text-[10px] tabular-nums text-crm-muted-fg">
            +{node.descendants}
          </span>
        )}
      </div>
      <div role="gridcell" className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute top-1/2 h-3 -translate-y-1/2 rounded-sm",
            isErr && "ring-1 ring-crm-danger",
          )}
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: color,
            opacity: critical ? 0.55 : 0.85,
          }}
        />
        {critical?.map(([a, b], i) => (
          <div
            key={i}
            aria-hidden
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-crm-fg"
            style={{
              left: `${pct(a, t0, span)}%`,
              width: `${Math.max(((b - a) / span) * 100, 0.05)}%`,
            }}
          />
        ))}
        {s.events?.map((ev, i) => (
          <span
            key={i}
            title={ev.name}
            aria-hidden
            className={cn(
              "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45",
              ev.name === "exception" ? "bg-crm-danger" : "bg-crm-chip",
            )}
            style={{ left: `${pct(ev.time, t0, span)}%` }}
          />
        ))}
        <span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-1.5 text-[10px] tabular-nums text-crm-muted-fg"
          style={
            labelRight
              ? { left: `${Math.max(0, left + width)}%` }
              : { right: `${Math.max(0, 100 - left)}%` }
          }
        >
          {formatDuration(s.duration)}
        </span>
      </div>
    </div>
  );
});
