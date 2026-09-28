/**
 * Groups near-duplicate search terms ("date picker", "datepicker", "date pickers").
 * Pure and deterministic: same input order gives the same clusters.
 */

/** Naive plural stemming: "pickers" → "picker", "entries" → "entry". */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** Lowercased, stemmed word tokens; punctuation and hyphens split words. */
export function tokens(term: string): string[] {
  return term
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

/** Classic Levenshtein distance (two-row DP). */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** Typo budget grows with length: none for short words, 1 up to 8 chars, then 2. */
function typoBudget(len: number): number {
  if (len < 4) return 0;
  return len <= 8 ? 1 : 2;
}

function tokenMatch(a: string, b: string): boolean {
  return a === b || editDistance(a, b) <= typoBudget(Math.min(a.length, b.length));
}

/** Jaccard overlap where tokens within the typo budget count as equal. */
function fuzzyJaccard(a: string[], b: string[]): number {
  const A = [...new Set(a)];
  const B = [...new Set(b)];
  if (A.length === 0 || B.length === 0) return 0;
  const used = new Set<number>();
  let shared = 0;
  for (const x of A) {
    const j = B.findIndex((y, k) => !used.has(k) && tokenMatch(x, y));
    if (j !== -1) {
      used.add(j);
      shared++;
    }
  }
  return shared / (A.length + B.length - shared);
}

/** True when two terms look like the same request. */
export function isSimilar(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  const ca = ta.join("");
  const cb = tb.join("");
  if (ca === "" || cb === "") return false;
  // Spacing-insensitive compare catches "datepicker" vs "date picker" plus typos.
  if (editDistance(ca, cb) <= typoBudget(Math.min(ca.length, cb.length))) return true;
  return fuzzyJaccard(ta, tb) >= 0.5;
}

/** Clusters terms (union-find over similar pairs). Groups keep input order. */
export function clusterTerms(terms: readonly string[]): string[][] {
  const parent = terms.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] ?? r;
    parent[i] = r;
    return r;
  };
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (isSimilar(terms[i] ?? "", terms[j] ?? "")) {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
      }
    }
  }
  const groups = new Map<number, string[]>();
  terms.forEach((t, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(t);
    else groups.set(r, [t]);
  });
  return [...groups.values()];
}
