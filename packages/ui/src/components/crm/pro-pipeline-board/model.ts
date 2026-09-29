/** Data model and pure helpers for ProPipelineBoard. No React in here, so it is cheap to test. */

export interface PipelineStage {
  id: string;
  title: string;
  /** Win probability 0-1 used for the weighted forecast. */
  probability: number;
  /** Soft limit on open deals in the stage (work-in-progress). */
  wipLimit?: number;
  /** Days a deal may sit in the stage before it is flagged as rotting. */
  rotDays?: number;
}

export interface PipelineOwner {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface PipelineDeal {
  id: string;
  title: string;
  company: string;
  /** Deal value in the board currency (major units). */
  amount: number;
  stageId: string;
  ownerId: string;
  /** Sort key inside a stage. Lower comes first. Fractional ranks are fine. */
  rank: number;
  /** ISO date-time the deal entered its current stage (drives rotting flags). */
  stageEnteredAt: string;
  /** ISO date of the expected close. */
  closeDate?: string;
  /** Per-deal probability override 0-1; falls back to the stage probability. */
  probability?: number;
}

export interface DealMove {
  dealId: string;
  fromStageId: string;
  toStageId: string;
  fromOwnerId: string;
  toOwnerId: string;
  rank: number;
  /** Snapshot before the move, used for rollback. */
  previous: PipelineDeal;
  /** The deal after the move, as applied optimistically. */
  next: PipelineDeal;
}

export interface CellTarget {
  stageId: string;
  laneId: string;
  /** Insert position among the cell's deals, excluding the dragged deal. */
  index: number;
}

export interface StageStats {
  count: number;
  total: number;
  weighted: number;
  rotting: number;
}

export const ALL_LANE = "__all__";
export const DAY_MS = 86_400_000;

export const cellKey = (stageId: string, laneId: string) => `${stageId}\u0000${laneId}`;

export function dealProbability(deal: PipelineDeal, stage: PipelineStage | undefined) {
  return deal.probability ?? stage?.probability ?? 0;
}

export function daysInStage(deal: PipelineDeal, now: number) {
  return Math.max(0, Math.floor((now - Date.parse(deal.stageEnteredAt)) / DAY_MS));
}

export function isRotting(deal: PipelineDeal, stage: PipelineStage | undefined, now: number) {
  return stage?.rotDays != null && daysInStage(deal, now) > stage.rotDays;
}

/** A rank strictly between two neighbours (either may be missing). */
export function rankBetween(prev: number | undefined, next: number | undefined) {
  if (prev === undefined && next === undefined) return 1024;
  if (prev === undefined) return (next as number) - 1024;
  if (next === undefined) return prev + 1024;
  return (prev + next) / 2;
}

export interface BoardIndex {
  /** Deals per cell, sorted by rank. */
  cells: Map<string, PipelineDeal[]>;
  stageStats: Map<string, StageStats>;
  cellStats: Map<string, StageStats>;
  laneStats: Map<string, StageStats>;
  totals: StageStats;
  /** dealId -> { cell key, index } for O(1) keyboard navigation. */
  position: Map<string, { key: string; index: number }>;
}

const emptyStats = (): StageStats => ({ count: 0, total: 0, weighted: 0, rotting: 0 });

function add(s: StageStats, amount: number, weighted: number, rotting: boolean) {
  s.count += 1;
  s.total += amount;
  s.weighted += weighted;
  if (rotting) s.rotting += 1;
}

/** One O(n log n) pass: group, sort and total. Re-run only when deals/filters change. */
export function indexBoard(
  deals: readonly PipelineDeal[],
  stages: readonly PipelineStage[],
  laneIds: readonly string[],
  byOwner: boolean,
  now: number,
): BoardIndex {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const cells = new Map<string, PipelineDeal[]>();
  const stageStats = new Map<string, StageStats>();
  const cellStats = new Map<string, StageStats>();
  const laneStats = new Map<string, StageStats>();
  const totals = emptyStats();
  for (const s of stages) {
    stageStats.set(s.id, emptyStats());
    for (const l of laneIds) {
      cells.set(cellKey(s.id, l), []);
      cellStats.set(cellKey(s.id, l), emptyStats());
    }
  }
  for (const l of laneIds) laneStats.set(l, emptyStats());

  for (const d of deals) {
    const stage = stageById.get(d.stageId);
    if (!stage) continue;
    const lane = byOwner ? d.ownerId : ALL_LANE;
    const key = cellKey(d.stageId, lane);
    const bucket = cells.get(key);
    if (!bucket) continue;
    bucket.push(d);
    const w = d.amount * dealProbability(d, stage);
    const rot = isRotting(d, stage, now);
    add(stageStats.get(d.stageId)!, d.amount, w, rot);
    add(cellStats.get(key)!, d.amount, w, rot);
    add(laneStats.get(lane)!, d.amount, w, rot);
    add(totals, d.amount, w, rot);
  }

  const position = new Map<string, { key: string; index: number }>();
  for (const [key, list] of cells) {
    list.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
    list.forEach((d, index) => position.set(d.id, { key, index }));
  }
  return { cells, stageStats, cellStats, laneStats, totals, position };
}

const formatters = new Map<string, Intl.NumberFormat>();
export function formatMoney(value: number, currency: string, locale: string, compact = false) {
  const k = `${locale}|${currency}|${compact}`;
  let f = formatters.get(k);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? "compact" : "standard",
    });
    formatters.set(k, f);
  }
  return f.format(value);
}
