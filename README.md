# Kitbase

CRM-themed React + TypeScript component library with a public catalogue, an admin publishing app, and server-enforced premium access. Built for the Tech Inject assignment "Design Theme Library".

## Live demo

Deployed on Render (free plan) and verified on 2026-09-27. The live URLs are shared privately with reviewers, together with the test credentials (admin, free, premium); they are not listed in this repo.

Install a component into your own project (`<site>` = the deployed catalogue URL):

```bash
npx <site>/cli/kitbase.tgz add button
```

Premium components also need `KITBASE_TOKEN` in the environment (see [Premium setup](#premium-setup-and-usage)).

The free instance sleeps after 15 idle minutes (cold start about 50 s). The server pings its own `/api/health` every 13 minutes (`KEEP_ALIVE_MINUTES=13`) so it stays awake.

Stack: **MERN + TypeScript (strict) + Tailwind CSS v4**. MongoDB (Mongoose), Express 5, React 19 (Vite 7), Node 22, npm workspaces + Turborepo (`turbo.json`: cached `build`/`typecheck` task graph; `--filter` builds only what each Render service needs). Optional Redis (ioredis + BullMQ) for the cache, background queue and rate limits; without it everything falls back to in-memory.

## Architecture

```
apps/
  api/       Express API. Also serves the built catalogue (/) and admin (/admin), so cookies are same-origin
  web/       Public catalogue: shadcn-style landing page, docs layout, light/dark/system theme
  admin/     Admin dashboard: Overview, Components, Editor, Privileges, Feature radar (+ login)
  preview/   Sandboxed renderer on its own origin; compiles bundle TSX in the browser (sucrase)
packages/
  core/        Pure rules: bundle schema + validation, access decision, registry/copy/prompt builders
  client/      Shared React bits: PreviewFrame, CopyButton, CodeBlock, api()
  cli/         Zero-dependency installer, served as /cli/kitbase.tgz
  ui/          CRM theme, 26 components, examples, registry manifests (free seed data)
  redis/       One shared ioredis connection from REDIS_URL (null when unset)
  cache/       Small JSON cache: Redis, or an in-memory Map with TTL
  queue/       Background jobs: BullMQ on Redis, or in-process with the same interface
  rate-limit/  Sliding-window and token-bucket limiters + Express middleware (429 + Retry-After)
plugins/
  feature-radar/  Search-driven feature requests and the AI draft builder (own model, routes, UI)
examples/consumer-cli/   Clean Vite + React + TS app built only from `npx ... add` output
docs/        reference captures, tokens, inventory, comparison, bundle format
```

How a request flows:

1. The admin uploads a JSON bundle (`docs/bundle-format.md`). It's validated by `@ti/core` (schema, safe paths, import allow-list, dependency list, sizes, `React.*` needs a React import) and saved as a **draft**. Bundles over `QUEUE_THRESHOLD_BYTES` are validated and saved by a background job instead (see below).
2. **Publish** copies the draft into an immutable `published` snapshot. Preview, Copy code, the installer and the agent prompt all read that one snapshot, so they always show the same version.
3. Every protected request calls `decideAccess()` (`packages/core/src/access.ts`) with the customer loaded **fresh from the DB**, whether it comes in with the session cookie or a `Bearer` token. Revoking access therefore takes effect on the next request.
4. Published documents are cached for 60 s. Every admin write (draft save, publish, unpublish, free/premium switch, delete) drops the cached list and that slug, so changes show on the next request. Only the DB documents are cached; the access decision is never cached.

## Local setup

Requires Node 22 and MongoDB 7+ (local service, Docker or Atlas). Redis is optional.

```bash
npm install
cp .env.example .env         # then set JWT_SECRET, ADMIN_PASSWORD and the seed passwords
npm run seed                 # 2 test customers + 26 components (3 premium demo fixtures)
npm run build                # all apps + the CLI tarball
npm start -w apps/api        # API on :4000, serving the built catalogue and admin
npm run dev -w apps/preview  # sandboxed preview on :5185
```

Local URLs: catalogue http://localhost:4000, admin http://localhost:4000/admin/, preview http://localhost:5185. For hot reload, `npm run dev` also starts Vite dev servers for the catalogue (:5183) and admin (:5184) next to the API and preview.

### Environment variables

| Name                                                      | Where               | Example                                                       |
| --------------------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| `MONGODB_URI`                                             | api, seed           | `mongodb+srv://user:pass@cluster/techinject`                  |
| `PUBLIC_ORIGIN`                                           | api, CLI build      | `https://<your-web-service>.onrender.com`                     |
| `PREVIEW_ORIGIN`                                          | api (CSP frame-src) | `https://<your-preview-site>.onrender.com`                    |
| `VITE_PREVIEW_ORIGIN`                                     | web/admin build     | same as `PREVIEW_ORIGIN`                                      |
| `VITE_PARENT_ORIGINS`                                     | preview build       | `https://<your-web-service>.onrender.com`                     |
| `JWT_SECRET`                                              | api                 | 48+ random characters                                         |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`                        | api                 | the single admin; never sent to the frontend                  |
| `TRUSTED_ORIGINS`                                         | api (dev only)      | `http://localhost:5183,http://localhost:5184`                 |
| `SEED_FREE_EMAIL/PASSWORD`, `SEED_PREMIUM_EMAIL/PASSWORD` | seed                | test accounts                                                 |
| `REDIS_URL`                                               | api (optional)      | `redis://...`; unset = in-memory cache, queue and limits      |
| `QUEUE_THRESHOLD_BYTES`                                   | api                 | `200000` (bundles above this go through the queue)            |
| `KEEP_ALIVE_MINUTES`                                      | api (optional)      | `13`; self-ping of `/api/health` so the free plan stays awake |
| AI builder variables                                      | api (optional)      | see [Feature radar](#feature-radar-and-ai-draft-builder)      |

**API keys must never be committed.** `.env` is git-ignored and `.env.example` holds only placeholders. The AI provider keys used during development must be rotated before they are used in any deploy.

### Commands

| Command                                    | What it does                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm run check`                            | Prettier check, ESLint, `tsc` in every workspace, Vitest                                        |
| `npm test`                                 | Unit tests plus API integration tests (needs MongoDB; `TEST_MONGODB_URI` overrides the default) |
| `npm run build`                            | Build all apps and the CLI tarball                                                              |
| `npm run seed`                             | Upsert the 2 test customers and the 26 repo components (3 marked premium as demo fixtures)      |
| `npx tsx packages/ui/scripts/sync-deps.ts` | Recompute registry dependencies from imports                                                    |
| `node scripts/capture-crm.mjs`             | Re-capture the 81 reference screenshots                                                         |

## Using components (consumer)

Set up a React + TS + Tailwind v4 project with an `@/` alias pointing to `src` (steps on the **Get started** page), then:

```bash
npx --yes <PUBLIC_ORIGIN>/cli/kitbase.tgz add data-table
npm install <printed dependencies>
```

Then start your main CSS with the three lines the installer prints, in this order: the Geist font `@import url(...)`, `@import "tailwindcss";`, then `@import "./styles/crm-theme.css";` (the font import must come first). The installer:

- writes only inside `<project>/src` and rejects `..`, absolute paths and unknown folders
- never overwrites a changed file (exit code 2) unless you pass `--overwrite`; identical files are reported as `unchanged`
- prints dependencies and never runs shell commands from component content
- supports `--src`, `--dry-run` and `--api`

### Premium setup and usage

1. The admin grants Premium in **Admin -> Privileges** (there are no payments and no self-upgrade).
2. Sign in to the catalogue, open **Account**, and create a token. It is shown once and stored only as a sha256 hash.
3. Put it in the shell: `export KITBASE_TOKEN=ti_...` (PowerShell: `$env:KITBASE_TOKEN="ti_..."`).
4. `npx --yes <PUBLIC_ORIGIN>/cli/kitbase.tgz add <premium-slug>`. **Copy prompt** tells AI agents to use the same variable; the token never appears in commands, prompts, files or logs.

Signed-out requests get 401 and free accounts get 403 with a clear message. Revoking Premium or the token blocks the next request. **Code that was already copied or installed stays in the consumer's project; revocation cannot take it back.**

## Admin app

The sidebar has **Overview**, **Components** (the list, plus the **Editor** to upload, validate, preview the draft and publish), **Privileges** and **Feature radar**. All of it sits behind the admin login.

### Privileges

`/admin/privileges` (`apps/admin/src/Privileges.tsx`) is one page for components and customers.

- **Components:** publish/unpublish inline on each row. The row menu has Edit, Make free / Make premium, View in catalogue (published only), and Delete, which asks for confirmation first.
- **Customers:** Block / Unblock the account and grant/revoke Premium. A blocked account cannot sign in, its API tokens stop working on the next request, and all its browser sessions (refresh tokens) are revoked, so unblocking does not revive old sessions.
- **API:** `POST /api/admin/components/:slug/access` (`{ access: "free" | "premium" }`), `DELETE /api/admin/components/:slug`, `POST /api/admin/customers/:id/status` (`{ disabled }`), plus the existing publish, unpublish and `customers/:id/plan` routes.
- **Access switch:** it updates the draft **and** the live published snapshot (`apps/api/src/routes.ts`), so switching a live component to premium locks it on the next request. Only the access label changes; the published source stays the same version.
- Deleting is permanent. Copies already installed in consumer projects are not affected.
- Tests: "privileges: customer enable/disable and component delete" and "admin access switch" (`apps/api/test/api.test.ts`).

### Feature radar and AI draft builder

`plugins/feature-radar` has its own model, routes and UI and is mounted in `apps/api/src/app.ts`. The plugin never imports the host's infrastructure; the API passes in the admin guard, the search rate limiter, the queue and the draft store.

- **Search-driven requests:** a catalogue search with no results is recorded as a feature request (`POST /api/features/searches`).
- **Admin statuses:** new, valid, rejected, or building with an ETA of 1-90 days.
- **Coming soon:** users who search a term that is being built see a "Coming soon" notice with the ETA (`ComingSoonNotice`).
- **Real counts only:** the public count is the real search count and is `null` below 5, where the UI says "Be one of the first to ask for this" (`publicInterest()` in `normalize.ts`).
- **AI draft builder** (`plugins/feature-radar/src/server/builder.ts`): on a "building" request the admin can click **Generate with AI**. The build runs in the queue and the result must pass the same `validateBundle()` rules; one retry sends the validation errors back to the model. The output is saved **only as a draft** and is never published automatically. **Regenerate** replaces the existing draft; the live published version is untouched. A rejected API key fails fast with a clear message instead of retrying.
- **Providers and fallback:** the primary provider is Anthropic, or Gemini with `AI_PROVIDER=gemini`. If it fails (rejected key, HTTP error, unreachable, unreadable reply), the builder tries each OpenRouter key, then Ollama Cloud.

| Variable                                  | Purpose                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `AI_PROVIDER`                             | `gemini` uses `GEMINI_API_KEY`; anything else uses `ANTHROPIC_API_KEY`               |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`    | Primary provider key. With no primary key the builder is off (503 on generate)       |
| `FEATURE_BUILDER_MODEL`                   | Primary model (default `claude-sonnet-5`, or `gemini-2.5-flash` for Gemini)          |
| `OPENROUTER_API_KEYS`, `OPENROUTER_MODEL` | Fallbacks: comma-separated keys, tried in order (default model `openai/gpt-4o-mini`) |
| `OLLAMA_CLOUD_KEY`, `OLLAMA_CLOUD_MODEL`  | Last fallback (default model `gpt-oss:120b`)                                         |

Tests: "feature-radar plugin" in `apps/api/test/api.test.ts` (search recording, protected admin routes, counts never inflated, generate returns 409/503/401 in the right cases, a valid AI bundle becomes a draft and is never auto-published, invalid output twice marks the build failed and creates nothing) and `normalize.test.ts`.

### Redis, queue, cache and rate limits

These are wired in `apps/api/src/app.ts`. With `REDIS_URL` they use Redis. Without it the same interfaces run in memory, which is fine for one instance.

- **Cache** (`@ti/cache`): published catalogue documents for 60 s, invalidated at once by admin writes.
- **Rate limits** (`@ti/rate-limit`): the customer and admin logins use a sliding window (10 per 15 minutes per IP). The registry (capacity 60, 2/s) and feature search (capacity 30, 0.5/s) use a token bucket. In Redis both are atomic Lua scripts. If the store is down, the limiter fails open and logs an error.
- **Queue** (`@ti/queue`): BullMQ on Redis, or in-process. AI draft builds always go through it. Bundle uploads larger than `QUEUE_THRESHOLD_BYTES` (default 200000) get `202 { status: "queued", jobId }`, and the admin polls `GET /api/admin/jobs/:id` until the job completes or fails.
- Tests: `packages/cache`, `packages/queue`, `packages/rate-limit` unit tests and "infrastructure: cache, queue, rate limit" in the API tests.

### Theming

The catalogue and the admin both have a Light / Dark / System switch. They share the `localStorage` key `ti-theme`, and "System" follows the OS setting. A tiny inline script in each `index.html` applies the theme before first paint (no flash). The two copies of the script are identical, so the strict CSP allows them by one sha256 hash in `apps/api/src/app.ts`; update that hash if the script changes.

## Security notes

- **Admin:** separate cookie (`ti_admin`, path `/api/admin`) and JWT audience `admin`. Customer tokens can never pass as admin tokens. There is no endpoint that lets a customer change their own plan (tested).
- **Sessions:** the access JWT lives 15 minutes; a 10-day refresh token (random, stored only as sha256 in `refreshtokens`, `apps/api/src/refresh.ts`) renews it. Every refresh rotates the token; reusing an old one more than 30 s later revokes the whole chain. Logout revokes the chain. The refresh cookie is only sent to `/api/auth` (customer) or `/api/admin` (admin). The frontend retries a request once after a 401 via `/refresh`, and `/api/auth/me` renews silently. CLI/agent tokens are separate and last until revoked.
- **Cookies:** httpOnly and SameSite=strict (Secure in production). Cookie-authenticated writes also need a trusted `Origin`. Logins are rate-limited (sliding window, per IP).
- **Caching and secrets:** protected responses are `Cache-Control: no-store`. Secrets come only from env. Logs are JSON and never contain bodies, cookies or tokens; the Redis error log carries only the message, never `REDIS_URL`.
- **Premium storage:** premium sources live only in MongoDB and are served only through access-checked routes. They are never in the repo, the public bundle or static files. The repo only holds 3 premium **demo fixtures** (Data Table, Command Palette, Notifications), which the brief allows; protection is proven with a premium component uploaded at runtime that is not in the repo.
- **Uploaded and AI-generated code:** never executed on the server or in the admin page. AI output goes through the same validation and is only saved as a draft.
- **Preview isolation:** a separate origin, `<iframe sandbox="allow-scripts">` (no same-origin, so the frame has an opaque origin), and code delivered by postMessage with origin checks. The strict CSP includes `connect-src 'none'`. `docs/reference/isolation-probe.png` shows a probe component failing to read cookies, localStorage or the parent page, and failing to call the API.
- **Known preview limits:** `unsafe-eval` is needed to run compiled code. A malicious preview can still burn CPU or draw misleading UI inside its own frame. Static assets need `Access-Control-Allow-Origin: *` because the frame's origin is `null`. The preview puts `React` in scope, so the validator rejects code that uses `React.*` without importing it (it would preview but fail in a real project).

## Test results

**2026-09-27, local:** `npx vitest run` passed **83/83 tests** in 7 files. `npm run check` is clean (Prettier, ESLint, and `turbo run typecheck` in every workspace).

| File                                                 | Tests | Covers                                                                                                                                                                        |
| ---------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/test/api.test.ts`                          |    32 | admin protection, publishing, premium access, CLI end to end, privileges, feature radar, admin access switch, infrastructure, refresh tokens (rotation, reuse, logout, block) |
| `packages/core/src/core.test.ts`                     |    15 | bundle validation, the access table, drafts hidden, registry/copy/prompt output with no token leaks                                                                           |
| `packages/cli/test/lib.test.ts`                      |    14 | unsafe paths, `--src` escape, overwrite rules, argument parsing, malformed registry responses                                                                                 |
| `plugins/feature-radar/src/server/normalize.test.ts` |    10 | term normalising, real counts only (`null` below 5)                                                                                                                           |
| `packages/rate-limit/src/rate-limit.test.ts`         |     4 | sliding window, token bucket, 429 + Retry-After, fails open                                                                                                                   |
| `packages/cache/src/cache.test.ts`                   |     5 | get/set, TTL expiry, del/delPrefix, wrap, hit/miss hook                                                                                                                       |
| `packages/queue/src/queue.test.ts`                   |     3 | async jobs and status, failures, concurrency                                                                                                                                  |

Earlier checks (2026-09-24, not re-run since):

- Flow B against the running server with a premium component uploaded at runtime (not in the repo): **15/15 checks passed** (draft hidden, locked signed-out 401, free 403, grant, access, revoke, next request 403, free still works, unpublish).
- Copy-paste: `examples/consumer-copy` is a clean Vite app built only from the **Copy code** text (`paste.mjs` splits it into files the way a user would paste them). `vite build` passes.
- Mobile (390px): the catalogue component page works (`docs/reference/catalogue-mobile.png`).
- Consumer: `examples/consumer-cli` is a clean Vite app. Components were added with `npx <origin>/cli/kitbase.tgz add ...`, and `tsc --noEmit && vite build` passes. Screenshot: `docs/reference/consumer-cli.png`.
- Production mode (API serving the built apps, built preview with CSP headers) renders correctly.

## Component inventory

- 43 UI patterns found in the CRM: `docs/reference/component-inventory.md`, each mapped to screenshots.
- Grouped into **26 registry components**; variants live inside a component instead of being duplicated.
- Reference vs recreation: `docs/comparison.md`.
- Omitted: CRM business features (sorting/filtering data, billing, invites, trials) and the CRM's own brand images.

## Deploy (Render + MongoDB Atlas)

The live site was set up by hand in the Render dashboard (free plan). Deploys are manual: auto-deploy is off and there is no CI/CD pipeline (the GitHub Actions workflow was removed). To release, pick the commit in Render and deploy it.

| Part       | Render resource                      | Notes                                                                                                                                                            |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API + apps | Web service (Node)                   | Node 22. Serves the API, the catalogue (`/`), the admin (`/admin/`) and `/cli/kitbase.tgz`. Health check `/api/health`                                           |
| Preview    | Static site                          | Headers set in the dashboard: `Access-Control-Allow-Origin: *`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. CSP is a meta tag in the page |
| Redis      | Key Value (`noeviction`)             | Reached through its internal URL as `REDIS_URL`; not reachable from outside Render                                                                               |
| Database   | MongoDB Atlas, database `techinject` | `MONGODB_URI`                                                                                                                                                    |

Env var names set on the web service: `NODE_ENV`, `NODE_VERSION`, `MONGODB_URI`, `PUBLIC_ORIGIN`, `PREVIEW_ORIGIN`, `VITE_PREVIEW_ORIGIN`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `REDIS_URL`, `QUEUE_THRESHOLD_BYTES`, `KEEP_ALIVE_MINUTES` (13), plus the optional AI builder variables. On the preview site: `NODE_VERSION`, `VITE_PARENT_ORIGINS`. Values live only in the Render dashboard.

`render.yaml` describes the same setup as a Render blueprint.

Steps for a fresh setup:

1. Create an Atlas cluster and a database user, and allow Render's IPs.
2. Create the web service, the static preview site (with the three headers above) and the Key Value instance, or create a blueprint from `render.yaml`.
3. Set the env vars above in the dashboard. Redis is optional: without `REDIS_URL` the API runs in memory. Use newly rotated AI keys, never the development ones. Build the CLI with the final `PUBLIC_ORIGIN`.
4. Run the seed once: `npm run seed`.
5. Deploy manually, then run the checks in [Deployed checks](#deployed-checks).

Free plan limits: 750 instance hours per month, and the instance sleeps after 15 idle minutes (cold start about 50 s). `KEEP_ALIVE_MINUTES=13` keeps it awake.

### Deployed checks

Run against the live site on 2026-09-27. All passed.

| Check              | Result                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health and pages   | `/api/health`, `/`, `/admin/` and `/cli/kitbase.tgz` return 200                                                                                                                                                                                                                       |
| Catalogue          | The catalogue API lists 28 published components, 5 premium (`data-table`, `forecast-card`, `command-palette`, `notifications`, `tag`)                                                                                                                                                 |
| Preview isolation  | The iframe renders from the separate preview origin with `sandbox="allow-scripts"`. The preview site sends the three headers above; its CSP meta has `connect-src 'none'`                                                                                                             |
| Access, signed out | Free `button`: copy, prompt, preview and registry return 200. Premium `data-table`: copy, preview, prompt and registry return 401. `/api/admin/components` returns 401                                                                                                                |
| Live CLI           | In a clean Vite + React + TS + Tailwind v4 app, `add button` and `add badge` wrote files and printed deps. After installing them, `tsc --noEmit` and `vite build` passed                                                                                                              |
| CLI safety         | `add tag` / `add data-table` without a token: refused, exit 1, nothing written. Changed local file without `--overwrite`: refused, exit 2, edit kept. `add ../evil`: refused                                                                                                          |
| CLI re-run         | Re-running on identical files prints `unchanged` (exit 0). Uninstall (delete the added files, `npm uninstall` the printed deps) leaves an app that still builds                                                                                                                       |
| Redis              | App log shows `redis connected` after deploy, no Redis errors; Key Value shows active connections. First request per component about 0.8 s, repeat about 0.35 s, slow again after 60 s (the cache TTL). Indirect evidence: keys were not inspected because the store is internal only |
| Persistence        | After a manual redeploy of a new commit, all 28 components and their premium flags were still there                                                                                                                                                                                   |
| Local              | `npm run check` clean; `npx vitest run` 83/83 tests                                                                                                                                                                                                                                   |

Not yet run on the live site (they need an admin and customer sign-in by the owner):

- **Journey A:** the admin uploads `examples/demo-bundles/pipeline-health.json`, validates, previews and publishes it, and it appears in the catalogue without a redeploy.
- **Journey B:** a new premium component; a free user is blocked; grant Premium gives access; revoke blocks again.

Both passed locally earlier (flow B 15/15 against Atlas).

### Recovery plan

- **Bad publish:** re-publish the previous draft version, or unpublish. The snapshot model means the live version only changes on publish.
- **Bad deploy:** roll back to the previous deploy in Render (the build is stateless, and data lives in Atlas).
- **Data:** Atlas continuous backups / point-in-time restore. The free components can always be re-seeded from the repo; premium bundles are backed up only by Atlas.
- **Leaked secret:** rotate `JWT_SECRET` (logs everyone out), `ADMIN_PASSWORD` and any AI provider key; customers revoke and recreate their tokens.

## AI tool usage

- **Tool:** Claude Code (Claude Opus).
- **One prompt used:** "start building these whole platform", after sharing the assignment brief, a build plan and the captured CRM tokens.
- **One corrected suggestion:** the first plan used the shadcn CLI as the installer. It was replaced with our own small CLI, because the brief requires "no silent overwrite", "rejects unsafe paths" and token auth from the environment, and those are only fully controllable (and testable) in our own code.
- **Another correction:** Vitest 2 hoisted Vite 5 and broke the Vite 7 plugin types. It was fixed by moving to Vitest 3.

## Gaps / next steps

- Journeys A and B have not been run on the deployed site yet. They need an admin and customer sign-in by the owner. Both passed locally.
- The Redis cache evidence on the live site is indirect (timings and logs). The keys were not inspected because the Key Value store is internal only.
- Free plan cold starts (about 50 s after 15 idle minutes) are mitigated by the keep-alive ping, not removed. The ping uses instance hours (750 per month on the free plan).
- Deploys are manual; there is no CI/CD pipeline.
- A recorded keyboard and mobile walkthrough is still to be done.
- The AI keys used during development must be rotated before they are used in any deploy.
- Agent prompt: run in clean `examples/consumer-agent` by an AI agent, which succeeded (`RESULT.md`). It found the Geist `@import` ordering bug, now fixed via one shared `CSS_SETUP` (Copy code, prompt and Get started; the zero-dependency CLI prints the same three lines). Two of its corrections came from my test setup (a pre-filled `package.json`), not from the prompt.
- Time spent: about 6 hours.
