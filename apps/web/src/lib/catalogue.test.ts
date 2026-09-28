import { describe, expect, it } from "vitest";
import {
  applyCatalogueQuery,
  categoryCounts,
  groupByCategory,
  matchRank,
  rankSearch,
  searchGroups,
  sortItems,
  type CatalogueItem,
} from "./catalogue";

const item = (
  slug: string,
  name: string,
  category: string,
  extra: Partial<CatalogueItem> = {},
): CatalogueItem => ({ slug, name, category, description: "", access: "free", ...extra });

const items: CatalogueItem[] = [
  item("table-toolbar", "Table Toolbar", "Data", { createdAt: "2026-01-03T00:00:00Z" }),
  item("data-table", "Data Table", "Data", {
    access: "premium",
    createdAt: "2026-01-01T00:00:00Z",
  }),
  item("table", "Table", "Data", { createdAt: "2026-01-02T00:00:00Z" }),
  item("button", "Button", "Forms", { description: "Clickable table action" }),
  item("stat-card", "Stat Card", "Charts", {
    access: "premium",
    publishedAt: "2026-05-01T00:00:00Z",
  }),
];
const at = (i: number) => items[i] as CatalogueItem;

describe("matchRank", () => {
  it("orders exact > prefix > contains > description", () => {
    expect(matchRank(at(2), "table")).toBe(0);
    expect(matchRank(at(0), "table")).toBe(1);
    expect(matchRank(at(1), "table")).toBe(2);
    expect(matchRank(at(3), "table")).toBe(3);
    expect(matchRank(at(4), "table")).toBeNull();
  });
  it("is case and whitespace insensitive and matches slugs", () => {
    expect(matchRank(at(2), "  TABLE ")).toBe(0);
    expect(matchRank(item("kpi-tile", "Stat", "C"), "kpi tile")).toBe(2);
  });
});

describe("rankSearch", () => {
  it("ranks and keeps input order on ties", () => {
    expect(rankSearch(items, "table").map((c) => c.slug)).toEqual([
      "table",
      "table-toolbar",
      "data-table",
      "button",
    ]);
  });
  it("returns everything for an empty query", () => {
    expect(rankSearch(items, " ")).toHaveLength(items.length);
  });
});

describe("grouping", () => {
  it("groups by first-seen category with premium counts", () => {
    expect(groupByCategory(items).map((g) => [g.category, g.items.length, g.premium])).toEqual([
      ["Data", 3, 1],
      ["Forms", 1, 0],
      ["Charts", 1, 1],
    ]);
  });
  it("counts categories alphabetically", () => {
    expect(categoryCounts(items)).toEqual([
      ["Charts", 1],
      ["Data", 3],
      ["Forms", 1],
    ]);
  });
});

describe("sortItems", () => {
  it("sorts by name, category and newest (publishedAt over createdAt)", () => {
    expect(sortItems(items, "name")[0]?.slug).toBe("button");
    expect(sortItems(items, "category").map((c) => c.category)).toEqual([
      "Charts",
      "Data",
      "Data",
      "Data",
      "Forms",
    ]);
    expect(
      sortItems(items, "newest")
        .map((c) => c.slug)
        .slice(0, 3),
    ).toEqual(["stat-card", "table-toolbar", "table"]);
  });
  it("does not mutate input", () => {
    const copy = [...items];
    sortItems(items, "name");
    expect(items).toEqual(copy);
  });
});

describe("applyCatalogueQuery", () => {
  it("combines category, access and search", () => {
    expect(
      applyCatalogueQuery(items, { categories: ["Data"], access: "free" }).map((c) => c.slug),
    ).toEqual(["table", "table-toolbar"]);
    expect(applyCatalogueQuery(items, { access: "premium", query: "table" })).toEqual([at(1)]);
  });
  it("keeps rank order over sort when searching", () => {
    expect(applyCatalogueQuery(items, { query: "table", sort: "name" })[0]?.slug).toBe("table");
  });
});

describe("searchGroups", () => {
  it("caps results, groups them and gives a matching flat order", () => {
    const r = searchGroups(items, "table", 3);
    expect(r.total).toBe(4);
    expect(r.groups).toHaveLength(1);
    expect(r.flat.map((c) => c.slug)).toEqual(["table", "table-toolbar", "data-table"]);
  });
});
