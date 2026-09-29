import * as React from "react";
import { stripAnsi } from "@/components/crm/pro-log-explorer/ansi";

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogEntry {
  id: string;
  timestamp: Date | string | number;
  level: LogLevel;
  /** Raw message; may contain ANSI escapes or a JSON object. */
  message: string;
  source?: string;
  /** Structured fields shown when the line is expanded. */
  fields?: Record<string, unknown>;
}

export interface PreparedLog {
  entry: LogEntry;
  ts: number;
  plain: string;
  /** Whether the line can be expanded (fields present or message is a JSON object). */
  expandable: boolean;
}

const prepared = new WeakMap<LogEntry, PreparedLog>();

/** Per-entry derived data, computed once per entry object (safe for append-only streams). */
export function prepare(entry: LogEntry): PreparedLog {
  let p = prepared.get(entry);
  if (!p) {
    const plain = stripAnsi(entry.message);
    const t = plain.trimStart();
    p = {
      entry,
      ts: new Date(entry.timestamp).getTime(),
      plain,
      expandable: !!entry.fields || (t.startsWith("{") && t.trimEnd().endsWith("}")),
    };
    prepared.set(entry, p);
  }
  return p;
}

/** Parsed JSON payload of a line (fields merged over a JSON message), or null. */
export function payloadOf(p: PreparedLog): Record<string, unknown> | null {
  let json: Record<string, unknown> | null = null;
  const t = p.plain.trim();
  if (t.startsWith("{")) {
    try {
      json = JSON.parse(t) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }
  if (!json && !p.entry.fields) return null;
  return { ...(json ?? {}), ...(p.entry.fields ?? {}) };
}

export interface SearchSpec {
  query: string;
  regex: boolean;
  caseSensitive: boolean;
}

export function compileSearch(s: SearchSpec): { re: RegExp | null; error: string | null } {
  if (!s.query) return { re: null, error: null };
  try {
    const src = s.regex ? s.query : s.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { re: new RegExp(src, s.caseSensitive ? "g" : "gi"), error: null };
  } catch (e) {
    return { re: null, error: e instanceof Error ? e.message : "Invalid pattern" };
  }
}

export interface LogIndexOptions {
  levels: ReadonlySet<LogLevel>;
  search: RegExp | null;
  /** When false, search only highlights and does not filter. */
  filterBySearch: boolean;
  range: [number, number] | null;
  buckets: number;
}

export interface HistogramBucket {
  start: number;
  end: number;
  label: string;
  error: number;
  warn: number;
  info: number;
  debug: number;
}

export interface LogIndex {
  rows: PreparedLog[];
  /** Level counts under the current search/time filters (facet semantics: ignores level filter). */
  counts: Record<LogLevel, number>;
  histogram: HistogramBucket[];
  matchCount: number;
}

const test = (re: RegExp, s: string) => {
  re.lastIndex = 0;
  return re.test(s);
};

/**
 * Single O(n) pass per filter change: facet counts, histogram and the visible row list.
 * Histogram spans the whole dataset (so the brush can widen again) and respects level + search.
 */
export function useLogIndex(logs: readonly LogEntry[], opts: LogIndexOptions): LogIndex {
  const { levels, search, filterBySearch, range, buckets } = opts;
  return React.useMemo(() => {
    const counts = Object.fromEntries(LOG_LEVELS.map((l) => [l, 0])) as Record<LogLevel, number>;
    const rows: PreparedLog[] = [];
    let min = Infinity;
    let max = -Infinity;
    const all: PreparedLog[] = new Array(logs.length);
    for (let i = 0; i < logs.length; i++) {
      const p = prepare(logs[i]!);
      all[i] = p;
      if (p.ts < min) min = p.ts;
      if (p.ts > max) max = p.ts;
    }
    if (!Number.isFinite(min)) min = max = Date.now();
    const span = Math.max(1, max - min + 1);
    const size = span / buckets;
    const hist: HistogramBucket[] = Array.from({ length: buckets }, (_, i) => {
      const start = min + i * size;
      return {
        start,
        end: start + size,
        label: new Date(start).toISOString(),
        error: 0,
        warn: 0,
        info: 0,
        debug: 0,
      };
    });
    let matchCount = 0;
    for (const p of all) {
      const lvl = p.entry.level;
      const matches = search ? test(search, p.plain) : true;
      if (search && matches) matchCount++;
      if (filterBySearch && !matches) continue;
      const inRange = !range || (p.ts >= range[0] && p.ts <= range[1]);
      if (inRange) counts[lvl]++;
      if (!levels.has(lvl)) continue;
      const b = hist[Math.min(buckets - 1, Math.floor((p.ts - min) / size))]!;
      if (lvl === "error" || lvl === "fatal") b.error++;
      else if (lvl === "warn") b.warn++;
      else if (lvl === "info") b.info++;
      else b.debug++;
      if (inRange) rows.push(p);
    }
    return { rows, counts, histogram: hist, matchCount };
  }, [logs, levels, search, filterBySearch, range, buckets]);
}
