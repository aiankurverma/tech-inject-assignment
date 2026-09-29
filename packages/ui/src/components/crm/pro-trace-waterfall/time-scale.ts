// In-house linear time scale (no @visx / d3-scale on the allow-list). Maps trace time to [0, 1]
// fractions of the visible window and produces "nice" 1-2-5 ticks.

export interface ViewWindow {
  /** Visible window as fractions of the full trace: 0 <= start < end <= 1. */
  start: number;
  end: number;
}

export const FULL_WINDOW: ViewWindow = { start: 0, end: 1 };

export function makeScale(traceStart: number, traceEnd: number, view: ViewWindow) {
  const total = traceEnd - traceStart;
  const t0 = traceStart + view.start * total;
  const span = (view.end - view.start) * total;
  /** Trace time -> percentage of the visible width (may fall outside 0-100). */
  const pct = (t: number) => ((t - t0) / span) * 100;
  return { t0, t1: t0 + span, span, pct };
}

/** Human duration: 850µs, 12.4ms, 1.52s, 2m 03s. */
export function formatDuration(ms: number): string {
  const a = Math.abs(ms);
  if (a < 1) return `${Math.round(ms * 1000)}µs`;
  if (a < 10) return `${ms.toFixed(2)}ms`;
  if (a < 1000) return `${ms.toFixed(a < 100 ? 1 : 0)}ms`;
  if (a < 60_000) return `${(ms / 1000).toFixed(a < 10_000 ? 2 : 1)}s`;
  const m = Math.floor(a / 60_000);
  return `${m}m ${String(Math.round((a % 60_000) / 1000)).padStart(2, "0")}s`;
}

/** 1-2-5 step that yields roughly `target` ticks over `span`. */
export function niceStep(span: number, target = 6): number {
  const raw = span / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

/** Ticks as offsets from trace start (what engineers read on a waterfall axis). */
export function ticks(traceStart: number, t0: number, t1: number, target = 6) {
  const step = niceStep(t1 - t0, target);
  const first = Math.ceil((t0 - traceStart) / step) * step;
  const out: number[] = [];
  for (let v = first; traceStart + v <= t1 + step * 1e-6 && out.length < 50; v += step) out.push(v);
  return out;
}
