/**
 * Largest-Triangle-Three-Buckets downsampling (Steinarsson, 2013), implemented in-house.
 * Works on typed arrays so a 1M point series never allocates per-point objects.
 */

export type NumericArray = ArrayLike<number>;

/** First index whose timestamp is >= t (timestamps must be ascending). */
export function lowerBound(xs: NumericArray, t: number, lo = 0, hi = xs.length): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((xs[mid] as number) < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index of the sample nearest to t, or -1 for an empty array. */
export function nearestIndex(xs: NumericArray, t: number): number {
  const n = xs.length;
  if (n === 0) return -1;
  const i = lowerBound(xs, t);
  if (i <= 0) return 0;
  if (i >= n) return n - 1;
  return t - (xs[i - 1] as number) <= (xs[i] as number) - t ? i - 1 : i;
}

export interface DownsampleResult {
  xs: Float64Array;
  ys: Float64Array;
  length: number;
  /** Number of raw samples that fell inside the window. */
  sourceCount: number;
  min: number;
  max: number;
}

/**
 * Downsample the [start, end] window of a series to at most `threshold` points.
 * One neighbour on each side of the window is kept so lines run to the edges.
 * NaN values are treated as gaps and skipped.
 */
export function lttbWindow(
  xs: NumericArray,
  ys: NumericArray,
  start: number,
  end: number,
  threshold: number,
): DownsampleResult {
  const n = xs.length;
  const from = Math.max(0, lowerBound(xs, start) - 1);
  const to = Math.min(n, lowerBound(xs, end, from) + 1);
  const count = Math.max(0, to - from);
  const cap = Math.max(3, Math.floor(threshold));
  const outLen = Math.min(count, cap);
  const ox = new Float64Array(outLen);
  const oy = new Float64Array(outLen);
  let min = Infinity;
  let max = -Infinity;
  const push = (k: number, i: number) => {
    const y = ys[i] as number;
    ox[k] = xs[i] as number;
    oy[k] = y;
    if (y < min) min = y;
    if (y > max) max = y;
  };

  if (count <= cap) {
    for (let k = 0; k < count; k++) push(k, from + k);
    return { xs: ox, ys: oy, length: count, sourceCount: count, min, max };
  }

  const every = (count - 2) / (cap - 2);
  let a = from;
  let k = 0;
  push(k++, a);
  for (let b = 0; b < cap - 2; b++) {
    // Average of the next bucket is the third triangle vertex.
    let avgStart = from + Math.floor((b + 1) * every) + 1;
    let avgEnd = from + Math.floor((b + 2) * every) + 1;
    if (avgEnd > to) avgEnd = to;
    if (avgStart >= avgEnd) avgStart = avgEnd - 1;
    let avgX = 0;
    let avgY = 0;
    let avgN = 0;
    for (let i = avgStart; i < avgEnd; i++) {
      const y = ys[i] as number;
      if (Number.isNaN(y)) continue;
      avgX += xs[i] as number;
      avgY += y;
      avgN++;
    }
    if (avgN) {
      avgX /= avgN;
      avgY /= avgN;
    }
    const rangeStart = from + Math.floor(b * every) + 1;
    const rangeEnd = from + Math.floor((b + 1) * every) + 1;
    const ax = xs[a] as number;
    const ay = ys[a] as number;
    let maxArea = -1;
    let next = rangeStart;
    for (let i = rangeStart; i < rangeEnd; i++) {
      const y = ys[i] as number;
      if (Number.isNaN(y)) continue;
      const area = Math.abs((ax - avgX) * (y - ay) - (ax - (xs[i] as number)) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        next = i;
      }
    }
    push(k++, next);
    a = next;
  }
  push(k++, to - 1);
  return { xs: ox, ys: oy, length: k, sourceCount: count, min, max };
}
