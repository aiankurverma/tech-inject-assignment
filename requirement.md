# Requirements — Kitbase (Tech Inject "Design Theme Library" assignment)

Checklist taken from the assignment brief. Tick each when done and verified on the **deployed** app.

## R1. Component library (CRM theme)

- [x] Analyse the Sales CRM reference; decide components, groups, and variants (`docs/reference/component-inventory.md`)
- [x] Capture reference screenshots at the start (stable comparison) (`docs/reference/screens/`)
- [x] Extract reusable theme tokens (typography, colours, borders, radii, spacing, sizing, icons) (`docs/reference/tokens.md`)
- [x] Rebuild components from the observed UI (not screenshots, not an embedded copy)
- [x] Typed props, realistic sample data, working interactions
- [x] Hover, focus, selected, disabled states where applicable
- [x] Side-by-side reference vs recreation screenshots; explain differences
- [x] Recreate the theme, not the CRM business features
- [x] README inventory: components found, built, priority, mapping to screenshots, omissions

## R2. Public catalogue

- [x] Own identity; Astryx-style discovery; CRM-themed components; no Meta affiliation implied
- [x] Intro / Get Started page
- [x] Searchable component navigation
- [x] One page per published component
- [x] Working preview, variants/states, props and usage docs
- [x] **Copy code:** source + example usage + theme files, imports, dependency steps
- [x] **Copy install:** working `npx` command that adds component + required files to a separate project
- [x] **Copy agent prompt:** tells an AI agent how to add it, keep the theme, install deps, verify
- [x] Readable code blocks, preview/code controls, copy success/error feedback
- [x] Usable narrow-screen (mobile) layout
- [x] One documented React + TypeScript consumer setup
- [ ] `npx` command works on the reviewer's machine from deployed source (no localhost, no local files, no full clone)
- [x] Prerequisite setup documented

## R3. Admin and publishing

- [x] Admin app and write APIs protected by server-verified access
- [x] One admin from env variables; admin secret never in frontend
- [x] List components; create/edit draft
- [x] Upload source, supporting files, preview data (documented JSON bundle format)
- [x] Set name, unique slug, description, category, version, free/premium, props/usage, dependencies
- [x] Validate and preview draft; publish / unpublish
- [x] View customers; grant / revoke premium
- [x] Customer cannot change own access; premium ≠ admin
- [x] Records and files stored persistently
- [x] New published component appears with preview + all 3 options, **no redeploy or code edit**
- [x] Drafts private
- [x] Unpublish removes from listings, detail routes, and new install/source requests

## R4. Premium access

| Visitor            | Free component | Premium component                                |
| ------------------ | -------------- | ------------------------------------------------ |
| Signed out         | Full access    | Description + static thumbnail + sign-in message |
| Signed in, free    | Full access    | Locked, "premium required"                       |
| Signed in, premium | Full access    | Full access                                      |

- [x] Working sign-in / sign-out; visible Free/Premium status
- [x] Seed one free and one premium test account
- [x] No public signup / password recovery needed
- [x] Access granted/revoked by admin only; no payments, prices or fake checkout
- [x] Locked UI explains how to get access
- [x] Server checks current access on **every** preview, source, download, install and prompt request (incl. direct URLs)
- [x] Supporting files and premium deps also protected
- [x] Revocation blocks the next request even if still signed in
- [x] Documented authenticated path for premium CLI and agent use
- [x] No credentials in copied commands, prompts, public files or logs
- [x] Signed-out/free installer requests fail clearly
- [x] Premium uploads never in public bundle, open storage/cache, or Git
- [x] Static thumbnails for locked previews
- [x] Prove protection with a **newly uploaded** premium component not in the repo
- [x] Premium users never get drafts or unpublished content
- [x] Document: revocation can't undo code already copied/installed

## R5. Engineering

- [ ] Persistent data, protected admin, HTTPS, safe config, useful errors and logs
- [ ] Verify deployed release; document recovery steps
- [x] Preview, code, installer and prompt use the **same** published version
- [x] Upload validation: required fields, file types, sizes, dependencies
- [x] Never run uploaded code in backend or admin context
- [x] Isolated preview with no access to credentials (plain iframe ≠ secure)
- [x] Installer: writes only inside target folder, rejects unsafe paths, no silent overwrite, no component shell commands
- [ ] Keyboard-operable, labels, visible focus, loading/empty/error states

## R6. Code standards

- [x] Clean code; presentation, publishing rules, storage and install logic separated
- [ ] SOLID / DRY / KISS / YAGNI where useful, not for show
- [x] TypeScript `strict: true`; no unjustified `any`, unsafe casts or ignored errors
- [x] Runtime validation of uploads and API input; safe ORM queries; secrets out of code/logs
- [x] Formatting, linting, type checks and meaningful tests configured and run; real results in README
- [ ] Ready to explain 2 code-quality decisions + 1 avoided abstraction

## R7. Demo and tests

- [ ] Deployed flow A: upload new component → preview → publish → find publicly → use all 3 options
- [ ] Deployed flow B: publish premium → locked for free user → grant → full access → revoke → denied; free stays usable
- [x] Copy-paste and CLI verified in clean consumer projects (build + render)
- [x] Agent prompt used in clean project; result and corrections recorded
- [x] Automated tests:
  - [x] Unauthorised admin writes; public access to drafts/unpublished
  - [x] Valid publish; invalid upload rejected
  - [x] Metadata/source consistency; installer success
  - [x] Unsafe install paths; existing-file overwrite
  - [x] Free/premium/revoked via API, source and installer; self-grant and admin-action attempts
- [ ] Recorded: interaction, keyboard/mobile, visual comparison, consumer builds
- [ ] Deployed admin auth, publish/unpublish, persistence after restart/redeploy
- [x] Preview isolation checks and known limitations recorded

## R8. Deliverables

- [ ] Public Git repo (both apps, backend, installer, lockfiles, DB/storage setup, tests, consumer examples) + deployed commit
- [ ] Deployed public URL
- [ ] Deployed admin URL
- [ ] Test credentials (admin, free, premium) shared **privately** only
- [x] answers.md — all 7 questions, 2–4 sentences, real decisions
- [ ] README: links, setup/build/check commands, deploy steps, env variable names + example, screenshots, real results, time spent, gaps, AI tool + one prompt + one corrected suggestion, release checks, recovery plan, premium setup and usage
- [ ] Click "Mark Done" in the email and submit links in the form
