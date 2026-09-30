import { afterEach, describe, expect, it, vi } from "vitest";
import { createCache } from "@ti/cache";
import type { ThemeFiles } from "@ti/core";
import { ComponentModel } from "../models";
import { aggregateEvents, CLI_SLUG, summarizeUsage, toUpsertOps } from "./analytics";
import { LIST_PROJECTION, listItem, makeCatalog } from "./catalog";

const at = (iso: string) => new Date(iso);

describe("usage aggregation", () => {
  it("folds events into one row per (UTC day, slug)", () => {
    const rows = aggregateEvents([
      { slug: "button", type: "view", at: at("2026-09-01T10:00:00Z") },
      { slug: "button", type: "view", at: at("2026-09-01T23:59:59Z") },
      { slug: "button", type: "copy", at: at("2026-09-01T12:00:00Z") },
      { slug: "button", type: "view", at: at("2026-09-02T00:00:00Z") },
      { slug: "card", type: "install", at: at("2026-09-01T08:00:00Z") },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows).toContainEqual({
      day: "2026-09-01",
      slug: "button",
      views: 2,
      copies: 1,
      installs: 0,
      previews: 0,
    });
    expect(rows.find((r) => r.day === "2026-09-02")?.views).toBe(1);
  });

  it("builds $inc upserts with only non-zero counters", () => {
    const [op] = toUpsertOps([
      { day: "2026-09-01", slug: "button", views: 3, copies: 0, installs: 1, previews: 0 },
    ]);
    expect(op!.updateOne).toEqual({
      filter: { day: "2026-09-01", slug: "button" },
      update: { $inc: { views: 3, installs: 1 } },
      upsert: true,
    });
  });

  it("summarizes a zero-filled range, top lists and CLI downloads", () => {
    const now = at("2026-09-07T12:00:00Z");
    const row = (day: string, slug: string, c: Partial<Record<string, number>>) => ({
      day,
      slug,
      views: 0,
      copies: 0,
      installs: 0,
      previews: 0,
      ...c,
    });
    const s = summarizeUsage(
      [
        row("2026-09-07", "button", { views: 5, copies: 2 }),
        row("2026-09-03", "card", { views: 9, installs: 4 }),
        row("2026-09-01", "table", { views: 100 }), // outside the 7-day window
        row("2026-09-05", CLI_SLUG, { installs: 3 }),
      ],
      7,
      now,
    );
    expect(s.daily.map((d) => d.day)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
    ]);
    // 2026-09-01 is day 1 of the 7-day window (inclusive), so "table" counts.
    expect(s.totals.views).toBe(114);
    expect(s.top.views.map((t) => t.slug)).toEqual(["table", "card", "button"]);
    expect(s.top.installs).toEqual([{ slug: "card", count: 4 }]);
    expect(s.top.copies).toEqual([{ slug: "button", count: 2 }]);
    expect(s.cliDownloads).toBe(3);
    expect(s.daily.find((d) => d.day === "2026-09-05")?.installs).toBe(0);

    const short = summarizeUsage([row("2026-09-01", "table", { views: 100 })], 3, now);
    expect(short.totals.views).toBe(0);
  });
});

describe("catalogue list projection", () => {
  afterEach(() => vi.restoreAllMocks());

  it("projects only summary fields and never the source files", () => {
    const keys = Object.keys(LIST_PROJECTION);
    expect(keys).not.toContain("published");
    expect(keys).not.toContain("draft");
    expect(keys.some((k) => /files|examples|props|thumbnail|usage/.test(k))).toBe(false);
  });

  it("queries Mongo with the projection and caches the result", async () => {
    const doc = {
      slug: "button",
      status: "published",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      publishedAt: "2026-01-02T00:00:00.000Z",
      published: {
        slug: "button",
        name: "Button",
        description: "A button",
        category: "Inputs",
        access: "premium",
        version: "1.0.0",
      },
    };
    const lean = vi.fn().mockResolvedValue([doc]);
    const find = vi
      .spyOn(ComponentModel, "find")
      .mockReturnValue({ sort: () => ({ lean }) } as never);
    const catalog = makeCatalog(
      {} as ThemeFiles,
      "http://x",
      createCache({ redis: null, prefix: "t:", defaultTtlSeconds: 60 }),
    );
    const viewer = { kind: "anonymous" } as const;

    const [item] = await catalog.list(viewer);
    await catalog.list(viewer);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith({ status: "published" }, LIST_PROJECTION);
    expect(item).toEqual(listItem(doc as never, viewer));
    expect(item).toMatchObject({ slug: "button", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(Object.keys(item!)).not.toContain("files");
  });
});
