# CRM Design Tokens (extracted 2026-09-24)

Source: live CSS of https://sales-crm-kargulstudio.vercel.app/ (`raw/crm.css`) + computed styles at 1440x900.
Reference app stack: Next.js, Tailwind v4, shadcn-style Radix primitives (`data-slot=...`), Geist font. **Dark theme only.**

## Colours (`:root`)

| Token                        | Value                  | Use                                            |
| ---------------------------- | ---------------------- | ---------------------------------------------- |
| `--background`               | `#161616`              | page bg                                        |
| `--foreground`               | `#f9fbff`              | main text                                      |
| `--card`                     | `#1b1d20`              | cards, active row                              |
| `--popover`                  | `#161616`              | menus, popovers                                |
| `--primary`                  | `#4124fb`              | primary button (New Company, Create, Save)     |
| `--primary-foreground`       | `#f9fbff`              |                                                |
| `--secondary`                | `#1e1e1e`              | raised buttons (Export, filters, icon buttons) |
| `--muted`                    | `#2a2a2a`              | active nav item, badges, Add Billings          |
| `--muted-foreground`         | `#7f7f7f`              | secondary text, idle nav                       |
| `--accent`                   | `#2a2a2a`              | hover bg                                       |
| `--destructive` / `--danger` | `#f97373`              | errors, low win %                              |
| `--border`                   | `#232323`              | dividers, table rows                           |
| `--input` / `--line-strong`  | `#393939`              | input borders                                  |
| `--ring`                     | `#676767`              | focus ring (used at /60)                       |
| `--sidebar`                  | `#171717`              | sidebar bg                                     |
| `--sidebar-accent`           | `#181818`              |                                                |
| `--subtle`                   | `#676767`              | table headers, idle tabs, labels               |
| `--faint`                    | `#454545`              |                                                |
| `--soft`                     | `#a4a4a4`              | tab hover                                      |
| `--chip`                     | `#cfcfcf`              | count badge text                               |
| `--icon`                     | `#d0d4dd`              | icon hover/active                              |
| `--success`                  | `#22c55e`              | high win %, bars                               |
| `--warning`                  | `#fbbf24`              | mid win %, checkbox checked (yellow)           |
| `--trend`                    | `#00b562`              | sparkline bars                                 |
| `--trend-muted`              | `#395e4d`              | sparkline low bars                             |
| `--track`                    | `#3a3a3a`              | empty meter segments, slider track             |
| `--status`                   | `#16c89e`              | "Active" dot                                   |
| Pipeline dots                | yellow / pink / purple | North America / EMEA / APAC                    |

### Tag colours (bg / border / text)

| Variant | bg        | border    | text      | Seen as               |
| ------- | --------- | --------- | --------- | --------------------- |
| blue    | `#1d2b3e` | `#23354c` | `#bfdbfe` | Enterprise            |
| purple  | `#231f3a` | `#4b437b` | `#b7aee9` | Upsell                |
| green   | `#1f3a2d` | `#275137` | `#b1ebc5` | Mid-Market, Expansion |
| moss    | `#23451d` | `#2e5029` | `#b1ebc5` | New Logo?             |
| red     | `#3e1d1e` | `#4c2324` | `#febfc6` | Strategic             |
| orange  | `#3e291d` | `#764d35` | `#eeb390` | Pilot, Co-Sell        |
| amber   | `#31221b` | `#6c4830` | `#fed7aa` |                       |
| teal    | `#102a27` | `#3b6149` | `#22c55e` | Land & Expand         |
| yellow  | `#33301a` | `#5a5228` | `#fde68a` | SMB                   |
| neutral | `#2a2a2a` | `#363636` | `#cfcfcf` | "+2" overflow         |

## Typography

- Font: **Geist** (sans), mono = system mono. Body 16px base, `antialiased`.
- Weights: 400 normal, 500 medium (buttons, nav, titles), 600, 700.
- Custom text styles:
  - `p-style` 14px / 1.15 / 400
  - `lead-style` 14px / 1 / 400 (nav, table cells)
  - `caption-style` 12px / 1 / 400 (tabs, table headers, badges, footer)
  - `eyebrow-style` 12px / 1 / 400, `letter-spacing: 1px`, UPPERCASE (TEAM, CONTACT, COMPANY sections)
- Page title (h1): 16px / 500. Sheet big number ("82%"): ~28px / 600.
- Letter-spacing -0.01em on some medium labels ("14 Days").

## Radius

- `--radius: .5rem` (8px) — nav items, cards, inputs.
- 4px — checkbox. Full pill (`rounded-full`) — all buttons, badges, tags, filter triggers, icon buttons.
- Stat cards / score cards ≈ 8px.

## Sizing

- Sidebar width `254px` (resizable, collapses). Nav item h 30px (active 32px), padding 0 8px.
- Buttons h **30px**, pill, padding 9px, gap 6px, 12px/500 text. Icon button 30×30.
- Count badge h16, min-w 24, 12px. Status badge h20. Tag h **22px**, 14px text, px 6px.
- Table: header row h 38px (12px subtle), body row h 42px + 1px border, cell px 12px. Avatar 20px round. Checkbox 16px.
- Tabs: 12px, py 16px, gap 16px, active = foreground text + 1px bottom border foreground.
- Layout: `--max-width-global 76.25rem`, `--padding-global 1rem`, section padding 1.5 / 2 / 2.75 / 6rem.

## Shadows (signature "raised" look)

- Raised (secondary buttons, active nav, icon buttons):
  `0 0 0 1px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 1px rgba(255,255,255,.06)`
- Primary button:
  `0 4px 4px rgba(42,42,42,.32), 0 0 0 1px #0e0e0e, inset 0 4px 6px rgba(255,255,255,.2), inset 0 0 0 1px rgba(255,255,255,.15), inset 0 -8px 14px rgba(0,0,0,.15)`
- Overlay (menus, popovers, dialogs): `--shadow-overlay: 0 16px 40px #00000080, 0 0 0 1px #0e0e0e`
- Count badge: `0 0 0 .5px #0e0e0e`, border `.5px #414141`.
- Backdrop: dark overlay + blur behind sheets/dialogs/command palette.

## Motion

- Default transition 150ms `ease-power3-out` = `cubic-bezier(.25,1,.5,1)` on bg/colour/box-shadow.
- Full easing set: power1–4 in/out/in-out, `smooth-in-out cubic-bezier(.7,0,0,1)`.
- Keyframes `enter` / `exit` (tw-animate style) for overlays.

## Focus

- `focus-visible:ring-2 ring-ring/60` (grey ring) on buttons/checkbox; filter trigger shows ring outline (see `d53-focus-toolbar.png`).

## Icons

- Not lucide classes; custom inline SVG set, 14px (`size-3.5`), colour `--subtle` → `--icon` on hover/active. Stroke style similar to lucide/tabler → we can use **lucide-react** as the closest match.

## Assets

- Avatars: `/assets/images/_common/avatars/jensen.png`, `avatar-1..10.png` (reference only; we use our own placeholder avatars).
- Company logos: Apple, Snowflake, Stripe, Slack, Microsoft, etc. as small rounded tiles (reference only; not shipped).
