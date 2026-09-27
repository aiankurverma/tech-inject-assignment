# @ti/redis

One shared [ioredis](https://github.com/redis/ioredis) connection for the whole API. The cache,
rate-limit and queue packages all take the client it returns, so the process opens a single
connection (BullMQ duplicates it for its own blocking connections).

## Use in this app

- `apps/api/src/app.ts` calls `getRedis()` once and passes the result to `createCache`,
  `slidingWindow` / `tokenBucket` and `createQueue`.
- `apps/api/src/server.ts` calls `closeRedis()` on shutdown, after the queues have drained.

## API

```ts
import { getRedis, closeRedis, type Redis } from "@ti/redis";

getRedis(); // Redis | null — created lazily on first call, then reused
await closeRedis(); // quit (or disconnect) the shared client; safe when Redis is unused
```

- `maxRetriesPerRequest: 1`: an outage fails fast instead of hanging requests.
- Logs `redis connected` on ready, and only the first error of an outage (message only, so the
  password in `REDIS_URL` never reaches the logs).

## Env vars

| Name        | Meaning                                                           |
| ----------- | ----------------------------------------------------------------- |
| `REDIS_URL` | e.g. `redis://localhost:6379` or `rediss://…` (Render Key Value). |

## Without Redis

`REDIS_URL` unset: `getRedis()` returns `null` and every consumer uses its in-memory fallback.
That is fine for local dev and one instance; run Redis once there is more than one instance.
