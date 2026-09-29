/** Zero-based cell position. */
export interface CellPos {
  r: number;
  c: number;
}

/** Inclusive, normalised rectangle (r1 <= r2, c1 <= c2). */
export interface CellRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

/** Sparse storage key for a cell: "row:col". */
export const cellKey = (r: number, c: number) => `${r}:${c}`;

export function parseKey(key: string): CellPos {
  const i = key.indexOf(":");
  return { r: Number(key.slice(0, i)), c: Number(key.slice(i + 1)) };
}

export const normRange = (a: CellPos, b: CellPos): CellRange => ({
  r1: Math.min(a.r, b.r),
  c1: Math.min(a.c, b.c),
  r2: Math.max(a.r, b.r),
  c2: Math.max(a.c, b.c),
});

export const inRange = (g: CellRange, r: number, c: number) =>
  r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function colName(c: number): string {
  let s = "";
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "AA" -> 26. Returns -1 for invalid input. */
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

/** A1 label for a cell. */
export const a1 = (r: number, c: number) => `${colName(c)}${r + 1}`;

/** "A1" or "A1:C4" label for a range. */
export const rangeLabel = (g: CellRange) =>
  g.r1 === g.r2 && g.c1 === g.c2 ? a1(g.r1, g.c1) : `${a1(g.r1, g.c1)}:${a1(g.r2, g.c2)}`;
