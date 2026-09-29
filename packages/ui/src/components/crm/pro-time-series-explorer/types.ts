import type { NumericArray } from "@/lib/lttb";

/** Inclusive [start, end] window in epoch milliseconds. */
export type TimeRange = readonly [number, number];

export interface TimeSeries {
  id: string;
  label: string;
  /** Ascending epoch-ms timestamps. Use Float64Array for large series. */
  timestamps: NumericArray;
  /** One value per timestamp; NaN marks a gap. Float32Array/Float64Array recommended. */
  values: NumericArray;
  /** Hex colour, e.g. "#7c6bff". Falls back to the palette. */
  color?: string;
  /** Panel this series is drawn in. Defaults to the first panel. */
  panel?: string;
  unit?: string;
}

export interface TimeSeriesPanel {
  id: string;
  title: string;
  /** Height in px. Default 180. */
  height?: number;
  formatValue?: (value: number) => string;
  /** Fix the y domain instead of auto-scaling to the visible window. */
  yDomain?: readonly [number, number];
}

export interface TimeAnnotation {
  id: string;
  /** Epoch ms. */
  time: number;
  /** Optional end, draws a shaded band. */
  endTime?: number;
  label: string;
  color?: string;
  /** Limit to one panel; all panels when omitted. */
  panel?: string;
}

export interface RangePreset {
  id: string;
  label: string;
  /** Window length in ms, anchored to the data end. null = all data. */
  duration: number | null;
}

export const DEFAULT_PRESETS: RangePreset[] = [
  { id: "1h", label: "1h", duration: 3_600_000 },
  { id: "6h", label: "6h", duration: 6 * 3_600_000 },
  { id: "24h", label: "24h", duration: 24 * 3_600_000 },
  { id: "7d", label: "7d", duration: 7 * 86_400_000 },
  { id: "30d", label: "30d", duration: 30 * 86_400_000 },
  { id: "all", label: "All", duration: null },
];

export const SERIES_PALETTE = ["#7c6bff", "#22c55e", "#f59e0b", "#38bdf8", "#f97373", "#2dd4bf"];
