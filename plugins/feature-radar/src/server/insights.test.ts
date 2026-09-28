import { describe, expect, it } from "vitest";
import { buildInsights } from "./router";

const now = new Date("2026-01-31T00:00:00Z");
const row = (id: string, term: string, searchCount: number, status = "new") => ({
  id,
  term,
  searchCount,
  status,
  eta: null,
  lastSearchedAt: now.toISOString(),
  createdAt: now.toISOString(),
  buildStatus: "idle",
  buildError: null,
  draftSlug: null,
});

describe("buildInsights", () => {
  it("sums real counts per cluster and suggests hot new clusters", () => {
    const { clusters } = buildInsights(
      [
        row("a", "date picker", 6),
        row("b", "datepicker", 4),
        row("c", "toast", 1),
        row("d", "kanban board", 9, "building"),
      ],
      now,
    );
    expect(clusters.map((c) => c.canonicalTerm)).toEqual(["date picker", "kanban board", "toast"]);
    const dp = clusters[0];
    expect(dp?.totalCount).toBe(10);
    expect(dp?.canonicalId).toBe("a");
    expect(dp?.suggestion).toBe("suggest-build");
    expect(clusters[1]?.suggestion).toBe("building");
    expect(clusters[2]?.suggestion).toBe("watch");
  });
});
