import * as React from "react";
import { hasConflict } from "@/components/crm/pro-resource-scheduler/layout";
import type { DragPreview, SchedulerStore } from "@/components/crm/pro-resource-scheduler/store";
import type { TimeScale } from "@/components/crm/pro-resource-scheduler/time-scale";
import type { DragMode, SchedulerOccurrence } from "@/components/crm/pro-resource-scheduler/types";

export interface SchedulerDragOptions {
  scale: TimeScale;
  store: SchedulerStore;
  occByResource: Map<string, SchedulerOccurrence[]>;
  /** Wide timeline element (left edge = scale x 0). */
  timelineRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLElement | null>;
  disabledResources: Set<string>;
  onCommit: (preview: DragPreview, occ: SchedulerOccurrence | null) => void;
  onClick: (occ: SchedulerOccurrence) => void;
  readOnly?: boolean;
}

const THRESHOLD = 4;
const EDGE = 48;

/**
 * Pointer-events drag engine for create / move / resize with snapping and live conflict checks.
 * Built in-house because @dnd-kit is not on the approved list; pointer events give us touch + pen
 * support, and preview updates are rAF-throttled into the zustand store.
 */
export function useSchedulerDrag(opts: SchedulerDragOptions) {
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  return React.useCallback(
    (
      e: React.PointerEvent,
      mode: DragMode,
      target: { occ?: SchedulerOccurrence; resourceId: string },
    ) => {
      const o = optsRef.current;
      e.stopPropagation();
      if (e.button !== 0 || o.readOnly) {
        if (target.occ && e.button === 0) o.onClick(target.occ);
        return;
      }
      if (target.occ?.event.locked && mode !== "create") {
        o.onClick(target.occ);
        return;
      }
      if (mode === "create" && o.disabledResources.has(target.resourceId)) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const timeAt = (clientX: number) => {
        const rect = o.timelineRef.current!.getBoundingClientRect();
        return o.scale.toTime(clientX - rect.left);
      };
      const t0 = timeAt(x0);
      const occ = target.occ ?? null;
      let started = false;
      let frame = 0;
      let last: DragPreview | null = null;
      const pointerId = e.pointerId;

      const compute = (cx: number, cy: number): DragPreview => {
        const { scale, occByResource, disabledResources } = optsRef.current;
        const t = timeAt(cx);
        const delta = t - t0;
        let resourceId = target.resourceId;
        if (mode === "move" || mode === "create") {
          const row = document.elementFromPoint(cx, cy)?.closest<HTMLElement>("[data-resource-id]")
            ?.dataset.resourceId;
          if (mode === "move" && row && !disabledResources.has(row)) resourceId = row;
        }
        let start: number;
        let end: number;
        if (mode === "create") {
          const a = scale.snap(t0);
          const b = scale.snap(t);
          start = Math.min(a, b);
          end = Math.max(a, b, start + scale.snapMs);
        } else {
          const s0 = occ!.start;
          const e0 = occ!.end;
          if (mode === "move") {
            start = scale.snap(s0 + delta);
            end = start + (e0 - s0);
          } else if (mode === "resize-start") {
            start = Math.min(scale.snap(s0 + delta), e0 - scale.snapMs);
            end = e0;
          } else {
            start = s0;
            end = Math.max(scale.snap(e0 + delta), s0 + scale.snapMs);
          }
        }
        return {
          mode,
          key: occ?.key ?? null,
          eventId: occ?.event.id ?? null,
          resourceId,
          start,
          end,
          conflict: hasConflict(occByResource.get(resourceId), start, end, occ?.event.id),
        };
      };

      const autoScroll = (cx: number, cy: number) => {
        const el = optsRef.current.scrollRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (cx > r.right - EDGE) el.scrollLeft += 16;
        else if (cx < r.left + EDGE + 200) el.scrollLeft -= 16;
        if (cy > r.bottom - EDGE) el.scrollTop += 12;
        else if (cy < r.top + EDGE) el.scrollTop -= 12;
      };

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        if (!started && Math.hypot(ev.clientX - x0, ev.clientY - y0) < THRESHOLD) return;
        started = true;
        autoScroll(ev.clientX, ev.clientY);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          last = compute(ev.clientX, ev.clientY);
          optsRef.current.store.getState().setDrag(last);
        });
      };
      const cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key, true);
        optsRef.current.store.getState().setDrag(null);
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const wasDrag = started;
        const final = wasDrag ? compute(ev.clientX, ev.clientY) : last;
        cleanup();
        if (wasDrag && final) optsRef.current.onCommit(final, occ);
        else if (!wasDrag && occ) optsRef.current.onClick(occ);
      };
      const cancel = () => cleanup();
      const key = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ev.stopPropagation();
          started = false;
          cleanup();
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", key, true);
    },
    [],
  );
}
