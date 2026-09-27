# @ti/queue

One background job queue with a tiny interface: BullMQ on Redis when a client is given, an
in-process async queue otherwise. Both report the same statuses.

## Use in this app

Created in `apps/api/src/app.ts`:

- `bundle-save`: admin uploads (`POST /api/admin/components`, `PUT …/components/:slug`) over
  `QUEUE_THRESHOLD_BYTES` are validated and saved in the background. The route answers
  `202 { status: "queued", jobId }`; the admin polls `GET /api/admin/jobs/:id`.
- `feature-build`: feature-radar AI draft builds (`POST /api/admin/features/:id/generate`). LLM
  calls are slow, so these always go through the queue.

`app.shutdown()` closes both queues (running jobs finish) before `closeRedis()`.

## API

```ts
import { createQueue } from "@ti/queue";

const q = createQueue<Job>("bundle-save", processor, { redis, concurrency: 1 });
const id = await q.add(data); // job id
await q.status(id); // { id, state: "queued" | "active" | "completed" | "failed", error? } | null
await q.close(); // stop taking jobs, wait for running ones
```

Finished and failed jobs are kept for 1 hour, then `status()` returns `null`.

## Env vars

None of its own. `REDIS_URL` (via `@ti/redis`); the API reads `QUEUE_THRESHOLD_BYTES`
(default `200000`) to decide which uploads are queued.

## Without Redis

Jobs run in the same process (always async, respecting `concurrency`), with the same statuses.
Jobs are lost on restart and only visible to the instance that took them.
