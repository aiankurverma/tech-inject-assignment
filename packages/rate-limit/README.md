# @ti/rate-limit

Two rate-limit algorithms and an Express middleware. With Redis each check is one atomic Lua
script (server `TIME`), so every instance shares the same counters.

## Use in this app

Wired in `apps/api/src/app.ts`, keyed by client IP (`trust proxy` is on):

| Limiter          | Algorithm      | Limit                     | Route                         |
| ---------------- | -------------- | ------------------------- | ----------------------------- |
| `customer-login` | sliding window | 10 / 15 min               | `POST /api/auth/login`        |
| `admin-login`    | sliding window | 10 / 15 min               | `POST /api/admin/login`       |
| `registry`       | token bucket   | burst 60, refill 2/s      | `GET /api/registry/:slug`     |
| `feature-search` | token bucket   | burst 30, refill 1 per 2s | `POST /api/features/searches` |

With `NODE_ENV=test` the limits are raised to 10 000 so tests are not throttled.

## API

```ts
import { rateLimit, slidingWindow, tokenBucket } from "@ti/rate-limit";

slidingWindow({ name, limit, windowMs, redis }); // at most `limit` hits in any `windowMs`
tokenBucket({ name, capacity, refillPerSecond, redis }); // bursts up to `capacity`
rateLimit({ algorithm, key: (req) => req.ip ?? "unknown", message }); // Express middleware
```

Blocked requests get `429 { error: "rate_limited", message }` and a `Retry-After` header. Redis
keys are `ti:rl:<name>:<key>` and expire on their own. If the store throws (Redis outage), the
request is let through and the error is logged.

## Env vars

None of its own. `REDIS_URL` via `@ti/redis`.

## Without Redis

`redis: null` keeps counters in an in-process `Map` with the same algorithms, so limits are per
instance (N instances allow up to N times the limit).
