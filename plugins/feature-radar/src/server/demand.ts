/** Demand score: search volume (log scale) weighted by recency (14-day half-life). */

export const HALF_LIFE_DAYS = 14;
/** Score at or above which a new cluster is suggested for building (~7 searches today). */
export const SUGGEST_BUILD_THRESHOLD = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DemandInput {
  searchCount: number;
  lastSearchedAt: Date;
  /** Distinct days with searches; spread-out demand scores a little higher. */
  uniqueDays?: number;
}

export function demandScore(input: DemandInput, now: Date = new Date()): number {
  const count = Math.max(0, input.searchCount);
  if (count === 0) return 0;
  const ageDays = Math.max(0, (now.getTime() - input.lastSearchedAt.getTime()) / DAY_MS);
  const decay = 0.5 ** (ageDays / HALF_LIFE_DAYS);
  const volume = Math.log2(1 + count) + 0.5 * Math.log2(1 + Math.max(0, input.uniqueDays ?? 0));
  return Math.round(volume * decay * 100) / 100;
}
