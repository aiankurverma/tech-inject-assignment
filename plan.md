# Kitbase — Plan (Tech Inject assignment)

## Goal

Recreate **every reusable component** from the Sales CRM reference as a themed React + TypeScript library. Serve it through a public catalogue (browse, preview, copy, install, agent prompt) and an admin panel (upload, publish, free/premium, grant/revoke access), with the server enforcing access on every request.

## References

| What                               | URL                                        | Use it for                                                             |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Sales CRM (visual source of truth) | https://sales-crm-kargulstudio.vercel.app/ | Component look: colours, fonts, radii, spacing, icons, states          |
| Astryx by Meta                     | https://astryx.atmeta.com/ · /components   | How the catalogue works: discovery, docs, previews                     |
| shadcn/ui (our screenshots)        | https://ui.shadcn.com                      | Catalogue shell style: black & white, top nav, sidebar, "On this page" |

**Rule:** the components wear the CRM theme. Only the catalogue website is black & white. We never copy Astryx or shadcn styling into the components.

## Stack — MERN + TypeScript + Tailwind CSS only

- **MongoDB + Express + React + Node**, TypeScript `strict: true` everywhere
- **Styling: Tailwind CSS only** (no other CSS frameworks or CSS-in-JS)
- **npm workspaces** monorepo (Turborepo/pnpm dropped: not needed at this size)
- One Express server serves `/api`, the catalogue (`/`) and admin (`/admin`) → same-origin cookies
- Installer: own zero-dependency CLI served as a tarball (`npx <site>/cli/kitbase.tgz add <slug>`) — replaces the shadcn CLI idea below
- `apps/api` — Express + TypeScript REST API (auth, admin writes, access checks, registry, file serving)
- `apps/web` — public catalogue (React + Vite + TS + Tailwind)
- `apps/admin` — admin dashboard (React + Vite + TS + Tailwind)
- `apps/preview` — isolated preview renderer on a **separate domain**, sandboxed iframe, no cookies or secrets
- `packages/tokens` — CRM design tokens (CSS variables + Tailwind preset), single source for every component
- `packages/ui` — all CRM components (Tailwind; headless Radix primitives where useful)
- `packages/core` — shared types, Zod schemas, access rules, registry builder
- **DB:** MongoDB Atlas + Mongoose
- **File storage:** private, served only through the API (MongoDB GridFS)
- **Auth:** JWT in httpOnly cookies for customers; single admin from env variables; separate cookies
- **Installer:** shadcn-compatible registry — `npx shadcn@latest add https://<api>/r/<slug>.json`; premium via token header from the user's own env (ref: https://github.com/shadcn-ui/ui)
- **Hosting:** frontends on Vercel, API on Render/Railway, MongoDB Atlas
- **Quality:** Prettier, ESLint, `tsc --noEmit`, Vitest, Playwright

## Phases

### Phase 0 — Reference capture

- Screenshot every CRM screen (desktop + mobile) at fixed sizes, store in `docs/reference/`
- Extract tokens: colours, font family/sizes/weights, radii, borders, shadows, spacing scale, icon set
- Write the full component inventory (components, variants, states, mapped to screenshots)

### Phase 1 — Foundation

- Monorepo, lint/format/typecheck/test scripts
- DB schema, storage bucket, env handling, logging
- Deploy empty apps early to confirm HTTPS + env setup

### Phase 2 — Component library (all components)

- Build every component in the inventory with typed props, realistic sample data, hover/focus/selected/disabled states, keyboard support
- Group related variants into one component (e.g. button sizes/intents) instead of duplicates
- Side-by-side reference vs recreation screenshots for each

### Phase 3 — Public catalogue

- Home, Get Started (consumer setup), searchable sidebar, one page per published component
- Component page: preview/code tabs, variants, props table, Copy Code, Copy Install, Copy Agent Prompt, copy success/error feedback
- Locked states for premium (static thumbnail + how to get access)
- Customer sign-in/out, visible Free/Premium badge, mobile layout

### Phase 4 — Admin dashboard

- Admin login (server-verified)
- List, create/edit draft, upload JSON bundle (source, supporting files, preview data, metadata)
- Validate → preview → publish / unpublish
- Customers list, grant / revoke premium, create CLI tokens

### Phase 5 — Registry, access & installer

- Registry endpoint builds shadcn JSON from the **same stored version** used by preview, code and prompt
- Access check on every protected request: published? + free or active premium?
- Personal tokens (hashed) for CLI/agent; no secrets inside copied commands or prompts
- Seed free sample components in repo; premium test component uploaded only at runtime

### Phase 6 — Preview isolation

- Preview app on its own origin, `sandbox="allow-scripts"` (no same-origin), strict CSP, no app credentials
- Restricted bundle format: only allowed imports (React, tokens, listed deps)

### Phase 7 — Testing

- Automated: admin write protection, drafts hidden, valid/invalid uploads, source consistency, installer success, unsafe paths/overwrite, free/premium/revoked via API + installer, self-upgrade attempts
- Manual/recorded: interactions, keyboard, mobile, visual comparison, restart persistence

### Phase 8 — Consumer verification

- `examples/consumer-copy`, `examples/consumer-cli`, `examples/consumer-agent` — fresh Vite/Next React+TS apps; each must build and render

### Phase 9 — Docs & submission

- README (links, setup, env names, screenshots, test results, recovery plan, premium usage)
- answers.md (7 questions, based on real decisions)
- Record deployed commit hash

## Progress tracking
