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

- `tests/e2e/server.ts` on http://localhost:4100 (API + built catalogue and admin),
- `vite preview` for `apps/preview` on http://localhost:5185 (the sandboxed preview origin).

The first run downloads a MongoDB binary (~70 MB) into `~/.cache/mongodb-binaries`.

Useful flags: `npm run test:e2e -- --ui`, `npm run test:e2e -- --headed`,
`npx playwright show-report` after a failure.

## Coverage

- `catalogue.spec.ts`: catalogue list, search dialog, component page with live preview,
  copy code, premium lock for a signed-out visitor (UI and API).
- `admin.spec.ts`: admin sign-in and publishing a draft into the catalogue.
