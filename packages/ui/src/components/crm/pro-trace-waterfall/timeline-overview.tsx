import { forwardRef, memo, useImperativeHandle, useRef } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import type { SpanNode } from "@/components/crm/pro-trace-waterfall/types";
import type { ViewWindow } from "@/components/crm/pro-trace-waterfall/time-scale";

export const MAX_ZOOM = 5000;

export interface TimelineOverviewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Animate to a window (fractions of the full trace). */
  focus: (w: ViewWindow) => void;
}

/**
 * Density strip of every span. react-zoom-pan-pinch owns the gestures (wheel / pinch zoom,
 * drag pan with inertia, bounds). A custom transform keeps the zoom horizontal only, and the
 * resulting scale / offset is reported upward as a view window for the waterfall.
 */
export const TimelineOverview = forwardRef<
  TimelineOverviewHandle,
  {
    lanes: SpanNode[];
    traceStart: number;
    traceEnd: number;
    onWindowChange: (w: ViewWindow) => void;
  }
>(function TimelineOverview({ lanes, traceStart, traceEnd, onWindowChange }, ref) {
  const api = useRef<ReactZoomPanPinchRef | null>(null);
  const width = () => api.current?.instance.wrapperComponent?.offsetWidth || 1;

  useImperativeHandle(ref, () => ({
    zoomIn: () => void api.current?.zoomIn(0.6, 180),
    zoomOut: () => void api.current?.zoomOut(0.6, 180),
    reset: () => void api.current?.resetTransform(180),
    focus: ({ start, end }) => {
      const scale = Math.min(MAX_ZOOM, Math.max(1, 1 / Math.max(1e-6, end - start)));
      void api.current?.setTransform(-start * width() * scale, 0, scale, 220);
    },
  }));

  return (
    <TransformWrapper
      ref={api}
      minScale={1}
      maxScale={MAX_ZOOM}
      limitToBounds
      centerZoomedOut={false}
      disablePadding
      doubleClick={{ mode: "reset" }}
      wheel={{ step: 0.15 }}
      panning={{ lockAxisY: true }}
      trackPadPanning={{ lockAxisY: true }}
      customTransform={(x, _y, s) => `translate3d(${x}px, 0, 0) scaleX(${s})`}
      onTransform={(_r, { scale, positionX }) => {
        const w = width();
        const start = Math.min(1, Math.max(0, -positionX / (w * scale)));
        onWindowChange({ start, end: Math.min(1, start + 1 / scale) });
      }}
    >
      <TransformComponent
        wrapperClass="!w-full !h-10 cursor-grab active:cursor-grabbing"
        contentClass="!w-full !h-10 origin-left"
      >
        <OverviewBars lanes={lanes} traceStart={traceStart} traceEnd={traceEnd} />
      </TransformComponent>
    </TransformWrapper>
  );
});

const OverviewBars = memo(function OverviewBars({
  lanes,
  traceStart,
  traceEnd,
}: {
  lanes: SpanNode[];
  traceStart: number;
  traceEnd: number;
}) {
  const total = traceEnd - traceStart;
  // Fold spans into 20 lanes by index so 10k spans become a compact SVG density map.
  const LANES = 20;
  const step = Math.max(1, Math.ceil(lanes.length / LANES));
  const rects: string[] = [];
  const errs: string[] = [];
  for (let i = 0; i < lanes.length; i++) {
    const n = lanes[i]!;
    const x = ((n.span.startTime - traceStart) / total) * 1000;
    const w = Math.max(0.4, (n.span.duration / total) * 1000);
    const y = Math.floor(i / step) * 2;
    (n.span.status === "error" ? errs : rects).push(
      `M${x.toFixed(2)} ${y}h${w.toFixed(2)}v1.6h-${w.toFixed(2)}z`,
    );
  }
  return (
    <svg
      viewBox={`0 0 1000 ${LANES * 2}`}
      preserveAspectRatio="none"
      className="block h-10 w-full"
      aria-hidden
    >
      <path d={rects.join("")} className="fill-crm-subtle" />
      <path d={errs.join("")} className="fill-crm-danger" />
    </svg>
  );
});
