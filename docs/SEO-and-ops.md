# SEO, security, caching and demand operations

This runbook covers the public site (`https://kitbaseapp.site`), the crawler/agent files, the
security posture, and the demand-driven component pipeline. It is written so an operator can
verify the system without reading the source.

## 1. Canonical host and environment

| Variable              | Purpose                                                                          | Example                                |
| --------------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| `PUBLIC_ORIGIN`       | Origin used by the API and previews                                              | `https://kitbaseapp.site`              |
| `CANONICAL_ORIGIN`    | Canonical host for metadata, sitemap and OG URLs. Falls back to `PUBLIC_ORIGIN`. | `https://kitbaseapp.site`              |
| `PREVIEW_ORIGIN`      | Sandboxed preview renderer                                                       | `https://kitbase-preview.onrender.com` |
| `VITE_PARENT_ORIGINS` | Extra parent origins allowed to embed previews                                   | `https://www.kitbaseapp.site`          |
| `CF_ANALYTICS_TOKEN`  | Cloudflare Web Analytics token (public). Empty disables the beacon.              | `abc123...`                            |

In production, `http://` and `https://www.` requests for public pages are redirected `301` to
`CANONICAL_ORIGIN`. API and non-GET traffic is not redirected.

## 2. Server-rendered HTML

Every public route returns real HTML before React boots. The built `apps/web/dist/index.html` is
used as the template; the API replaces the marked block:

```
<!--seo:start--> ... <!--seo:end-->
```

and the body inside `<div id="root">`. The SPA then hydrates/replaces the static body. If the API
cannot read the built HTML it still returns a small, valid document; it never returns an empty
root with a 200.

Covered routes: `/`, `/components`, `/components/category/:slug`, `/components/:slug`,
`/docs/get-started`, `/screens`, `/requests`, `/changelog`, `/theme`, `/builder`. Private routes
(`/sign-in`, `/sign-up`, `/account`, `/join`, `/teams/*`) are rendered with `noindex`.

Each public page includes a unique title, description, canonical URL, Open Graph and Twitter
tags, a 1200×630 image, breadcrumbs and JSON-LD (`SoftwareSourceCode`/`SoftwareApplication`).
The homepage title and description are fixed:

- Title: `Kitbase – CRM React Components You Can Copy, Install or Give to AI Agents`
- Description: `Open-source CRM-themed React components: pipelines, contact tables, activity feeds and more. Copy the code, install via CLI, or hand them to your AI agent.`

Unknown public paths return a real `404` with an HTML body. Unknown `/api/*` paths return a JSON 404. Missing hashed assets return a plain-text 404, never the SPA shell.

## 3. Crawler and agent files

| Path             | Source                                            | Cache                  |
| ---------------- | ------------------------------------------------- | ---------------------- |
| `/robots.txt`    | Static rules, generated from `CANONICAL_ORIGIN`   | `public, max-age=3600` |
| `/sitemap.xml`   | Published components, categories and public pages | `public, max-age=3600` |
| `/llms.txt`      | Compact catalogue summary for AI agents           | `public, max-age=3600` |
| `/registry.json` | shadcn-compatible registry index                  | `public, max-age=300`  |
| `/r/:slug.json`  | Per-component registry item                       | `public, max-age=300`  |

Publishing a component invalidates the catalogue cache, so these files update within one cache
TTL (60 seconds for the catalogue, 5–60 minutes for the files themselves).

## 4. Caching policy

| Response                                   | Header                                                            | Reason                                           |
| ------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| `/assets/*` (hashed)                       | `public, max-age=31536000, immutable`                             | Filename changes on every build                  |
| Public HTML                                | `no-cache`                                                        | New components must appear immediately           |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | `public, max-age=3600`                                            | Cheap to regenerate, rarely changes              |
| `/registry.json`, `/r/*.json`              | `public, max-age=300`                                             | Allow quick updates after publish                |
| `GET /api/components`                      | `public, max-age=300, stale-while-revalidate=600`, `Vary: Cookie` | Catalogue is public; cookie varies premium flags |
| `/api/auth/me`                             | `private, no-store`                                               | Per-user session data                            |
| `/api/health`                              | `no-store`                                                        | Uptime probes must always hit the app            |
| Other `/api/*`                             | `no-store`                                                        | Never cache mutations or private data            |
| Public HTML error pages                    | `no-store`                                                        | Do not cache 404s                                |

## 5. Security posture

- Helmet CSP: `default-src 'self'`, no `unsafe-eval`, frames only from `PREVIEW_ORIGIN`,
  Cloudflare analytics beacon allowed, `frame-ancestors 'none'`.
- `Permissions-Policy` disables camera, microphone, geolocation, payment, USB and interest
  cohorts. `X-Content-Type-Options: nosniff` is set globally.
- Scanner paths are rejected before routing or database access. The pattern covers `.env`,
  `.git`, `wp-*`, `xmlrpc`, `META-INF`, `phpinfo`, `phpmyadmin`, `.aws`, `.ssh`, `cgi-bin`,
  `.DS_Store`, `/vendor/`, `gcp-key`, path traversal and `/data:` URLs. They return a tiny
  plain-text 404.
- Rate limits: global API token bucket (600 capacity, 5/s refill), stricter limits on login,
  search signals, request writes, admin writes, previews and captures.
- Cookie-authenticated writes require a same-origin request (CSRF defence on top of
  `SameSite=strict`).
- Secrets stay in environment variables. The repository must never contain `.env`, tokens or
  keys. Logs redact credentials and never print full request bodies.

## 6. Demand pipeline

### Flow

```
on-site search / request board / GSC CSV
        ↓
DemandSignal (anonymous, normalised)
        ↓ scan + cluster
DemandOpportunity (evidence, score, decision)
        ↓ human decision: build
ComponentRequest (public board: Requested → Building)
        ↓ AI draft (feature-radar queue)
Component draft + QualityReport (pass/fail/manual)
        ↓ human confirms manual checks + approves
Publish (kill switch off, daily batch limit)
        ↓
Public component page + sitemap + registry + llms.txt
        ↓
ComponentRequest → Live; opt-in notification rows (pending)
```

### Admin UI

`/admin/demand` has six views:

1. **Opportunities** — evidence, score, reasons, AI build state, quality report, actions.
2. **Requests** — public board with votes, status and credit.
3. **Signals** — every anonymous query/impression source.
4. **Quality** — reports with manual checks that must be confirmed.
5. **Email** — pending opt-in notifications. Marking one sent does **not** send email.
6. **Audit** — every decision and publish.

Safety settings live on the same page: kill switch, auto-build, auto-publish, build/vote
thresholds and the daily publish cap. Auto-publish is off by default. Even when on, a draft must
still have a passing quality report.

### Quality gates

Automatic: bundle validation, TypeScript/TSX syntax (esbuild), no `eval`/`new Function`/remote
code/secrets, title length, description length, H1, documented props, at least two examples, at
least three related components, and copy uniqueness against published pages.

Manual: accessibility (axe + keyboard), responsive checks at 375/768/1280 px, and the preview
performance budget. These block publishing until a human confirms them in the Quality view.

### Weekly report

`POST /api/admin/demand/report` writes `reports/demand-YYYY-MM-DD.md`. The file is ignored by git;
the admin UI shows the same markdown. The report covers new signals, ranked opportunities,
requests, quality reports, published components, GSC follow-ups and rejection reasons.

### GSC import

Paste the **Queries** CSV from Search Console into the import card. Required column: `Top
queries` or `Query`; optional: `Clicks`, `Impressions`. Page-level GSC data is not imported yet,
so do not make CTR decisions from this data alone.

### Notification policy

Notifications are recorded as `pending` only. Sending email is a separate, explicit decision and
is not implemented in this repository. Never send to an address unless the requester opted in
(`notifyOptIn`) and is signed in.

## 7. Verification commands

Run from the repository root after a build:

```powershell
# HTML is real, not an empty root
curl.exe -s https://kitbaseapp.site/ | Select-String "seo:start|<h1|application/ld"
curl.exe -s https://kitbaseapp.site/components | Select-String "<title>|canonical"

# Crawler files
curl.exe -s https://kitbaseapp.site/robots.txt
curl.exe -s https://kitbaseapp.site/sitemap.xml
curl.exe -s https://kitbaseapp.site/llms.txt
curl.exe -s https://kitbaseapp.site/registry.json

# Caching
curl.exe -sI https://kitbaseapp.site/assets/<hash>.js | Select-String "cache-control"
curl.exe -sI https://kitbaseapp.site/robots.txt | Select-String "cache-control"
curl.exe -sI https://kitbaseapp.site/api/health | Select-String "cache-control"

# Security
curl.exe -sI https://kitbaseapp.site/.env
curl.exe -sI https://kitbaseapp.site/gcp-key.json
curl.exe -sI https://kitbaseapp.site/wp-json/batch/v1
curl.exe -s -o NUL -w "%{http_code}" https://kitbaseapp.site/nonexistent-page

# Canonical redirects (production)
curl.exe -sI https://www.kitbaseapp.site/ | Select-String "301|location"
```

Expected: scanner paths return `404` plain text; unknown pages return `404` HTML; `/api/health`
returns `{"ok":true}` with `no-store`; hashed assets are `immutable`; HTML is `no-cache`.

## 8. Cloudflare manual steps

These cannot be automated from the repository:

1. **DNS / proxy** — keep `kitbaseapp.site` and `www` proxied through Cloudflare. The app already
   redirects `www` and HTTP to the canonical origin.
2. **Web Analytics** — create a Web Analytics site in the Cloudflare dashboard, copy the beacon
   token into `CF_ANALYTICS_TOKEN` on Render, and redeploy. The beacon is cookieless.
3. **Cache rules** — optionally add a Cloudflare cache rule for `/assets/*` with “Eligible for
   cache” and a long edge TTL. Origin headers already do the right thing.
4. **Bot protection** — enable “Bot Fight Mode” or a managed WAF rule for scanner paths. The app
   already blocks them at the origin; edge blocking saves bandwidth.
5. **Search Console** — verify the domain, submit `https://kitbaseapp.site/sitemap.xml`, and
   export the Queries CSV weekly for import.

## 9. Scalability notes

- Search signals are one upsert per query, keyed by `(source, normalizedQuery)`.
- Scans load signals once, cluster in memory and use the cached published catalogue; matching no
  longer performs a database read per cluster.
- Reviewed opportunities are locked: a later scan updates evidence but cannot reset a human
  decision or re-open a rejected idea.
- Publishing reserves its daily batch slot atomically, so concurrent admin clicks cannot exceed
  the cap. Notifications have a unique `(requestId, componentSlug)` index.
- Public request and signal endpoints are capped (`limit(100)`/`limit(200)`); add cursor
  pagination before these grow beyond a few thousand rows.
- The catalogue cache is shared (Redis in production, in-memory in development) and is
  invalidated on publish. Static files are cheap and independently cacheable.
