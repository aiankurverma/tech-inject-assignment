import { describe, expect, it } from "vitest";
import { clusterTerms, editDistance, isSimilar, stem } from "./cluster";
import { demandScore, HALF_LIFE_DAYS } from "./demand";

describe("stem", () => {
  it("strips simple plurals", () => {
    expect(stem("pickers")).toBe("picker");
    expect(stem("entries")).toBe("entry");
    expect(stem("class")).toBe("class");
  });
});

describe("editDistance", () => {
  it("counts edits", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
  });
});

describe("isSimilar", () => {
  it("matches spacing, plural and typo variants", () => {
    expect(isSimilar("date picker", "datepicker")).toBe(true);
    expect(isSimilar("date picker", "date pickers")).toBe(true);
    expect(isSimilar("date picker", "date pikcer")).toBe(true);
    expect(isSimilar("date picker", "date-range picker")).toBe(true);
  });
  it("keeps unrelated terms apart", () => {
    expect(isSimilar("date picker", "color picker")).toBe(false);
    expect(isSimilar("kanban board", "data table")).toBe(false);
    expect(isSimilar("tab", "tag")).toBe(false);
  });
});

describe("clusterTerms", () => {
  it("groups the date picker family and leaves others alone", () => {
    const groups = clusterTerms([
      "date picker",
      "kanban board",
      "datepicker",
      "date pickers",
      "date-range picker",
      "kanban boards",
      "toast",
    ]);
    expect(groups).toEqual([
      ["date picker", "datepicker", "date pickers", "date-range picker"],
      ["kanban board", "kanban boards"],
      ["toast"],
    ]);
  });
  it("is deterministic and handles empty input", () => {
    const input = ["a b", "rich text editor", "rich-text editors"];
    expect(clusterTerms(input)).toEqual(clusterTerms(input));
    expect(clusterTerms(input)).toEqual([["a b"], ["rich text editor", "rich-text editors"]]);
    expect(clusterTerms([])).toEqual([]);
  });
});

describe("demandScore", () => {
  const now = new Date("2026-01-31T00:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  it("is zero without searches", () => {
    expect(demandScore({ searchCount: 0, lastSearchedAt: now }, now)).toBe(0);
  });
  it("grows with volume", () => {
    const a = demandScore({ searchCount: 3, lastSearchedAt: now }, now);
    const b = demandScore({ searchCount: 30, lastSearchedAt: now }, now);
    expect(a).toBe(2);
    expect(b).toBeGreaterThan(a);
  });
  it("halves after one half-life", () => {
    const fresh = demandScore({ searchCount: 15, lastSearchedAt: now }, now);
    const old = demandScore({ searchCount: 15, lastSearchedAt: daysAgo(HALF_LIFE_DAYS) }, now);
    expect(old).toBeCloseTo(fresh / 2, 2);
  });
  it("rewards spread across days", () => {
    const one = demandScore({ searchCount: 7, lastSearchedAt: now, uniqueDays: 1 }, now);
    const many = demandScore({ searchCount: 7, lastSearchedAt: now, uniqueDays: 7 }, now);
    expect(many).toBeGreaterThan(one);
  });
  it("treats future timestamps as now", () => {
    expect(demandScore({ searchCount: 3, lastSearchedAt: daysAgo(-5) }, now)).toBe(2);
  });
});
