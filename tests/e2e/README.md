# End-to-end tests

Playwright specs that drive the real catalogue, admin and preview in Chromium.

The API runs in test mode against an **in-memory MongoDB** (`mongodb-memory-server`) with a
three-component seed (see `server.ts`). No `.env`, Redis or Atlas connection is needed, and
nothing is ever written to a real database.

## Run locally

```sh
npm ci
npx playwright install chromium   # once
npm run build                     # the API serves apps/web/dist and apps/admin/dist
npm run test:e2e
```

Playwright starts two servers itself (see `playwright.config.ts`):

- `tests/e2e/server.ts` on http://localhost:4000 (API + built catalogue and admin),
- `vite preview` for `apps/preview` on http://localhost:5185 (the sandboxed preview origin).

Stop any local dev API first: port 4000 is fixed because the preview build only accepts render
messages from its baked-in parent origins, and an existing server on that port is never reused.
Build without `VITE_PREVIEW_ORIGIN` / `VITE_PARENT_ORIGINS` set so the local defaults apply.

The first run downloads a MongoDB binary into `~/.cache/mongodb-binaries` (about 70 MB on
Linux, several hundred MB on Windows). If the server start times out on that first download,
run it again once the download has finished.

Useful flags: `npm run test:e2e -- --ui`, `npm run test:e2e -- --headed`,
`npx playwright show-report` after a failure.

## Coverage

- `catalogue.spec.ts`: catalogue list, search dialog, component page with live preview,
  copy code, premium lock for a signed-out visitor (UI and API).
- `admin.spec.ts`: admin sign-in and publishing a draft into the catalogue.
