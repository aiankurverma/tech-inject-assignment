import { format } from "date-fns";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const STEPS = [
  SEC,
  5 * SEC,
  15 * SEC,
  30 * SEC,
  MIN,
  5 * MIN,
  15 * MIN,
  30 * MIN,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  90 * DAY,
];

/** Evenly spaced, human-aligned time ticks for [start, end]. */
export function timeTicks(start: number, end: number, maxTicks: number): number[] {
  const span = Math.max(end - start, 1);
  const target = span / Math.max(maxTicks, 1);
  const step = STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1]!;
  // Align hour-or-larger steps to local midnight so labels read naturally.
  const offset = step >= HOUR ? new Date(start).getTimezoneOffset() * MIN : 0;
  const first = Math.ceil((start - offset) / step) * step + offset;
  const out: number[] = [];
  for (let t = first; t <= end && out.length < 200; t += step) out.push(t);
  return out;
}

/** Tick label format appropriate for the visible span. */
export function timeLabel(t: number, span: number): string {
  if (span <= 2 * MIN) return format(t, "HH:mm:ss");
  if (span <= 2 * DAY) return format(t, "HH:mm");
  if (span <= 60 * DAY) return format(t, "MMM d");
  return format(t, "MMM yyyy");
}

/** Full timestamp for tooltips, live regions and slider values. */
export function fullTime(t: number): string {
  return format(t, "MMM d, yyyy HH:mm:ss");
}

/** Round-number ticks for a numeric domain. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

export function defaultFormat(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(3);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [124, 107, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Detect WebGL2 once; deck.gl 9 requires it. */
let webgl2: boolean | null = null;
export function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const c = document.createElement("canvas");
    webgl2 = !!c.getContext("webgl2");
  } catch {
    webgl2 = false;
  }
  return webgl2;
}
