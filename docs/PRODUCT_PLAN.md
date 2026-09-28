# Kitbase — Public Product Plan

From an assignment project to a public platform: **capture any interface, turn it into a themed, tested component library, and install it anywhere with one command.**

---

## 1. The problem

| Who                      | Pain today                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Startups / product teams | Rebuild the same UI (tables, forms, dashboards) in every project; weeks lost per app |
| Agencies                 | Recreate a client's existing brand/UI from screenshots by hand                       |
| Solo devs / students     | Free kits look generic; premium kits are locked to one framework and hard to theme   |
| Enterprises              | Design system drifts: Figma, code and docs disagree; no single source of truth       |
| AI-first builders        | AI tools generate UI fast but inconsistent, unsafe to paste, not matching the brand  |

**Core insight:** the slow part is not writing a button — it is _capturing a look, keeping it consistent, and getting it safely into many codebases_. Kitbase automates that whole loop.

## 2. Vision and positioning

> **"Capture → Generate → Validate → Publish → Install."**
> Point Kitbase at a website, screenshot or Figma file. It extracts the design tokens and components, generates clean themed React code, tests it, and ships it as an installable library your team (and your AI agents) can use.

- Like **shadcn/ui** (copy-in, you own the code) + **Emergent/v0-style AI generation** + a **private registry** for teams.
- Differentiator: **capture engine + safety pipeline + one source of truth** for preview, copy, CLI and AI agents.

## 3. Product pillars

1. **Capture Engine** — extract design from anything.
2. **AI Generation Studio** — turn captures/prompts into components.
3. **Quality Gate** — validation, sandbox preview, visual/a11y tests.
4. **Registry & Distribution** — catalogue, CLI, copy, agent prompts, versions.
5. **Team Platform** — workspaces, roles, billing, analytics.
6. **Ecosystem** — multi-framework, plugins, marketplace.

---

## 4. Pillar 1 — Capture Engine (the flagship "capture everything" core)

**Flow:** input → headless browser → extract → normalise → review → theme + component drafts.

| Input                  | What it extracts                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Public URL             | Screenshots of every state (hover, focus, menus, dialogs, mobile), DOM, computed CSS |
| Logged-in app (opt-in) | Same, via a recorded session in an isolated browser                                  |
| Screenshot / image     | Layout, colours, typography via vision model                                         |
| Figma file             | Variables, styles, components via Figma API                                          |
| Existing codebase      | Scan React/Vue components and CSS to import an existing design system                |

**Extraction outputs**

- **Design tokens:** colours, typography scale, spacing, radius, shadows, motion → `theme.css` + JSON tokens.
- **Component inventory:** detected UI patterns (buttons, tables, cards…) grouped with variants and states.
- **Screens map:** which component appears where (for docs and visual tests).

**Safety:** captures run in isolated browsers; respect robots/ToS; users confirm they own or may use the design; no credential storage (session recorded only in the sandbox, then discarded).

---

## 5. Pillar 2 — AI Generation Studio

| Feature                 | Detail                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Screenshot → component  | Upload/crop a region; AI writes TSX using the captured theme tokens                    |
| Prompt → component      | "Pricing table with 3 tiers" in your theme                                             |
| Variant generator       | Generate sizes, states (loading/empty/error), dark mode, RTL                           |
| Refine loop             | Chat edits: "make it denser", "add sorting"; diff view                                 |
| Multi-provider fallback | Existing chain (Gemini → OpenRouter → Ollama), cost + latency aware routing            |
| Always a draft          | Nothing is published without passing the Quality Gate and a human (or policy) approval |

Builds on the existing feature-radar builder, queue and `validateBundle()`.

---

## 6. Pillar 3 — Quality Gate (what makes it production-grade)

1. **Static validation** (exists): schema, safe paths, import allow-list, declared deps, size limits.
2. **Type check + lint** of the bundle in a worker.
3. **Sandbox preview** (exists): separate origin, sandboxed iframe, CSP `connect-src 'none'`.
4. **Visual regression:** screenshot every variant, compare with the capture/reference and previous version.
5. **Accessibility:** axe checks, keyboard navigation, contrast, focus visible.
6. **Consumer build test:** install into a clean Vite/Next app and build (like `examples/consumer-*`, automated).
7. **Security scan:** no network calls, no `eval` in shipped code, dependency vulnerability check.
8. **Scorecard:** each component gets a quality score shown in the catalogue.

---

## 7. Pillar 4 — Registry and distribution

- **Catalogue:** search, filters (category, framework, free/premium, quality score), live previews, props docs.
- **Install options:** CLI (`npx kitbase add`), Copy code, AI agent prompt, **MCP server** so AI IDEs can install components directly.
- **Versioning:** semver per component, changelog, `kitbase diff` / `kitbase update` with safe 3-way merge for edited files.
- **Private registries:** each team gets its own registry URL and tokens.
- **Multi-framework output:** React (now) → Vue, Svelte, React Native, plain HTML/Tailwind.
- **Theme switcher:** same components, many themes; export tokens to Figma variables.

---

## 8. Pillar 5 — Team platform

- Workspaces, members, roles (owner, admin, editor, viewer), SSO (Google/GitHub/SAML).
- Approval workflows (draft → review → publish), comments, audit log.
- Usage analytics: installs per component, most searched, unused components.
- Billing: Stripe plans and seats; premium component entitlements (exists as premium access).
- Notifications: Slack/email on publish, failed build, new request.

## 9. Pillar 6 — Ecosystem

- Public marketplace: creators publish kits, revenue share.
- Plugin API (feature-radar is already a plugin): capture sources, generators, exporters.
- Integrations: GitHub PR bot (opens a PR with installed/updated components), Figma plugin, VS Code extension.

---

## 10. Reaching 1000+ components (the right way)

Not 1000 hand-written files — a **matrix + generator + quality gate**:

| Layer               | Count target | How                                                                   |
| ------------------- | ------------ | --------------------------------------------------------------------- |
| Primitives          | ~60          | Buttons, inputs, selects, dialogs, tabs… (hand-crafted, gold quality) |
| Composites          | ~250         | Tables, forms, cards, navs, charts, pickers                           |
| Blocks / sections   | ~400         | Dashboards, pricing, auth screens, settings, CRM/HR/finance screens   |
| Industry templates  | ~300         | CRM, e-commerce, SaaS admin, healthcare, edu, fintech pages           |
| **Total per theme** | **~1000+**   | × every captured theme and framework                                  |

**Pipeline:** taxonomy of components → generate in batches with AI using gold primitives → Quality Gate → human review sample → publish. Track quality score; retire low scorers.

---

## 11. The 100+ feature backlog (grouped)

**Capture (15):** URL capture, multi-state capture, mobile capture, logged-in capture, screenshot input, Figma import, codebase import, token extraction, typography scale detection, colour palette clustering, spacing scale detection, component detection, screens map, capture diff over time, capture scheduling.

**AI studio (15):** screenshot→component, prompt→component, variant generator, dark mode generator, RTL generator, state generator, refine chat, diff view, provider routing, cost limits, prompt library, brand voice for copy, image-to-layout, accessibility auto-fix, AI code review.

**Quality (15):** static validation, type check, lint, sandbox preview, visual regression, a11y audit, keyboard test, contrast check, consumer build test, bundle size budget, performance budget, security scan, dependency audit, quality scorecard, flaky-check reruns.

**Registry (15):** search, filters, tags, props docs auto-gen, live playground, versioning, changelog, deprecations, update command, diff command, 3-way merge, private registries, per-team tokens, download stats, dependency graph.

**Distribution (10):** CLI add/update/diff/remove, copy code, agent prompt, MCP server, VS Code extension, Figma plugin, GitHub PR bot, npm package export, Storybook export, zip download.

**Frameworks & themes (10):** Vue output, Svelte output, React Native output, HTML/Tailwind output, Next.js presets, theme switcher, multi-brand themes, token export to Figma, CSS variables export, Tailwind preset export.

**Team (15):** workspaces, roles, SSO, invites, approvals, comments, audit log, activity feed, Slack alerts, email alerts, usage analytics, unused component report, request board (feature radar), roadmap view, SLA dashboard.

**Business (10):** Stripe billing, seats, plans, trials, coupons, invoices, usage-based AI credits, marketplace payouts, license keys, enterprise contracts.

**Platform/infra (10):** multi-region deploy, CDN for previews, job workers autoscale, object storage for captures, backups, observability (logs/metrics/traces), rate limits per plan, abuse detection, GDPR export/delete, status page.

---

## 12. Architecture evolution

| Now (assignment)                      | Public platform                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| One Express monolith + static preview | Modular monolith first; split **workers** (capture, AI, quality) into services |
| MongoDB Atlas                         | MongoDB (catalog) + object storage (S3/R2) for screenshots and bundles         |
| Redis cache/queue/limits              | Redis + BullMQ with dedicated worker fleets (headless browsers)                |
| Render free                           | Container platform (Fly/Render paid/AWS ECS), autoscaling workers              |
| Manual deploys, no CI                 | CI (lint/type/test), preview deploys per PR, staged rollout                    |
| Single admin                          | Multi-tenant workspaces, RBAC, SSO                                             |
| Unit tests + live checks              | Unit + integration + Playwright e2e + visual regression                        |

Keep what works: `core` rules, sandbox preview, single published snapshot, CLI safety model, plugin boundaries.

---

## 13. Phased roadmap

| Phase          | Time    | Goal                                                                                  |
| -------------- | ------- | ------------------------------------------------------------------------------------- |
| 0. Harden      | 2 weeks | CI, e2e tests, object storage, observability, paid hosting, restore integration tests |
| 1. Capture MVP | 4 weeks | URL capture → tokens + inventory → theme; screenshot → component draft                |
| 2. Quality     | 4 weeks | Visual regression, a11y, consumer build test, scorecards                              |
| 3. Scale lib   | 6 weeks | Taxonomy + generator pipeline to ~300 components, 3 themes                            |
| 4. Teams       | 6 weeks | Workspaces, roles, private registries, Stripe billing, analytics                      |
| 5. Distribute  | 4 weeks | CLI update/diff, MCP server, GitHub PR bot, VS Code extension                         |
| 6. Ecosystem   | ongoing | Vue/Svelte output, Figma plugin, marketplace, 1000+ components                        |

## 14. Business model

- **Free:** public components, CLI, 1 captured theme, limited AI credits.
- **Pro (individual):** premium components, unlimited themes, more AI credits.
- **Team:** private registry, roles, approvals, analytics, per-seat pricing.
- **Enterprise:** SSO/SAML, audit, on-prem/VPC, SLA.
- **Marketplace:** revenue share on creator kits.

## 15. Success metrics

- Time from "capture" to "first installed component" (target < 10 min).
- Weekly installs, active projects, components per project.
- Quality score average; % of AI drafts approved without edits.
- Retention (teams active after 8 weeks), paid conversion.

## 16. Risks and mitigations

| Risk                                  | Mitigation                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Copying someone else's design (legal) | Ownership confirmation, capture only for own/permitted sites, takedown flow |
| Low-quality AI output at scale        | Quality Gate, scorecards, human review sampling, gold primitives            |
| Unsafe code in user bundles           | Existing validation + sandbox + security scan; never execute server-side    |
| AI costs                              | Credits per plan, caching, cheaper models for variants                      |
| Browser-capture cost/abuse            | Queued workers, per-plan limits, abuse detection                            |

---

**First concrete step after the interview:** Phase 0 hardening, then build **URL Capture MVP** on top of `scripts/capture-crm.mjs` + the feature-radar AI builder.
