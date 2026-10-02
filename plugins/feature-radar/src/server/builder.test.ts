import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearReplyCache, completeJson, type AiUsage, type ProviderChain } from "./builder";

type Call = { url: string; init: RequestInit };

/** Fake fetch that records calls and answers each one with the next reply. */
function fakeFetch(...replies: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  });
  return { calls, impl: impl as unknown as typeof fetch };
}

const chat = (content: string, usage?: Record<string, unknown>) => ({
  choices: [{ message: { content } }],
  ...(usage ? { usage } : {}),
});

const inception = (fetchImpl: typeof fetch, extra: Partial<ProviderChain> = {}): ProviderChain => ({
  provider: "inception",
  apiKey: "test-key",
  model: "mercury-2.5",
  fetchImpl,
  ...extra,
});

beforeEach(() => clearReplyCache());

describe("inception provider", () => {
  it("sends an OpenAI-style request in JSON mode with the token cap", async () => {
    const f = fakeFetch({ body: chat('{"ok":true}') });
    const r = await completeJson("sys", "user", inception(f.impl, { maxTokens: 1234 }));
    expect(r).toEqual({ ok: true, json: { ok: true } });
    const [call] = f.calls;
    expect(call!.url).toBe("https://api.inceptionlabs.ai/v1/chat/completions");
    expect((call!.init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(call!.init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "mercury-2.5",
      max_tokens: 1234,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "user" },
      ],
    });
  });

  it("reports token usage, including cached input tokens", async () => {
    const f = fakeFetch({
      body: chat("{}", {
        prompt_tokens: 900,
        completion_tokens: 40,
        prompt_tokens_details: { cached_tokens: 800 },
      }),
    });
    const seen: AiUsage[] = [];
    await completeJson("s", "u", inception(f.impl, { onUsage: (u) => seen.push(u) }));
    expect(seen).toEqual([
      {
        provider: "inception",
        model: "mercury-2.5",
        inputTokens: 900,
        outputTokens: 40,
        cachedInputTokens: 800,
      },
    ]);
  });

  it("treats a 401 as a rejected key and moves on to the fallback", async () => {
    const f = fakeFetch(
      { status: 401, body: { error: "bad key" } },
      { body: chat('{"from":"or"}') },
    );
    const r = await completeJson(
      "s",
      "u",
      inception(f.impl, { fallbacks: [{ provider: "openrouter", apiKey: "or", model: "x" }] }),
    );
    expect(r).toEqual({ ok: true, json: { from: "or" } });
    expect(f.calls.map((c) => c.url)).toEqual([
      "https://api.inceptionlabs.ai/v1/chat/completions",
      "https://openrouter.ai/api/v1/chat/completions",
    ]);
  });
});

describe("reply cache", () => {
  it("answers an identical request from the cache when a TTL is set", async () => {
    const f = fakeFetch({ body: chat('{"n":1}') }, { body: chat('{"n":2}') });
    const opts = inception(f.impl, { cacheTtlMs: 60_000 });
    expect(await completeJson("s", "u", opts)).toEqual({ ok: true, json: { n: 1 } });
    expect(await completeJson("s", "u", opts)).toEqual({ ok: true, json: { n: 1 } });
    expect(f.calls).toHaveLength(1);
    // A different prompt is a different request.
    expect(await completeJson("s", "other", opts)).toEqual({ ok: true, json: { n: 2 } });
    expect(f.calls).toHaveLength(2);
  });

  it("does not cache without a TTL or after a failure", async () => {
    const f = fakeFetch(
      { body: chat("not json") },
      { body: chat('{"n":2}') },
      { body: chat('{"n":3}') },
    );
    const cached = inception(f.impl, { cacheTtlMs: 60_000 });
    expect(await completeJson("s", "u", cached)).toEqual({
      ok: false,
      error: "AI reply was not valid JSON.",
    });
    expect(await completeJson("s", "u", cached)).toEqual({ ok: true, json: { n: 2 } });
    const uncached = inception(f.impl);
    await completeJson("x", "y", uncached);
    await completeJson("x", "y", uncached);
    expect(f.calls).toHaveLength(4);
  });

  it("expires entries after the TTL", async () => {
    vi.useFakeTimers();
    try {
      const f = fakeFetch({ body: chat('{"n":1}') }, { body: chat('{"n":2}') });
      const opts = inception(f.impl, { cacheTtlMs: 1000 });
      await completeJson("s", "u", opts);
      vi.advanceTimersByTime(1001);
      expect(await completeJson("s", "u", opts)).toEqual({ ok: true, json: { n: 2 } });
    } finally {
      vi.useRealTimers();
    }
  });
});
