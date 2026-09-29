import { diffLines, diffWordsWithSpace, type Change } from "diff";

export type DiffSide = "old" | "new";
export type DiffMode = "unified" | "split";

/** One physical source line taking part in the diff. */
export interface DiffLine {
  type: "ctx" | "add" | "del";
  /** 1-based line number in the old file (undefined for additions). */
  oldNo?: number;
  /** 1-based line number in the new file (undefined for deletions). */
  newNo?: number;
  text: string;
  /** Text of the counterpart line (del <-> add) used for word-level highlighting. */
  pair?: string;
}

/** A run of unchanged lines that is folded away until the reader expands it. */
export interface DiffFold {
  id: number;
  /** Index range [start, end) into `DiffModel.lines`. */
  start: number;
  end: number;
}

export interface DiffModel {
  lines: DiffLine[];
  folds: DiffFold[];
  /** Indices in `lines` where a change block starts (for next/previous change navigation). */
  changeStarts: number[];
  additions: number;
  deletions: number;
  oldLineCount: number;
  newLineCount: number;
}

function splitLines(value: string): string[] {
  const parts = value.split("\n");
  if (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/**
 * Line diff via jsdiff (Myers O(ND)), then pairs each deletion block with the following addition
 * block line-by-line so the renderer can show intra-line word changes.
 */
export function buildDiffModel(oldText: string, newText: string, contextLines: number): DiffModel {
  const changes: Change[] = diffLines(oldText, newText);
  const lines: DiffLine[] = [];
  const changeStarts: number[] = [];
  let oldNo = 1;
  let newNo = 1;
  let additions = 0;
  let deletions = 0;

  for (let i = 0; i < changes.length; i++) {
    const c = changes[i]!;
    const rows = splitLines(c.value);
    if (!c.added && !c.removed) {
      for (const text of rows) lines.push({ type: "ctx", oldNo: oldNo++, newNo: newNo++, text });
      continue;
    }
    changeStarts.push(lines.length);
    if (c.removed) {
      const next = changes[i + 1];
      const adds = next?.added ? splitLines(next.value) : [];
      rows.forEach((text, k) =>
        lines.push({ type: "del", oldNo: oldNo++, text, pair: adds[k] ?? undefined }),
      );
      deletions += rows.length;
      if (next?.added) {
        adds.forEach((text, k) =>
          lines.push({ type: "add", newNo: newNo++, text, pair: rows[k] ?? undefined }),
        );
        additions += adds.length;
        i++;
      }
    } else {
      rows.forEach((text) => lines.push({ type: "add", newNo: newNo++, text }));
      additions += rows.length;
    }
  }

  // Fold unchanged runs that are longer than the visible context around changes.
  const folds: DiffFold[] = [];
  let runStart = -1;
  const flush = (end: number) => {
    if (runStart < 0) return;
    const lead = runStart === 0 ? 0 : contextLines;
    const trail = end === lines.length ? 0 : contextLines;
    const start = runStart + lead;
    const stop = end - trail;
    if (stop - start > 2) folds.push({ id: folds.length, start, end: stop });
    runStart = -1;
  };
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.type === "ctx") {
      if (runStart < 0) runStart = i;
    } else flush(i);
  }
  flush(lines.length);

  return {
    lines,
    folds,
    changeStarts,
    additions,
    deletions,
    oldLineCount: oldNo - 1,
    newLineCount: newNo - 1,
  };
}

/** A virtual row in the rendered list. */
export type DiffRow =
  | { kind: "line"; key: string; line: DiffLine }
  | { kind: "split"; key: string; left?: DiffLine; right?: DiffLine }
  | { kind: "fold"; key: string; fold: DiffFold; hidden: number; from: number }
  | { kind: "comments"; key: string; side: DiffSide; line: number }
  | { kind: "composer"; key: string; side: DiffSide; line: number };

export interface RowOptions {
  mode: DiffMode;
  /** fold id -> number of lines already revealed from the top of the fold. */
  revealed: ReadonlyMap<number, number>;
  commentAnchors: ReadonlySet<string>;
  composer: { side: DiffSide; line: number } | null;
}

export const anchorKey = (side: DiffSide, line: number) => `${side}:${line}`;

/** Anchor of a line for comments: new-side number when present, else old-side. */
export function lineAnchor(line: DiffLine): { side: DiffSide; line: number } {
  return line.newNo != null
    ? { side: "new", line: line.newNo }
    : { side: "old", line: line.oldNo as number };
}

/** Flattens the model into virtual rows. Linear in the number of lines. */
export function buildRows(model: DiffModel, opts: RowOptions): DiffRow[] {
  const rows: DiffRow[] = [];
  const foldAt = new Map(model.folds.map((f) => [f.start, f]));
  const pushExtras = (line: DiffLine | undefined) => {
    if (!line) return;
    const a = lineAnchor(line);
    const k = anchorKey(a.side, a.line);
    if (opts.commentAnchors.has(k)) rows.push({ kind: "comments", key: `c-${k}`, ...a });
    if (opts.composer && opts.composer.side === a.side && opts.composer.line === a.line)
      rows.push({ kind: "composer", key: `n-${k}`, ...a });
  };

  let i = 0;
  const L = model.lines;
  while (i < L.length) {
    const fold = foldAt.get(i);
    if (fold) {
      const shown = Math.min(opts.revealed.get(fold.id) ?? 0, fold.end - fold.start);
      for (let k = fold.start; k < fold.start + shown; k++) emit(k, k + 1);
      const hidden = fold.end - fold.start - shown;
      if (hidden > 0)
        rows.push({ kind: "fold", key: `f-${fold.id}`, fold, hidden, from: fold.start + shown });
      i = fold.end;
      continue;
    }
    i = emit(i, L.length);
  }
  return rows;

  /** Emits line(s) starting at i; returns the next unprocessed index (bounded by `limit`). */
  function emit(i: number, limit: number): number {
    const line = L[i]!;
    if (opts.mode === "unified" || line.type === "ctx") {
      if (opts.mode === "unified") rows.push({ kind: "line", key: `l-${i}`, line });
      else rows.push({ kind: "split", key: `s-${i}`, left: line, right: line });
      pushExtras(line);
      return i + 1;
    }
    // Split mode: pair a deletion block with its following addition block side by side.
    let d = i;
    while (d < limit && L[d]!.type === "del") d++;
    let a = d;
    while (a < limit && L[a]!.type === "add") a++;
    const dels = L.slice(i, d);
    const adds = L.slice(d, a);
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      rows.push({ kind: "split", key: `s-${i + k}`, left: dels[k], right: adds[k] });
      pushExtras(dels[k]);
      pushExtras(adds[k]);
    }
    return Math.max(a, i + 1);
  }
}

export interface WordSegment {
  text: string;
  changed: boolean;
}

const wordCache = new Map<string, WordSegment[]>();

/** Word-level segments of `text` relative to `pair`. Cached; skipped for very long lines. */
export function wordSegments(text: string, pair: string, side: DiffSide): WordSegment[] {
  if (text.length + pair.length > 4000) return [{ text, changed: false }];
  const key = `${side}\u0000${text}\u0000${pair}`;
  const hit = wordCache.get(key);
  if (hit) return hit;
  const parts = side === "new" ? diffWordsWithSpace(pair, text) : diffWordsWithSpace(text, pair);
  const out: WordSegment[] = [];
  for (const p of parts) {
    if (side === "new" && p.removed) continue;
    if (side === "old" && p.added) continue;
    out.push({ text: p.value, changed: side === "new" ? !!p.added : !!p.removed });
  }
  // If almost everything changed, word highlighting is noise.
  const changedLen = out.reduce((s, p) => s + (p.changed ? p.text.length : 0), 0);
  const result = changedLen > text.length * 0.7 ? [{ text, changed: false }] : out;
  if (wordCache.size > 5000) wordCache.clear();
  wordCache.set(key, result);
  return result;
}
