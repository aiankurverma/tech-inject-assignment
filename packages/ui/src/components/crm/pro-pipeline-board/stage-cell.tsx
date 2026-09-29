import * as React from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { usePipelineStore } from "@/hooks/use-pipeline-store";
import { CARD_ROW, useBoard } from "@/components/crm/pro-pipeline-board/context";
import { DealCard } from "@/components/crm/pro-pipeline-board/deal-card";
import { cellKey, type PipelineDeal } from "@/components/crm/pro-pipeline-board/model";

export interface StageCellProps {
  stageId: string;
  laneId: string;
  laneName?: string;
  height: number;
}

const EMPTY: PipelineDeal[] = [];

/** A virtualised stack of deal cards for one stage x lane. Handles 1k+ cards per cell. */
export const StageCell = React.memo(function StageCell({
  stageId,
  laneId,
  laneName,
  height,
}: StageCellProps) {
  const board = useBoard();
  const key = cellKey(stageId, laneId);
  const deals = board.index.cells.get(key) ?? EMPTY;
  const stage = board.stageById.get(stageId);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Slices of the store this cell cares about.
  const activeId = usePipelineStore((s) => s.active?.dealId ?? null);
  const keyboardDrag = usePipelineStore((s) => s.active?.mode === "keyboard");
  const overIndex = usePipelineStore((s) =>
    s.over && s.over.stageId === stageId && s.over.laneId === laneId ? s.over.index : -1,
  );
  const focusedId = usePipelineStore((s) => s.focusedId);
  const focusNonce = usePipelineStore((s) => s.focusNonce);

  const pinned = React.useMemo(() => {
    const out: number[] = [];
    for (const id of [activeId, focusedId]) {
      if (!id) continue;
      const p = board.index.position.get(id);
      if (p && p.key === key) out.push(p.index);
    }
    return out;
  }, [activeId, focusedId, board.index, key]);

  // Keep the dragged and the focused card mounted even when scrolled away, so focus and
  // keyboard handling survive virtualisation.
  const rangeExtractor = React.useCallback(
    (range: Range) => {
      const base = defaultRangeExtractor(range);
      if (!pinned.length) return base;
      return [...new Set([...base, ...pinned])].sort((a, b) => a - b);
    },
    [pinned],
  );

  const virtualizer = useVirtualizer({
    count: deals.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_ROW,
    overscan: 6,
    rangeExtractor,
    getItemKey: (i) => deals[i]?.id ?? i,
  });

  // Keyboard drag: keep the drop indicator in view.
  React.useEffect(() => {
    if (keyboardDrag && overIndex >= 0 && scrollRef.current) {
      const el = scrollRef.current;
      const top = overIndex * CARD_ROW;
      if (top < el.scrollTop) el.scrollTop = Math.max(0, top - CARD_ROW / 2);
      else if (top + CARD_ROW > el.scrollTop + el.clientHeight)
        el.scrollTop = top + CARD_ROW - el.clientHeight + CARD_ROW / 2;
    }
  }, [keyboardDrag, overIndex]);

  // Programmatic focus: scroll the focused card into view so it can mount and take focus.
  React.useEffect(() => {
    if (!focusedId || focusNonce === 0) return;
    const p = board.index.position.get(focusedId);
    if (p && p.key === key) virtualizer.scrollToIndex(p.index, { align: "auto" });
  }, [focusedId, focusNonce, board.index, key, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const dropping = overIndex >= 0;
  // Visual index of the indicator: indexes exclude the dragged card, so shift past it.
  const activePos = activeId ? board.index.position.get(activeId) : undefined;
  const indicatorRow =
    dropping && activePos && activePos.key === key && overIndex >= activePos.index
      ? overIndex + 1
      : overIndex;

  const label = `${stage?.title ?? stageId}${laneName ? `, ${laneName}` : ""}: ${deals.length} deals`;

  return (
    <div
      ref={scrollRef}
      data-cell-stage={stageId}
      data-cell-lane={laneId}
      className={cn(
        "relative overflow-y-auto overscroll-contain rounded-crm px-1.5 pt-1.5 transition-colors [scrollbar-width:thin]",
        dropping ? "bg-crm-primary/10 ring-1 ring-crm-primary/40" : "bg-crm-card/60",
      )}
      style={{ height }}
    >
      <div
        role="list"
        aria-label={label}
        className="relative w-full"
        style={{ height: Math.max(virtualizer.getTotalSize(), CARD_ROW) }}
      >
        {deals.length === 0 && (
          <div className="absolute inset-x-0 top-0 flex h-[92px] items-center justify-center rounded-crm border border-dashed border-crm-border text-xs text-crm-muted-fg">
            {board.readOnly ? "No deals" : "Drop deals here"}
          </div>
        )}
        {items.map((item) => {
          const deal = deals[item.index];
          if (!deal) return null;
          return (
            <div
              key={item.key}
              role="listitem"
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <DealCard deal={deal} posinset={item.index + 1} setsize={deals.length} />
            </div>
          );
        })}
        {dropping && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-crm-primary shadow-[0_0_8px_var(--color-crm-primary)]"
            style={{ top: Math.max(0, indicatorRow * CARD_ROW - 5) }}
          />
        )}
      </div>
    </div>
  );
});
