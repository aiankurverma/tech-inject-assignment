import type { Redis } from "@ti/redis";
import type { Decision, Limiter } from "./types";

export interface TokenBucketOptions {
  /** Max burst size (bucket starts full). */
  capacity: number;
  /** Tokens added back per second (sustained rate). */
  refillPerSecond: number;
  /** Used in Redis keys, so two limiters never share buckets. */
  name: string;
  redis?: Redis | null;
}

const SCRIPT = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2]) / 1000
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1]) or capacity
local ts = tonumber(b[2]) or now
tokens = math.min(capacity, tokens + (now - ts) * rate)
local allowed = 0
local retry = math.ceil((1 - tokens) / rate)
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
  retry = 0
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / rate))
return {allowed, retry}`;

export function tokenBucket({
  capacity,
  refillPerSecond,
  name,
  redis,
}: TokenBucketOptions): Limiter {
  if (redis) {
    return {
      async hit(key) {
        const [ok, retry] = (await redis.eval(
          SCRIPT,
          1,
          `ti:rl:${name}:${key}`,
          capacity,
          refillPerSecond,
        )) as [number, number];
        return { allowed: ok === 1, retryAfterMs: Math.max(0, retry) };
      },
    };
  }

  const buckets = new Map<string, { tokens: number; ts: number }>();
  return {
    async hit(key): Promise<Decision> {
      const now = Date.now();
      const b = buckets.get(key) ?? { tokens: capacity, ts: now };
      b.tokens = Math.min(capacity, b.tokens + ((now - b.ts) / 1000) * refillPerSecond);
      b.ts = now;
      buckets.set(key, b);
      if (b.tokens < 1) {
        return {
          allowed: false,
          retryAfterMs: Math.ceil(((1 - b.tokens) / refillPerSecond) * 1000),
        };
      }
      b.tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
