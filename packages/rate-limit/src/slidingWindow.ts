import type { Redis } from "@ti/redis";
import type { Decision, Limiter } from "./types";

export interface SlidingWindowOptions {
  /** Max hits per key inside any window of `windowMs`. */
  limit: number;
  windowMs: number;
  /** Used in Redis keys, so two limiters never share counters. */
  name: string;
  redis?: Redis | null;
}

// Sorted set of hit timestamps: drop old ones, count, add if under the limit. Atomic in Redis.
const SCRIPT = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local window = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, tonumber(oldest[2]) + window - now}
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}`;

/** Sliding-window log: at most `limit` hits in the last `windowMs`, no burst at window edges. */
export function slidingWindow({ limit, windowMs, name, redis }: SlidingWindowOptions): Limiter {
  if (redis) {
    return {
      async hit(key) {
        const member = `${Date.now()}-${Math.random()}`;
        const [ok, retry] = (await redis.eval(
          SCRIPT,
          1,
          `ti:rl:${name}:${key}`,
          windowMs,
          limit,
          member,
        )) as [number, number];
        return { allowed: ok === 1, retryAfterMs: Math.max(0, retry) };
      },
    };
  }

  const hits = new Map<string, number[]>();
  return {
    async hit(key): Promise<Decision> {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: recent[0]! + windowMs - now };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
