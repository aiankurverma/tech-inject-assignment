# Kitbase v2 plan — Studio, notifications, AI

Status as of 2026-10-02 (audit of `main` merged into `chore/remove-premium-seed`).

## Where we are

| Area                 | Works today                                                                                                                 | Missing                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder (`/builder`) | Drag/drop sections, rows, columns, components; props panel; undo/redo; export `.tsx` + install cmd; premium lock in palette | Save to server, share link, JSON import (`store.load()` unused), AI, mobile layout (needs ~660px), e2e tests. **Live preview stuck on "Compiling…" locally — verify first.** |
| Screens (`/screens`) | One prompt → AI page tree → preview / code / JSON / install; premium-aware; rate-limited                                    | Multi-turn refine, history, save/share, open in Builder (different tree format), download, empty-deps bug (`npm install ` with nothing)                                      |
| Theme (`/theme`)     | Presets, OKLCH scales, contrast auto-fix, 6 export formats, `#t=` share link; feeds Builder + Screens preview               | Server save, AI theme, theme not applied to exported code                                                                                                                    |
| Feature radar        | Search miss → request → clusters → Mark building → AI draft → admin publishes                                               | Notice only in search dialog (not Home search); nobody is told when it goes live                                                                                             |
| Notifications        | **Nothing exists**                                                                                                          | Whole service                                                                                                                                                                |

## Phase A — make it fully working (P0, ~1–2 days)

1. Fix Builder live preview hang (preview app 5185 + compile path); add a timeout + error state instead of infinite "Compiling".
2. Fix turbo `dev` hang for api (works standalone; `tsx watch` silent under turbo).
3. Screens: hide `npm install` line when no deps; auto-height preview iframe; move explainer above prompt.
4. `ComingSoonNotice` on Home search too.
5. `scripts/check-previews.mjs` still uses removed `SEED_PREMIUM_*` → `NEW_PREMIUM_*`.
6. Smoke e2e (Playwright): builder add+export, screens generate (mock AI), theme export.

## Phase B — one "Studio" instead of three islands (~3–4 days)

Nav stays Builder · Screens · Theme, but they share one project:

1. **Project model (Mongo)**: `{ owner, team?, name, tree: BuilderNode, theme, visibility: private|unlisted|public, versions[] }`. Anonymous keeps localStorage; sign-in to save.
2. **Converter** `PageNode ⇄ BuilderNode` in `packages/core/page-tree.ts` → "Open in Builder" button on Screens result.
3. **Share link** `/p/:id` (read-only render + "Remix" button). Theme applied.
4. **Export with theme**: Builder/Screens export includes the Theme Studio CSS, not only `crm-theme.css`.
5. **Download zip** (Page.tsx + components + theme.css + package.json deps).
6. Team projects reuse existing team workspace scopes (`teamScoped.ts`).

## Phase C — notification service (~3 days)

New `apps/api/src/services/notify` + `Notification` model + `NotificationPref` model.

Channels:

- **In-app**: bell in web + admin header; `GET /api/notifications`, `PATCH /:id/read`, live via **SSE** `GET /api/notifications/stream` (Redis pub/sub when `REDIS_URL` set, in-memory otherwise — same pattern as cache/rate-limit).
- **Email**: via `@ti/queue` job → provider (Resend or SMTP via nodemailer), env `EMAIL_PROVIDER`, `EMAIL_FROM`. Digest option (daily) to avoid spam. One-click unsubscribe token.
- **Webhook** (teams, later): POST signed JSON to team URL.

Events:

| Event                                 | Who gets it                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Requested component goes live (radar) | Everyone who clicked **"Notify me"** on the coming-soon notice (new opt-in; anon gives email, signed-in one click) |
| Status → building, with ETA           | Same subscribers                                                                                                   |
| AI draft done / failed                | Admins                                                                                                             |
| Premium granted / revoked             | That user                                                                                                          |
| Team invite / role change             | Invitee / member                                                                                                   |
| New + updated components (weekly)     | Users who opted in                                                                                                 |
| Shared project remixed / commented    | Project owner                                                                                                      |

Rules: preferences per event × channel; dedupe key per event; no counts faked (same honesty rule as radar).

## Phase D — AI features that create value (~5–7 days, pick order)

Ranked by value ÷ effort:

1. **Chat to screen (multi-turn)** — Screens becomes a conversation. Each turn sends history + current tree; AI returns a validated **patch** (add/remove/move/set-props) not a full rewrite, so edits are small and undoable. Works on Builder canvas too ("make this 3 columns", "add a filter bar above the table").
2. **Missing component → radar** — when the AI wants a component the catalogue lacks, it uses the closest one and files a feature request automatically. Conversation demand feeds the build loop: **talk → tree → gap → ticket → AI draft → publish → notify**. This is the emergent loop.
3. **Screenshot to screen** — upload an image of any UI; vision model maps it to a tree of our components. Strong public demo.
4. **Theme from prompt / brand** — "calm fintech, navy" or a website URL/logo → full Theme Studio theme, then contrast auto-fix runs.
5. **Realistic data fill** — AI fills props with believable CRM data (names, deals, amounts) for the whole page.
6. **Page review** — AI checks the built page: accessibility, contrast, empty/loading states, layout issues; one-click fixes as patches.
7. **Emergent templates** — mine saved public projects + Screens prompts for common component combos; propose them as templates for admin approval.
8. **Agents** — expose Studio over the existing `packages/mcp` server: Claude Code / Cursor can create and refine screens and pull the code.

## Public-readiness (do alongside)

- AI cost control: per-user daily quota (anon small, signed-in more, premium most), cheaper model for anon, cache identical prompts, show remaining quota.
- Abuse: prompt length caps (exist), moderation on public projects, report button.
- Gallery `/gallery` of public projects (sorted by remixes) — gives the product a reason to return.
- Mobile: Builder read-only + preview on phones; Screens chat works fully on mobile.
- Analytics: funnel try → sign-in → save → export (analytics service exists).

## Suggested order

A → C (small, unblocks "notify me" in radar) → B → D1 → D2 → D3/D4 → rest.
