# @ti/cache

Small JSON cache with a TTL: Redis when a client is given, an in-process `Map` otherwise. Values
are stored as JSON in both modes, so callers always get a fresh copy.

## Use in this app

- `apps/api/src/app.ts` creates the catalogue cache: prefix `ti:catalog:`, default TTL 60 s.
- `apps/api/src/catalog.ts` wraps the published-component reads (`list`, `slug:<slug>`) with
  `cache.wrap(...)`; `forgetPublished()` deletes those keys after every admin write or publish,
  so changes show at once. Tests pass their own cache via `createApp(..., { cache })`.

## API

```ts
import { createCache } from "@ti/cache";

const cache = createCache({ redis: getRedis(), prefix: "ti:catalog:", defaultTtlSeconds: 60 });
await cache.get<T>(key); // T | undefined on a miss
await cache.set(key, value, ttlSeconds); // ttlSeconds optional (default TTL)
await cache.del(key);
await cache.delPrefix("slug:"); // SCAN + DEL inside this cache's prefix
await cache.wrap(key, ttlSeconds, loader); // cached value, or run loader and store the result
```

`wrap` never fails because of the store: if Redis is unreachable it just returns `loader()`.

## Env vars

None of its own. Redis comes from `REDIS_URL` via `@ti/redis`.

## Without Redis

`redis: null` uses the in-memory store (same TTL and prefix semantics, expired entries dropped on
read). Each process then has its own cache, so with several instances an admin change can take
up to the TTL (60 s) to show on the others.
