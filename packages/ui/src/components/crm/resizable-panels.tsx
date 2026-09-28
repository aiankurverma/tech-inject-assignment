import * as React from "react";
import { cn } from "@/lib/utils";

export interface PanelConfig {
  id: string;
  /** Initial size in percent. Sizes are normalised to total 100. */
  defaultSize: number;
  minSize?: number;
  maxSize?: number;
  /** Allows collapsing to `collapsedSize` (double-click or Enter on the handle before it). */
  collapsible?: boolean;
  collapsedSize?: number;
  /** Accessible name for the separator controlling this panel. */
  label?: string;
  content: React.ReactNode;
}

export interface ResizablePanelsProps {
  panels: PanelConfig[];
  direction?: "horizontal" | "vertical";
  /** Controlled sizes in percent (same order as panels). */
  sizes?: number[];
  onSizesChange?: (sizes: number[]) => void;
  /** Persist sizes per viewer in localStorage under this key. */
  storageKey?: string;
  /** Keyboard step in percent (Shift = ×5). */
  step?: number;
  className?: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

function normalise(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  return values.map((v) => round((v / total) * 100));
}

function readStored(key: string | undefined, count: number): number[] | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (
      Array.isArray(parsed) &&
      parsed.length === count &&
      parsed.every((n) => typeof n === "number")
    )
      return parsed;
  } catch {
    /* storage unavailable */
  }
  return null;
}

/**
 * Split panes with draggable, keyboard-operable separators (WAI-ARIA window splitter).
 * Handles min/max constraints across neighbours, collapse/restore and per-viewer persistence.
 */
export function ResizablePanels({
  panels,
  direction = "horizontal",
  sizes: controlled,
  onSizesChange,
  storageKey,
  step = 2,
  className,
}: ResizablePanelsProps) {
  const [inner, setInner] = React.useState<number[]>(
    () => readStored(storageKey, panels.length) ?? normalise(panels.map((p) => p.defaultSize)),
  );
  const sizes = controlled ?? inner;
  const root = React.useRef<HTMLDivElement>(null);
  const restore = React.useRef<Record<string, number>>({});
  const [dragging, setDragging] = React.useState<number | null>(null);
  const horizontal = direction === "horizontal";

  const commit = React.useCallback(
    (next: number[]) => {
      const clean = next.map(round);
      if (!controlled) setInner(clean);
      onSizesChange?.(clean);
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(clean));
        } catch {
          /* ignore */
        }
      }
    },
    [controlled, onSizesChange, storageKey],
  );

  const bounds = (i: number) => {
    const p = panels[i]!;
    return {
      min: p.collapsible ? Math.min(p.collapsedSize ?? 0, p.minSize ?? 0) : (p.minSize ?? 0),
      max: p.maxSize ?? 100,
    };
  };

  /** Moves separator `i` (between panel i and i+1) by delta percent, respecting both panels' limits. */
  const resize = React.useCallback(
    (base: number[], i: number, delta: number) => {
      const a = bounds(i);
      const b = bounds(i + 1);
      const pair = (base[i] ?? 0) + (base[i + 1] ?? 0);
      let left = (base[i] ?? 0) + delta;
      left = Math.max(a.min, Math.min(a.max, left));
      left = Math.max(pair - b.max, Math.min(pair - b.min, left));
      // Snap into collapsed state when dragged below minSize.
      const pa = panels[i]!;
      const pb = panels[i + 1]!;
      if (pa.collapsible && left < (pa.minSize ?? 0))
        left = left < (pa.minSize ?? 0) / 2 ? (pa.collapsedSize ?? 0) : (pa.minSize ?? 0);
      const right = pair - left;
      if (pb.collapsible && right < (pb.minSize ?? 0))
        left =
          right < (pb.minSize ?? 0) / 2 ? pair - (pb.collapsedSize ?? 0) : pair - (pb.minSize ?? 0);
      const next = [...base];
      next[i] = left;
      next[i + 1] = pair - left;
      return next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panels],
  );

  const startDrag = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const container = root.current;
    if (!container) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const total = horizontal ? rect.width : rect.height;
    const origin = horizontal ? e.clientX : e.clientY;
    const start = [...sizes];
    setDragging(i);
    const move = (ev: PointerEvent) => {
      const pos = horizontal ? ev.clientX : ev.clientY;
      commit(resize(start, i, ((pos - origin) / total) * 100));
    };
    const up = () => {
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const toggleCollapse = (i: number) => {
    const target = panels[i]!.collapsible ? i : panels[i + 1]!.collapsible ? i + 1 : -1;
    if (target < 0) return;
    const p = panels[target]!;
    const other = target === i ? i + 1 : i;
    const collapsed = (sizes[target] ?? 0) <= (p.collapsedSize ?? 0) + 0.01;
    const next = [...sizes];
    const pair = (sizes[target] ?? 0) + (sizes[other] ?? 0);
    if (collapsed) {
      const want = restore.current[p.id] ?? p.defaultSize;
      next[target] = Math.min(want, pair - (panels[other]!.minSize ?? 0));
    } else {
      restore.current[p.id] = sizes[target] ?? 0;
      next[target] = p.collapsedSize ?? 0;
    }
    next[other] = pair - (next[target] ?? 0);
    commit(next);
  };

  const onKey = (i: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dec = horizontal ? "ArrowLeft" : "ArrowUp";
    const inc = horizontal ? "ArrowRight" : "ArrowDown";
    const s = e.shiftKey ? step * 5 : step;
    if (e.key === dec) commit(resize(sizes, i, -s));
    else if (e.key === inc) commit(resize(sizes, i, s));
    else if (e.key === "Home") commit(resize(sizes, i, -100));
    else if (e.key === "End") commit(resize(sizes, i, 100));
    else if (e.key === "Enter") toggleCollapse(i);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={root}
      data-direction={direction}
      className={cn(
        "flex h-full w-full min-w-0 overflow-hidden rounded-crm border border-crm-border bg-crm-surface font-crm",
        horizontal ? "flex-row" : "flex-col",
        dragging !== null &&
          (horizontal ? "cursor-col-resize select-none" : "cursor-row-resize select-none"),
        className,
      )}
    >
      {panels.map((p, i) => {
        const collapsed = p.collapsible && (sizes[i] ?? 0) <= (p.collapsedSize ?? 0) + 0.01;
        return (
          <React.Fragment key={p.id}>
            <div
              id={`panel-${p.id}`}
              data-collapsed={collapsed || undefined}
              style={{ flexBasis: `${sizes[i] ?? 0}%` }}
              className={cn(
                "min-h-0 min-w-0 shrink-0 grow-0 overflow-auto",
                collapsed && "overflow-hidden",
              )}
            >
              {collapsed && (p.collapsedSize ?? 0) === 0 ? null : p.content}
            </div>
            {i < panels.length - 1 && (
              <div
                role="separator"
                tabIndex={0}
                aria-orientation={horizontal ? "vertical" : "horizontal"}
                aria-controls={`panel-${p.id}`}
                aria-label={p.label ?? `Resize ${p.id}`}
                aria-valuenow={Math.round(sizes[i] ?? 0)}
                aria-valuemin={Math.round(bounds(i).min)}
                aria-valuemax={Math.round(bounds(i).max)}
                onPointerDown={startDrag(i)}
                onKeyDown={onKey(i)}
                onDoubleClick={() => toggleCollapse(i)}
                data-dragging={dragging === i || undefined}
                className={cn(
                  "group relative shrink-0 touch-none bg-crm-border outline-none",
                  horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
                  "hover:bg-crm-primary/60 focus-visible:bg-crm-primary data-[dragging]:bg-crm-primary",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute",
                    horizontal ? "inset-y-0 -left-1.5 w-3" : "inset-x-0 -top-1.5 h-3",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-crm-input bg-crm-raised opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                    horizontal ? "h-6 w-1.5" : "h-1.5 w-6",
                  )}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
