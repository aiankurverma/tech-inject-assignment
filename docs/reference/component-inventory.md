# CRM Component Inventory (Phase 0, 2026-09-24)

Reference = one screen ("Company pipeline") with many overlays. Sidebar items and tabs only change active state; content stays the same.
Screenshots live in `screens/` (d = desktop 1440x900, s = other desktop sizes, t = tablet 768, m = mobile 390).
Overlay HTML per state is in `raw/*.overlay.html`; overlay text log in `raw/capture-log.json`.

Priority: **P1** = core, build first · **P2** = composite · **P3** = page-level pattern / nice to have.

## A. Primitives

| #   | Component                  | Variants / states                                                                                                                         | Screens                        | P   |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --- |
| 1   | **Button**                 | primary (indigo), secondary/raised (dark), ghost/link; with icon left; sizes (30px default, small in sheets); hover, focus ring, disabled | d01, d23, d25, d26, d42 footer | P1  |
| 2   | **IconButton**             | round 30px raised; with notification dot                                                                                                  | d01 header, d11                | P1  |
| 3   | **Badge (count)**          | pill 16px ("241", "9", "38", "3")                                                                                                         | d01 sidebar, d12               | P1  |
| 4   | **StatusBadge**            | dot + label ("Active"), colour by status                                                                                                  | d01                            | P1  |
| 5   | **Tag / Chip**             | 10 colours (blue, purple, green, moss, red, orange, amber, teal, yellow, neutral), overflow "+N"                                          | d01, d42                       | P1  |
| 6   | **Avatar**                 | image 20px (table) / 32–48px (sheets), with small company-logo sub-badge, fallback                                                        | d01, d12, d13                  | P1  |
| 7   | **LogoTile**               | rounded square with company logo (sm/lg)                                                                                                  | d10, d13, d42                  | P1  |
| 8   | **Checkbox**               | unchecked, hover, checked (yellow), indeterminate (yellow dash), focus                                                                    | d37, d38, d39                  | P1  |
| 9   | **Tabs (underline)**       | idle, hover, active, focus                                                                                                                | d15–d17                        | P1  |
| 10  | **Input**                  | text, placeholder, focus, error (red border + message), currency prefix "$", number                                                       | d26, d29, d30                  | P1  |
| 11  | **DateInput**              | with calendar icon                                                                                                                        | d26/d27                        | P2  |
| 12  | **Select**                 | form select, open list with dot on selected, option with avatar                                                                           | d28                            | P1  |
| 13  | **Slider**                 | win probability, value label                                                                                                              | d26                            | P2  |
| 14  | **Kbd**                    | "Esc", arrow keys, enter                                                                                                                  | d10                            | P2  |
| 15  | **Separator**              | horizontal / vertical dividers                                                                                                            | everywhere                     | P1  |
| 16  | **Link**                   | underlined ("Need help? Ask us.")                                                                                                         | d42                            | P2  |
| 17  | **Eyebrow / SectionLabel** | uppercase 12px tracking 1px                                                                                                               | d13, d26, sidebar              | P1  |

## B. Data display

| #   | Component                                | Variants / states                                                                             | Screens            | P   |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------ | --- |
| 18  | **SegmentedMeter** (win probability bar) | segments red → amber → green by value; compact (table) + wide (sheet, form); with % label     | d01, d13, d26, d42 | P1  |
| 19  | **Sparkline / ActivityTrend**            | mini bar chart (green, muted low bars); inline with big number                                | d01, d42           | P1  |
| 20  | **StatCard**                             | label + value, 2x2 grid; with icon label (Total touches, Emails…)                             | d13, d40, d42      | P1  |
| 21  | **ProgressRow**                          | label + % + segmented bar (Discovery / Evaluation / Procurement)                              | d42                | P2  |
| 22  | **ScoreCard**                            | title, description, owner avatar, "Updated 2h ago", rating pill w/ stars                      | d43                | P2  |
| 23  | **StarRating pill**                      | "High potential SN ★★★★"                                                                      | d43                | P2  |
| 24  | **MoneyValue**                           | muted "$" + amount                                                                            | d01                | P1  |
| 25  | **DateCell**                             | calendar icon + date · divider · interaction type                                             | d01                | P2  |
| 26  | **AccountListItem**                      | logo tile + name + meta line + amount + meter                                                 | d13, d40           | P2  |
| 27  | **ContactLine**                          | mail icon + email, phone icon + number                                                        | d13, d42           | P2  |
| 28  | **NotificationItem**                     | avatar w/ badge, bold actor + action, optional quoted message box, time · context, unread dot | d12, m06           | P2  |

## C. Data table

| #   | Component                        | Variants / states                                                                                                                      | Screens            | P   |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --- |
| 29  | **DataTable**                    | header (12px subtle), rows 42px, hover bg, selected/active row, checkbox column, action "…" column, horizontal scroll on small screens | d01, d31, d37, m01 | P1  |
| 30  | **TableFooter / Aggregates bar** | "18 Companies in view", "+ Sum of pipeline", "+ Avg win probability", "+ Add Calculation" cells                                        | d01, d47           | P2  |

## D. Overlays

| #   | Component                       | Variants / states                                                                                                                              | Screens                 | P   |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --- |
| 31  | **DropdownMenu / FilterSelect** | segmented pill trigger "Label │ Value ⌄", open state (chevron up), menu with label header, radio items w/ dot, keyboard focus item, scrollable | d18–d20, d19-*          | P1  |
| 32  | **Popover** (Notifications)     | header w/ count + "Mark all as read", All/Unread tabs, list                                                                                    | d12, m06                | P2  |
| 33  | **CommandPalette** (Search)     | search input, Esc kbd, results table, highlighted row, footer hints (↑↓ Navigate, ↵ Open)                                                      | d10                     | P2  |
| 34  | **Dialog / Modal**              | header (title + description + close), sections w/ eyebrow, scroll body, footer actions                                                         | d26–d30, m08            | P1  |
| 35  | **Sheet / Drawer**              | right (profile, company detail), left (mobile nav), bottom (mobile filters); header icon + title + close, scroll body, sticky footer           | d13, d40, d42, m03, m04 | P1  |
| 36  | **FileDrop / Upload**           | logo placeholder tile + "Upload logo" + hint text                                                                                              | d26                     | P2  |
| 37  | **FormField**                   | label, required asterisk, help/error text                                                                                                      | d26, d29                | P1  |

## E. Layout / navigation (page patterns)

| #   | Component               | Variants / states                                                                                                                                                                     | Screens                     | P   |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --- |
| 38  | **AppSidebar**          | brand header, nav items (icon + label + count), active/hover/focus, sections (TEAM, REPORTING, PIPELINES), coloured dot items, footer links, resizable, collapses to drawer on mobile | d01, d03–d05, d56, d57, m03 | P2  |
| 39  | **TrialCard**           | "14 Days / Left on trials" + Add Billings button                                                                                                                                      | d01, d06                    | P3  |
| 40  | **TopBar / PageHeader** | title + status badge, right icon buttons, profile chip (avatar + name), mobile hamburger                                                                                              | d01, m01                    | P2  |
| 41  | **Toolbar**             | filters row + actions (Export, New Company); mobile "Filters" button                                                                                                                  | d01, m01                    | P2  |
| 42  | **MobileFilterSheet**   | bottom sheet w/ stacked selects, Reset, "Show 18 companies"                                                                                                                           | m04                         | P3  |
| 43  | **ProfileChip**         | avatar + name pill (collapses to avatar on mobile)                                                                                                                                    | d01, m01                    | P2  |

## Observed but not interactive / omitted

- Search / Notifications / Profile / New Company / Company detail / Owner profile all open real overlays (captured).
- Export, Add Billings, Invite teammates, Help, footer "Sum of pipeline" / "Add Calculation": **no visible reaction** (d07–d09, d24, d48, d49).
- Tabs Companies / Deals / Forecast and sidebar items: only active state changes.
- No toast, tooltip, light theme, empty state or loading state seen in the reference → we design these from tokens (needed by brief R5: loading/empty/error states).
- Business logic (sorting, CRM data) is **not** recreated — theme and components only (R1).
