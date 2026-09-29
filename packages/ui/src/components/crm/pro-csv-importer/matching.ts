import Fuse from "fuse.js";
import type { ColumnMapping, ImporterField } from "@/components/crm/pro-csv-importer/types";

/** "E-mail Address" / "emailAddress" / "EMAIL_ADDRESS" -> "e mail address" / "email address". */
export function normalizeHeader(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[#№]/g, " number ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const looksLikeData = (v: string) => {
  const s = v.trim();
  if (!s) return false;
  return (
    /^[-+]?[$€£]?\d[\d,.\s]*%?$/.test(s) ||
    /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(s) ||
    /@/.test(s) ||
    /^https?:\/\//i.test(s) ||
    s.length > 60
  );
};

/**
 * Decide whether the first row is a header: its cells are mostly non-empty, unique and do not
 * look like data (numbers, dates, emails, URLs), while the rows below do.
 */
export function detectHeader(rows: string[][]): boolean {
  const first = rows[0];
  if (!first || first.length === 0) return false;
  const nonEmpty = first.filter((c) => c.trim());
  if (nonEmpty.length / first.length < 0.6) return false;
  if (new Set(nonEmpty.map((c) => c.trim().toLowerCase())).size < nonEmpty.length) return false;
  const ratio = (r: string[]) => r.filter(looksLikeData).length / Math.max(1, r.length);
  const headerRatio = ratio(first);
  if (headerRatio > 0.25) return false;
  const body = rows.slice(1, 21);
  if (!body.length) return true;
  const bodyRatio = body.reduce((a, r) => a + ratio(r), 0) / body.length;
  return bodyRatio >= headerRatio;
}

export interface MappingSuggestion {
  mapping: ColumnMapping;
  /** 0 (perfect) .. 1 (no match) per column; null when unmapped. */
  confidence: (number | null)[];
}

/**
 * Fuzzy auto-mapping (Fuse.js Bitap scoring over field label, key and aliases), resolved as a
 * one-to-one assignment: the globally best (header, field) pairs are taken first so two columns
 * never claim the same field.
 */
export function suggestMapping(
  headers: string[],
  fields: readonly ImporterField[],
  threshold = 0.42,
): MappingSuggestion {
  const entries = fields.flatMap((f) =>
    [f.label, f.key, ...(f.aliases ?? [])].map((text) => ({
      key: f.key,
      text: normalizeHeader(text),
    })),
  );
  const fuse = new Fuse(entries, {
    keys: ["text"],
    includeScore: true,
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  const pairs: { col: number; key: string; score: number }[] = [];
  headers.forEach((h, col) => {
    const q = normalizeHeader(h);
    if (!q) return;
    const best = new Map<string, number>();
    for (const e of entries) if (e.text === q) best.set(e.key, 0);
    for (const r of fuse.search(q)) {
      const score = r.score ?? 1;
      if (score < (best.get(r.item.key) ?? Infinity)) best.set(r.item.key, score);
    }
    for (const [key, score] of best) pairs.push({ col, key, score });
  });
  pairs.sort((a, b) => a.score - b.score);
  const mapping: ColumnMapping = headers.map(() => null);
  const confidence: (number | null)[] = headers.map(() => null);
  const used = new Set<string>();
  for (const p of pairs) {
    if (mapping[p.col] !== null || used.has(p.key)) continue;
    mapping[p.col] = p.key;
    confidence[p.col] = p.score;
    used.add(p.key);
  }
  return { mapping, confidence };
}
