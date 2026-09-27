import type { Redis } from "@ti/redis";

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Deletes every key that starts with `prefix` (inside this cache's own prefix). */
  delPrefix(prefix: string): Promise<void>;
  /**
   * Returns the cached value, or runs `loader`, caches its result and returns it.
   * If the store is unreachable it just uses `loader` (a Redis outage never breaks reads).
   */
  wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
}

export interface CacheOptions {
  redis: Redis | null;
  /** Namespace for every key, e.g. "ti:catalog:". */
  prefix: string;
  defaultTtlSeconds: number;
  /** Called after every `wrap` lookup (for logs/metrics). */
  onLookup?: (key: string, hit: boolean) => void;
}

/** Stores the raw JSON string with an expiry. Same contract as Redis GET/SET EX/DEL/SCAN. */
interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, json: string, ttlSeconds: number): Promise<void>;
  del(keys: string[]): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

function memoryStore(): Store {
  const map = new Map<string, { json: string; expires: number }>();
  return {
    async get(key) {
      const hit = map.get(key);
      if (!hit) return null;
      if (hit.expires <= Date.now()) {
        map.delete(key);
        return null;
      }
      return hit.json;
    },
    async set(key, json, ttlSeconds) {
      map.set(key, { json, expires: Date.now() + ttlSeconds * 1000 });
    },
    async del(keys) {
      for (const k of keys) map.delete(k);
    },
    async keys(prefix) {
      return [...map.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

function redisStore(redis: Redis): Store {
  return {
    get: (key) => redis.get(key),
    async set(key, json, ttlSeconds) {
      await redis.set(key, json, "EX", ttlSeconds);
    },
    async del(keys) {
      if (keys.length) await redis.del(...keys);
    },
    async keys(prefix) {
      const match = `${prefix.replace(/[*?[\]\\]/g, "\\$&")}*`;
      const found: string[] = [];
      for await (const batch of redis.scanStream({ match, count: 100 })) found.push(...batch);
      return found;
    },
  };
}

/**
 * Small JSON cache: Redis when given, otherwise an in-process Map with TTL.
 * Values are stored as JSON in both modes, so callers always get a fresh copy.
 */
export function createCache({ redis, prefix, defaultTtlSeconds, onLookup }: CacheOptions): Cache {
  const store = redis ? redisStore(redis) : memoryStore();
  const k = (key: string) => prefix + key;

  const cache: Cache = {
    async get<T>(key: string) {
      const json = await store.get(k(key));
      return json === null ? undefined : (JSON.parse(json) as T);
    },
    async set(key, value, ttlSeconds = defaultTtlSeconds) {
      await store.set(k(key), JSON.stringify(value ?? null), ttlSeconds);
    },
    async del(key) {
      await store.del([k(key)]);
    },
    async delPrefix(p) {
      await store.del(await store.keys(k(p)));
    },
    async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>) {
      const hit = await cache.get<T>(key).catch(() => undefined);
      onLookup?.(key, hit !== undefined);
      if (hit !== undefined) return hit;
      const value = await loader();
      await cache.set(key, value, ttlSeconds).catch(() => undefined);
      return value;
    },
  };
  return cache;
}
