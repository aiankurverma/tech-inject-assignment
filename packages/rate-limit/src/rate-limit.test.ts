import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, slidingWindow, tokenBucket } from "./index";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("slidingWindow (in-memory)", () => {
  it("allows N, blocks, then recovers once the window slides past", async () => {
    const limiter = slidingWindow({ name: "t", limit: 3, windowMs: 10_000 });
    for (let i = 0; i < 3; i++) {
      expect((await limiter.hit("ip")).allowed).toBe(true);
      vi.advanceTimersByTime(1_000); // hits at t=0, 1s, 2s
    }
    const blocked = await limiter.hit("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(7_000); // oldest hit (t=0) leaves the window at t=10s
    expect((await limiter.hit("other-ip")).allowed).toBe(true); // keys are independent

    vi.advanceTimersByTime(7_000);
    expect((await limiter.hit("ip")).allowed).toBe(true); // one slot freed
    expect((await limiter.hit("ip")).allowed).toBe(false);
  });
});

describe("tokenBucket (in-memory)", () => {
  it("allows a burst up to capacity, then refills over time", async () => {
    const limiter = tokenBucket({ name: "t", capacity: 5, refillPerSecond: 2 });
    for (let i = 0; i < 5; i++) expect((await limiter.hit("ip")).allowed).toBe(true);
    const blocked = await limiter.hit("ip");
    expect(blocked).toEqual({ allowed: false, retryAfterMs: 500 });

    vi.advanceTimersByTime(1_000); // +2 tokens
    expect((await limiter.hit("ip")).allowed).toBe(true);
    expect((await limiter.hit("ip")).allowed).toBe(true);
    expect((await limiter.hit("ip")).allowed).toBe(false);

    vi.advanceTimersByTime(60_000); // refill never exceeds capacity
    for (let i = 0; i < 5; i++) expect((await limiter.hit("ip")).allowed).toBe(true);
    expect((await limiter.hit("ip")).allowed).toBe(false);
  });
});

describe("rateLimit middleware", () => {
  it("returns 429 JSON with Retry-After when blocked", async () => {
    vi.useRealTimers();
    const app = express();
    app.get(
      "/x",
      rateLimit({
        algorithm: slidingWindow({ name: "mw", limit: 1, windowMs: 60_000 }),
        key: () => "same",
        message: "Slow down.",
      }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    await request(app).get("/x").expect(200);
    const r = await request(app).get("/x").expect(429);
    expect(r.body).toEqual({ error: "rate_limited", message: "Slow down." });
    expect(r.headers["retry-after"]).toBe("60");
  });

  it("fails open when the store is down", async () => {
    vi.useRealTimers();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    const broken = { hit: async () => Promise.reject(new Error("redis down")) };
    app.get("/x", rateLimit({ algorithm: broken, key: () => "k" }), (_req, res) => {
      res.json({ ok: true });
    });
    await request(app).get("/x").expect(200);
    spy.mockRestore();
  });
});
