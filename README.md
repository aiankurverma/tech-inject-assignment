# Kitbase

CRM-themed React + TypeScript component library with a public catalogue, an admin publishing app, and server-enforced premium access. Built for the Tech Inject assignment "Design Theme Library".

The live URLs and test accounts (admin, free, premium) are shared privately with reviewers.

## Stack

MERN + TypeScript (strict) + Tailwind CSS v4: MongoDB (Mongoose), Express 5, React 19 (Vite 7), Node 22. Monorepo with npm workspaces + Turborepo. Optional Redis (ioredis + BullMQ) for cache, queue and rate limits; without it everything runs in memory.

## Structure

```
apps/
  api/       Express API (MVC: models/, routes/, services/, middleware/, config/, utils/).
             Also serves the built catalogue (/) and admin (/admin), so cookies are same-origin.
  web/       Public catalogue (pages/, components/, context/)
  admin/     Admin panel: Overview, Components, Editor, Privileges, Feature radar
  preview/   Sandboxed renderer on its own origin; compiles component TSX in the browser
packages/
  core/      Pure rules: bundle validation, access decision, registry/copy/prompt builder
  ui/        26 CRM components, theme, examples, registry manifests, thumbnails
  client/    Shared frontend: PreviewFrame, CopyButton, CodeBlock, api()
  cli/       Zero-dependency installer, served as /cli/kitbase.tgz
  redis/ cache/ queue/ rate-limit/   Optional infrastructure (Redis or in-memory)
plugins/
  feature-radar/  Search-driven feature requests + AI draft builder
examples/    Clean consumer apps built from the CLI, from Copy code, and by an AI agent
docs/        Reference captures, tokens, component inventory, comparison, bundle format
scripts/     Capture, screenshot and preview-check tools
```

## How it works

1. The admin uploads a JSON bundle ([docs/bundle-format.md](docs/bundle-format.md)). `validateBundle()` checks schema, safe paths, allowed imports, declared dependencies and sizes, and saves a **draft**.
2. **Publish** copies the draft into an immutable `published` snapshot. Preview, Copy code, the installer and the agent prompt all read that one snapshot.
3. Every protected request runs `decideAccess()` with the customer loaded fresh from the database (cookie or `Bearer` token), so revoking access applies on the next request.
4. Published documents are cached for 60 s; every admin write clears the cache. The access decision is never cached.

## Local setup

Requires Node 22 and MongoDB (local or Atlas). Redis is optional.

```bash
npm install
cp .env.example .env   # set MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD, seed passwords
npm run seed           # 2 test customers + 26 components (3 premium demo fixtures)
npm run dev            # API :4000, catalogue :5183, admin :5184, preview :5185
```

| Command         | What it does                                           |
| --------------- | ------------------------------------------------------ |
| `npm run check` | Prettier, ESLint, typecheck (all workspaces), tests    |
| `npm test`      | Unit tests                                             |
| `npm run build` | Build all apps and the CLI tarball (Turborepo, cached) |
| `npm run seed`  | Load the test customers and components                 |

All environment variables are listed in [.env.example](.env.example). Secrets live only in `.env` (git-ignored) and the hosting dashboard.

## Using components

In a React + TypeScript + Tailwind v4 project with an `@/` alias to `src`:

```bash
npx --yes <site>/cli/kitbase.tgz add data-table
npm install <printed dependencies>
```

Then start the main CSS with the three printed lines (Geist font import, `@import "tailwindcss";`, then the theme). The installer writes only inside `src/`, rejects unsafe paths, never overwrites a changed file without `--overwrite` (exit code 2), and prints dependencies instead of running commands. Options: `--src`, `--dry-run`, `--api`.

**Premium:** the admin grants Premium (no payments, no self-upgrade). The customer creates a token on the **Account** page and sets `KITBASE_TOKEN` in the shell; the token is stored only as a sha256 hash. Signed-out requests get 401, free accounts 403. Revocation blocks the next request; code already installed stays in the consumer's project.

## Admin

- **Components:** upload, validate, preview the draft, publish/unpublish, switch free/premium (applies to the live snapshot at once), delete.
- **Privileges:** grant/revoke Premium and Block/Unblock customers. A blocked customer cannot sign in, and their tokens and sessions stop working immediately.
- **Feature radar:** searches with no result become feature requests with real counts (hidden below 5). The admin marks them valid, rejected or building with an ETA, and users see "Coming soon". For building requests, **Generate with AI** runs in the queue (Gemini, then OpenRouter, then Ollama as fallbacks), must pass the same `validateBundle()` rules, and is saved **only as a draft**.

## Security

- **Sessions:** httpOnly, SameSite=strict cookies (Secure in production). A 15-minute access JWT plus a rotating 10-day refresh token (stored as sha256); reusing an old refresh token revokes the chain. Admin and customer use separate cookies and JWT audiences.
- **CSRF:** writes must come from a trusted `Origin`. Logins are rate-limited (sliding window); registry and search use a token bucket.
- **Premium code** lives only in MongoDB behind access-checked routes, with `Cache-Control: no-store`.
- **Preview isolation:** a separate origin, `<iframe sandbox="allow-scripts">` (opaque origin: no cookies, storage or parent access), code sent by postMessage with origin checks, and CSP `connect-src 'none'`. See `docs/reference/isolation-probe.png`.
- **Known limits:** previews need `unsafe-eval`; a hostile preview can still burn CPU or draw misleading UI inside its own frame.

## Tests

`npm run check` is clean; **32 unit tests** pass.

| File                                                 | Covers                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `packages/cli/test/lib.test.ts`                      | unsafe paths, overwrite rules, arguments, bad responses |
| `plugins/feature-radar/src/server/normalize.test.ts` | term normalising, real counts only                      |
| `packages/cache/src/cache.test.ts`                   | TTL, invalidation, wrap, hit/miss                       |
| `packages/queue/src/queue.test.ts`                   | job status, failures, concurrency                       |

## Deployed checks (live, 2026-09-27)

| Check               | Result                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Health and pages    | `/api/health`, `/`, `/admin/`, `/cli/kitbase.tgz` return 200                                                              |
| Access, signed out  | free component: copy, prompt, preview, registry 200; premium: 401; admin API: 401                                         |
| Sign-in and Block   | admin, premium and free sign-in work; Block / Unblock works                                                               |
| Preview isolation   | renders from the separate origin with `sandbox="allow-scripts"` and the security headers                                  |
| Live CLI            | clean Vite app: `add` wrote files, `tsc` + `vite build` passed; premium without token refused; changed file kept (exit 2) |
| Redis               | `redis connected`; the "catalog cache miss" log appears once per key, repeats are served from Redis                       |
| Persistence         | after a redeploy all components and premium flags were still there                                                        |
| Keyboard and mobile | focus visible, Ctrl+K search with arrows/Enter/Esc, tabs by arrow keys; 375 px with no horizontal scroll                  |

Journeys A (upload and publish `examples/demo-bundles/pipeline-health.json`) and B (grant/revoke Premium on a new component) passed end to end against a local server and Atlas.

## Component inventory

43 UI patterns from the reference CRM ([docs/reference/component-inventory.md](docs/reference/component-inventory.md)), grouped into 26 components with variants inside each. Reference vs recreation: [docs/comparison.md](docs/comparison.md).

## Deploy

Render (free plan, manual deploys, no CI/CD): a Node web service (API + catalogue + admin, health check `/api/health`), a static site for the preview (headers `Access-Control-Allow-Origin: *`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`), a Key Value (Redis) instance, and MongoDB Atlas. [render.yaml](render.yaml) describes the same setup. `KEEP_ALIVE_MINUTES=13` keeps the free instance awake.

Recovery: unpublish or re-publish a previous version; roll back a deploy in Render (data lives in Atlas); rotate `JWT_SECRET` and `ADMIN_PASSWORD` if a secret leaks.

## AI tool usage

- **Tool:** Claude Code.
- **Corrected suggestion:** the first plan used the shadcn CLI as the installer; it was replaced with our own small CLI so unsafe paths, overwrite rules and token auth are fully controlled and tested.
- **Another correction:** Vitest 2 hoisted Vite 5 and broke the Vite 7 types; fixed by moving to Vitest 3.
- **Agent test:** an AI agent followed the Copy prompt in `examples/consumer-agent` and succeeded ([RESULT.md](examples/consumer-agent/RESULT.md)); it found a CSS import-order bug, now fixed.

## Gaps

- Deploys are manual; there is no CI/CD pipeline.
- Free plan cold starts are reduced by the keep-alive ping, not removed.
- End-to-end behaviour is verified on the live site rather than by automated browser tests.

Time spent: about 6 hours.
