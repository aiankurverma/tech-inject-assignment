import { afterEach, describe, expect, it, vi } from "vitest";
import { createCache } from "./index";

const make = () => createCache({ redis: null, prefix: "t:", defaultTtlSeconds: 60 });

describe("cache (in-memory)", () => {
  afterEach(() => vi.useRealTimers());

  it("gets what was set, and misses unknown keys", async () => {
    const cache = make();
    expect(await cache.get("a")).toBeUndefined();
    await cache.set("a", { n: 1 });
    await cache.set("nothing", null);
    expect(await cache.get("a")).toEqual({ n: 1 });
    expect(await cache.get("nothing")).toBeNull(); // cached null is a hit, not a miss
  });

  it("expires entries after their TTL", async () => {
    vi.useFakeTimers();
    const cache = make();
    await cache.set("short", 1, 2);
    await cache.set("default", 2);
    vi.advanceTimersByTime(2_000);
    expect(await cache.get("short")).toBeUndefined();
    expect(await cache.get("default")).toBe(2);
    vi.advanceTimersByTime(58_000);
    expect(await cache.get("default")).toBeUndefined();
  });

  it("del and delPrefix invalidate", async () => {
    const cache = make();
    await Promise.all([cache.set("slug:a", 1), cache.set("slug:b", 2), cache.set("list", 3)]);
    await cache.del("list");
    expect(await cache.get("list")).toBeUndefined();
    await cache.delPrefix("slug:");
    expect(await cache.get("slug:a")).toBeUndefined();
    expect(await cache.get("slug:b")).toBeUndefined();
  });

  it("wrap loads once, then serves the cached copy", async () => {
    const cache = make();
    const loader = vi.fn(async () => ({ items: [1, 2] }));
    const first = await cache.wrap("k", 60, loader);
    first.items.push(99); // mutating the result must not change the cache
    expect(await cache.wrap("k", 60, loader)).toEqual({ items: [1, 2] });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reports each wrap lookup as a hit or a miss", async () => {
    const lookups: [string, boolean][] = [];
    const cache = createCache({
      redis: null,
      prefix: "t:",
      defaultTtlSeconds: 60,
      onLookup: (key, hit) => lookups.push([key, hit]),
    });
    await cache.wrap("k", 60, async () => 1);
    await cache.wrap("k", 60, async () => 1);
    expect(lookups).toEqual([
      ["k", false],
      ["k", true],
    ]);
  });
});
