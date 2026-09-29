import * as React from "react";
import type { PipelineStore } from "@/hooks/use-pipeline-store";
import { CARD_ROW } from "@/components/crm/pro-pipeline-board/context";
import {
  cellKey,
  type BoardIndex,
  type CellTarget,
  type PipelineDeal,
  type PipelineStage,
} from "@/components/crm/pro-pipeline-board/model";

/**
 * In-house pointer + keyboard drag and drop for the pipeline board.
 *
 * Written from scratch on purpose: the brief excludes @dnd-kit for this component, and the
 * board's needs are narrow (fixed-height virtualised rows, grid of cells), so hit-testing is a
 * single elementFromPoint + arithmetic instead of measuring every droppable.
 * Keyboard model follows the WAI-ARIA drag-and-drop guidance used by accessible kanbans:
 * Space picks up / drops, arrows move, Shift+Up/Down changes owner lane, Escape cancels.
 */
export interface PipelineDndOptions {
  store: PipelineStore;
  indexRef: React.RefObject<BoardIndex>;
  stages: readonly PipelineStage[];
  laneIds: readonly string[];
  laneName: (laneId: string) => string | undefined;
  readOnly: boolean;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  commit: (dealId: string, target: CellTarget) => void;
  onOpenDeal?: (deal: PipelineDeal) => void;
  findDeal: (dealId: string) => PipelineDeal | undefined;
}

const splitKey = (key: string) => {
  const [stageId, laneId] = key.split("\u0000");
  return { stageId: stageId as string, laneId: laneId as string };
};

export function usePipelineDnd(opts: PipelineDndOptions) {
  const optsRef = React.useRef(opts);
  React.useLayoutEffect(() => {
    optsRef.current = opts;
  });
  const cleanupRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => () => cleanupRef.current?.(), []);

  const describe = React.useCallback((dealTitle: string, t: CellTarget, excludeId: string) => {
    const o = optsRef.current;
    const stage = o.stages.find((s) => s.id === t.stageId);
    const list = o.indexRef.current?.cells.get(cellKey(t.stageId, t.laneId)) ?? [];
    const len = list.filter((d) => d.id !== excludeId).length;
    const lane = o.laneName(t.laneId);
    return `${dealTitle}: ${stage?.title ?? t.stageId}${lane ? `, ${lane}` : ""}, position ${
      t.index + 1
    } of ${len + 1}`;
  }, []);

  const onCardPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLElement>, deal: PipelineDeal) => {
      if (e.button !== 0) return;
      const o = optsRef.current;
      const { store } = o;
      if (store.getState().active) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const pos = o.indexRef.current?.position.get(deal.id);
      if (!pos) return;
      const origin: CellTarget = { ...splitKey(pos.key), index: pos.index };
      let dragging = false;

      const hitTest = (x: number, y: number) => {
        const el = document
          .elementFromPoint(x, y)
          ?.closest<HTMLElement>("[data-cell-stage][data-cell-lane]");
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        // Edge auto-scroll inside the cell and across the board.
        if (y < rect.top + 40) el.scrollTop -= 18;
        else if (y > rect.bottom - 40) el.scrollTop += 18;
        const scroller = optsRef.current.scrollerRef.current;
        if (scroller) {
          const sr = scroller.getBoundingClientRect();
          if (x < sr.left + 48) scroller.scrollLeft -= 20;
          else if (x > sr.right - 48) scroller.scrollLeft += 20;
        }
        const stageId = el.dataset.cellStage as string;
        const laneId = el.dataset.cellLane as string;
        const list = optsRef.current.indexRef.current?.cells.get(cellKey(stageId, laneId)) ?? [];
        const selfIndex = list.findIndex((d) => d.id === deal.id);
        let raw = Math.round((y - rect.top + el.scrollTop - 6) / CARD_ROW);
        raw = Math.max(0, Math.min(raw, list.length));
        if (selfIndex >= 0 && raw > selfIndex) raw -= 1;
        const max = selfIndex >= 0 ? list.length - 1 : list.length;
        return { stageId, laneId, index: Math.max(0, Math.min(raw, max)) };
      };

      const onMove = (ev: PointerEvent) => {
        if (!dragging) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
          if (optsRef.current.readOnly) return;
          dragging = true;
          store.getState().startDrag(deal.id, "pointer", origin);
          store.getState().announce(`Picked up ${deal.title}.`);
        }
        ev.preventDefault();
        store.getState().setPointer({ x: ev.clientX, y: ev.clientY });
        const t = hitTest(ev.clientX, ev.clientY);
        if (t) store.getState().setOver(t);
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        cleanupRef.current = null;
      };
      const onUp = () => {
        cleanup();
        if (!dragging) {
          optsRef.current.onOpenDeal?.(deal);
          return;
        }
        const over = store.getState().over;
        store.getState().endDrag();
        if (over) optsRef.current.commit(deal.id, over);
      };
      const onCancel = () => {
        cleanup();
        if (dragging) {
          store.getState().endDrag();
          store.getState().announce(`Move cancelled. ${deal.title} returned.`);
        }
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          onCancel();
        }
      };
      cleanupRef.current?.();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
      cleanupRef.current = cleanup;
    },
    [],
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const o = optsRef.current;
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-deal-id]");
      if (!target) return;
      const dealId = target.dataset.dealId as string;
      const deal = o.findDeal(dealId);
      const index = o.indexRef.current;
      if (!deal || !index) return;
      const state = o.store.getState();
      const collapsed = state.collapsedLanes;
      const lanes = o.laneIds.filter((l) => !collapsed[l]);
      const stageIds = o.stages.map((s) => s.id);
      const cellLen = (stageId: string, laneId: string) =>
        index.cells.get(cellKey(stageId, laneId))?.length ?? 0;

      // ---- keyboard drag in progress ----
      if (state.active?.mode === "keyboard" && state.active.dealId === dealId) {
        const over = state.over ?? state.active.origin;
        const lenExcl = (s: string, l: string) => {
          const list = index.cells.get(cellKey(s, l)) ?? [];
          return list.some((d) => d.id === dealId) ? list.length - 1 : list.length;
        };
        let next: CellTarget | null = null;
        const si = stageIds.indexOf(over.stageId);
        const li = lanes.indexOf(over.laneId);
        switch (e.key) {
          case "ArrowLeft":
          case "ArrowRight": {
            const ns = stageIds[si + (e.key === "ArrowRight" ? 1 : -1)];
            if (ns)
              next = {
                stageId: ns,
                laneId: over.laneId,
                index: Math.min(over.index, lenExcl(ns, over.laneId)),
              };
            break;
          }
          case "ArrowUp":
          case "ArrowDown": {
            const dir = e.key === "ArrowDown" ? 1 : -1;
            if (e.shiftKey && lanes.length > 1) {
              const nl = lanes[li + dir];
              if (nl)
                next = {
                  stageId: over.stageId,
                  laneId: nl,
                  index: Math.min(over.index, lenExcl(over.stageId, nl)),
                };
            } else {
              const ni = over.index + dir;
              if (ni >= 0 && ni <= lenExcl(over.stageId, over.laneId))
                next = { ...over, index: ni };
            }
            break;
          }
          case " ":
          case "Enter": {
            e.preventDefault();
            state.endDrag();
            o.commit(dealId, over);
            return;
          }
          case "Escape": {
            e.preventDefault();
            state.endDrag();
            state.announce(`Move cancelled. ${deal.title} returned to its original position.`);
            state.focus(dealId);
            return;
          }
          case "Tab":
            e.preventDefault();
            return;
          default:
            return;
        }
        e.preventDefault();
        if (next) {
          state.setOver(next);
          state.announce(describe(deal.title, next, dealId));
        }
        return;
      }

      // ---- roving focus ----
      const pos = index.position.get(dealId);
      if (!pos) return;
      const { stageId, laneId } = splitKey(pos.key);
      const go = (s: string, l: string, i: number) => {
        const list = index.cells.get(cellKey(s, l));
        const d = list?.[Math.max(0, Math.min(i, list.length - 1))];
        if (d) state.focus(d.id);
      };
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (e.shiftKey || e.altKey) {
            const nl = lanes[lanes.indexOf(laneId) - 1];
            if (nl) go(stageId, nl, pos.index);
          } else go(stageId, laneId, pos.index - 1);
          return;
        case "ArrowDown":
          e.preventDefault();
          if (e.shiftKey || e.altKey) {
            const nl = lanes[lanes.indexOf(laneId) + 1];
            if (nl) go(stageId, nl, pos.index);
          } else go(stageId, laneId, pos.index + 1);
          return;
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          for (let i = stageIds.indexOf(stageId) + dir; i >= 0 && i < stageIds.length; i += dir) {
            const s = stageIds[i] as string;
            if (cellLen(s, laneId) > 0) return go(s, laneId, pos.index);
          }
          return;
        }
        case "Home":
          e.preventDefault();
          return go(stageId, laneId, 0);
        case "End":
          e.preventDefault();
          return go(stageId, laneId, cellLen(stageId, laneId) - 1);
        case "Enter":
          e.preventDefault();
          o.onOpenDeal?.(deal);
          return;
        case " ": {
          e.preventDefault();
          if (o.readOnly) return;
          const origin = { stageId, laneId, index: pos.index };
          state.startDrag(dealId, "keyboard", origin);
          state.announce(
            `Picked up ${deal.title}. ${describe(deal.title, origin, dealId)}. Use arrow keys to move, Shift plus up or down to change owner, Space to drop, Escape to cancel.`,
          );
          return;
        }
      }
    },
    [describe],
  );

  return { onCardPointerDown, onKeyDown };
}
