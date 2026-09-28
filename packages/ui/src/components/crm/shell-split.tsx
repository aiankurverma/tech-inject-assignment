import * as React from "react";
import { ArrowLeft, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/crm/button";

export interface ShellSplitProps {
  /** Left pane: list, inbox, search results. */
  list: React.ReactNode;
  /** Right pane: the selected record. Rendered only when `detailOpen`. */
  detail?: React.ReactNode;
  /** Header content above the list (title, filters). */
  listHeader?: React.ReactNode;
  /** Header content above the detail (record title, actions). */
  detailHeader?: React.ReactNode;
  /** Shown in the detail pane when nothing is selected. */
  emptyDetail?: React.ReactNode;
  /** Whether a record is selected; on narrow screens this switches panes. */
  detailOpen: boolean;
  onCloseDetail?: () => void;
  /** List pane width in px. */
  size?: number;
  defaultSize?: number;
  onSizeChange?: (px: number) => void;
  minSize?: number;
  maxSize?: number;
  /** Width below which only one pane shows at a time. */
  stackBelow?: number;
  className?: string;
}

/**
 * List/detail split layout with a draggable, keyboard-resizable divider (arrows ±16px,
 * Shift ±64px, Home/End, double-click to reset). Below `stackBelow` it becomes a
 * single-pane master/detail flow with a back button.
 */
export function ShellSplit({
  list,
  detail,
  listHeader,
  detailHeader,
  emptyDetail,
  detailOpen,
  onCloseDetail,
  size,
  defaultSize = 360,
  onSizeChange,
  minSize = 260,
  maxSize = 640,
  stackBelow = 768,
  className,
}: ShellSplitProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [inner, setInner] = React.useState(defaultSize);
  const [dragging, setDragging] = React.useState(false);
  const [narrow, setNarrow] = React.useState(false);
  const width = size ?? inner;
  const listId = React.useId();

  const clamp = React.useCallback(
    (px: number) => {
      const rootW = rootRef.current?.clientWidth ?? Infinity;
      return Math.round(Math.min(Math.max(px, minSize), Math.min(maxSize, rootW - 240)));
    },
    [minSize, maxSize],
  );

  const set = React.useCallback(
    (px: number) => {
      const v = clamp(px);
      if (size === undefined) setInner(v);
      onSizeChange?.(v);
    },
    [clamp, size, onSizeChange],
  );

  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < stackBelow));
    ro.observe(el);
    return () => ro.disconnect();
  }, [stackBelow]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = width;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => set(start + ev.clientX - startX);
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === "ArrowLeft") set(width - step);
    else if (e.key === "ArrowRight") set(width + step);
    else if (e.key === "Home") set(minSize);
    else if (e.key === "End") set(maxSize);
    else return;
    e.preventDefault();
  };

  const showList = !narrow || !detailOpen;
  const showDetail = !narrow || detailOpen;

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex h-full min-h-0 w-full bg-crm-bg font-crm text-crm-fg",
        dragging && "cursor-col-resize select-none",
        className,
      )}
    >
      {showList ? (
        <section
          id={listId}
          aria-label="List"
          className="flex min-h-0 shrink-0 flex-col border-crm-border bg-crm-sidebar"
          style={{ width: narrow ? "100%" : width }}
        >
          {listHeader ? (
            <div className="shrink-0 border-b border-crm-border p-3">{listHeader}</div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </section>
      ) : null}
      {!narrow ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-controls={listId}
          aria-label="Resize list"
          aria-valuenow={width}
          aria-valuemin={minSize}
          aria-valuemax={maxSize}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          onDoubleClick={() => set(defaultSize)}
          className={cn(
            "group relative w-px shrink-0 cursor-col-resize bg-crm-border outline-none",
            "after:absolute after:inset-y-0 after:-right-1.5 after:-left-1.5 after:content-['']",
            "focus-visible:bg-crm-ring hover:bg-crm-input",
            dragging && "bg-crm-ring",
          )}
        />
      ) : null}
      {showDetail ? (
        <section aria-label="Detail" className="flex min-h-0 min-w-0 flex-1 flex-col">
          {detailOpen ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-crm-border px-3 py-2.5">
                {narrow ? (
                  <IconButton label="Back to list" onClick={onCloseDetail}>
                    <ArrowLeft />
                  </IconButton>
                ) : null}
                <div className="min-w-0 flex-1">{detailHeader}</div>
                {!narrow && onCloseDetail ? (
                  <IconButton label="Close detail" onClick={onCloseDetail}>
                    <PanelRightClose />
                  </IconButton>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-crm-muted-fg">
              {emptyDetail ?? "Select an item to see its details."}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
