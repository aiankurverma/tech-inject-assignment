/** Pure catalogue helpers shared by the sidebar, the index page and Ctrl+K search. */

export interface CatalogueItem {
  slug: string;
  name: string;
  description: string;
  category: string;
  access: "free" | "premium";
  createdAt?: string | null;
  publishedAt?: string | null;
}

export type AccessFilter = "all" | "free" | "premium";
export type SortKey = "name" | "category" | "newest";

export interface CategoryGroup<T> {
  category: string;
  items: T[];
  premium: number;
}

/** Match rank: 0 exact name, 1 name prefix, 2 name contains, 3 category/description; null = no match. */
export function matchRank(item: CatalogueItem, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 3;
  const name = item.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  // Slug covers "kpi tile" -> "kpi-tile" style queries.
  if (item.slug.includes(q.replace(/\s+/g, "-"))) return 2;
  if (`${item.category} ${item.description}`.toLowerCase().includes(q)) return 3;
  return null;
}

/** Filter + rank by `query`; ties keep input order (stable). Empty query returns a copy. */
export function rankSearch<T extends CatalogueItem>(items: readonly T[], query: string): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((c, i) => ({ c, i, r: matchRank(c, query) }))
    .filter((x): x is { c: T; i: number; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}

/** Groups items by category, keeping first-seen category order and item order. */
export function groupByCategory<T extends CatalogueItem>(items: readonly T[]): CategoryGroup<T>[] {
  const map = new Map<string, CategoryGroup<T>>();
  for (const c of items) {
    let g = map.get(c.category);
    if (!g) {
      g = { category: c.category, items: [], premium: 0 };
      map.set(c.category, g);
    }
    g.items.push(c);
    if (c.access === "premium") g.premium++;
  }
  return [...map.values()];
}

/** Category -> count, sorted by category name. */
export function categoryCounts(items: readonly CatalogueItem[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const c of items) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const time = (c: CatalogueItem) => Date.parse(c.publishedAt ?? c.createdAt ?? "") || 0;

/** Returns a sorted copy; "newest" uses publishedAt, then createdAt, then name. */
export function sortItems<T extends CatalogueItem>(items: readonly T[], key: SortKey): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const out = [...items];
  if (key === "name") return out.sort(byName);
  if (key === "category")
    return out.sort((a, b) => a.category.localeCompare(b.category) || byName(a, b));
  return out.sort((a, b) => time(b) - time(a) || byName(a, b));
}

export interface CatalogueQuery {
  query?: string;
  categories?: readonly string[];
  access?: AccessFilter;
  /** Ignored while a text query is active: search results stay in rank order. */
  sort?: SortKey;
}

/** Index-page pipeline: category + access filters, then search rank or sort. */
export function applyCatalogueQuery<T extends CatalogueItem>(
  items: readonly T[],
  { query = "", categories = [], access = "all", sort = "category" }: CatalogueQuery,
): T[] {
  const cats = new Set(categories);
  const filtered = items.filter(
    (c) => (!cats.size || cats.has(c.category)) && (access === "all" || c.access === access),
  );
  return query.trim() ? rankSearch(filtered, query) : sortItems(filtered, sort);
}

/**
 * Ctrl+K results: rank, cap to `limit`, then group by category in order of each group's
 * best hit. `flat` is the keyboard order (matches visual order); `total` is pre-cap.
 */
export function searchGroups<T extends CatalogueItem>(
  items: readonly T[],
  query: string,
  limit: number,
): { groups: CategoryGroup<T>[]; flat: T[]; total: number } {
  const ranked = rankSearch(items, query);
  const groups = groupByCategory(ranked.slice(0, limit));
  return { groups, flat: groups.flatMap((g) => g.items), total: ranked.length };
}
