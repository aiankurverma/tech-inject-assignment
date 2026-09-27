# @ti/feature-radar

Turns failed component-catalogue searches into reviewable feature requests.

## Endpoints

| Method | Path                          | Auth   | Notes                                                                     |
| ------ | ----------------------------- | ------ | ------------------------------------------------------------------------- |
| POST   | `/api/features/searches`      | public | Report a no-results search; rate-limited 30/min/IP                        |
| GET    | `/api/features/lookup?term=x` | public | Returns `{status:"building", term, eta, interested}` or `{status:"none"}` |
| GET    | `/api/admin/features`         | admin  | List all requests, sorted by `searchCount` desc                           |
| PATCH  | `/api/admin/features/:id`     | admin  | Update `status`; accepts optional `etaDays` (1-90) when building          |
| DELETE | `/api/admin/features/:id`     | admin  | Remove a request                                                          |

## Mount (3 lines)

```ts
import { featureRadarRoutes } from "@ti/feature-radar/server";
const { publicRouter, adminRouter } = featureRadarRoutes({ requireAdmin: auth.requireAdmin });
app.use("/api", publicRouter);
app.use("/api/admin/features", adminRouter);
```

Add these lines in `apps/api/src/app.ts` after the existing `app.use("/api", publicRoutes(...))` call and before the 404 handler.

Optional hooks (the plugin never imports the host's infrastructure):

- `searchLimiter` — Express middleware for `POST /features/searches` (default: 30/min/IP in memory). The API passes a Redis-backed token bucket.
- `enqueueBuild(job)` — send an AI draft build to a background queue; the queue worker calls the returned `processBuild(job)`. Default: runs in-process after the 202.

## Client components

- **`ComingSoonNotice`** — place next to a search result list; pass `query` and `noResults`. Shows nothing on hits; debounces 800 ms on misses, reports once per term per page session, then shows a "coming soon" notice when the term is being built.
- **`FeatureRadarAdmin`** — drop into the admin UI; full CRUD table for reviewing requests.

## Honesty rule

`interested` is always the real `searchCount` from the database. It is `null` (not zero or a fake number) when `searchCount < 5`. The UI should say _"Be one of the first to ask for this"_ in that case. Never fabricate or inflate request counts.
