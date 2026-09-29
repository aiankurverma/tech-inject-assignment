import * as React from "react";
import type { TimeRange } from "@/components/crm/pro-time-series-explorer/types";

interface Options {
  extent: TimeRange;
  value?: TimeRange;
  defaultValue?: TimeRange;
  onChange?: (range: TimeRange) => void;
  /** Smallest allowed window in ms. */
  minSpan?: number;
}

/** Controlled/uncontrolled time window with clamped zoom and pan helpers. */
export function useTimeRange({ extent, value, defaultValue, onChange, minSpan = 1000 }: Options) {
  const [inner, setInner] = React.useState<TimeRange>(defaultValue ?? extent);
  const range = value ?? inner;
  const rangeRef = React.useRef(range);
  rangeRef.current = range;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const clamp = React.useCallback(
    (s: number, e: number): TimeRange => {
      const [lo, hi] = extent;
      const full = Math.max(hi - lo, 1);
      let span = Math.min(Math.max(e - s, Math.min(minSpan, full)), full);
      let start = s;
      if (e - s !== span) start = s + (e - s - span) / 2;
      start = Math.min(Math.max(start, lo), hi - span);
      span = Math.max(span, 1);
      return [start, start + span];
    },
    [extent, minSpan],
  );

  const setRange = React.useCallback(
    (next: TimeRange) => {
      const c = clamp(next[0], next[1]);
      const cur = rangeRef.current;
      if (c[0] === cur[0] && c[1] === cur[1]) return;
      rangeRef.current = c;
      if (value === undefined) setInner(c);
      onChangeRef.current?.(c);
    },
    [clamp, value],
  );

  /** Zoom by factor (<1 zooms in) around an anchor time. */
  const zoom = React.useCallback(
    (factor: number, anchor?: number) => {
      const [s, e] = rangeRef.current;
      const a = anchor ?? (s + e) / 2;
      setRange([a - (a - s) * factor, a + (e - a) * factor]);
    },
    [setRange],
  );

  /** Pan by a fraction of the current span (negative = earlier). */
  const pan = React.useCallback(
    (fraction: number) => {
      const [s, e] = rangeRef.current;
      const d = (e - s) * fraction;
      setRange([s + d, e + d]);
    },
    [setRange],
  );

  return { range, setRange, zoom, pan, rangeRef };
}
