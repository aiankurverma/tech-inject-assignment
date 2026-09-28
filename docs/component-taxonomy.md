# Kitbase component taxonomy (roadmap to 300)

Scope: CRM / SaaS product UI, dark CRM theme, React 19 + Tailwind v4. Every entry ships as one
registry bundle (`packages/ui/registry/<slug>.json`) with typed props, 1+ examples and a11y.

Legend: `[x]` shipped · `[ ]` planned. Batch 1 items are marked **B1**.

| Tier               | Target  | Shipped |
| ------------------ | ------- | ------- |
| Primitives         | 60      | 20      |
| Composites         | 100     | 36      |
| Blocks             | 100     | 0       |
| Industry templates | 40      | 0       |
| **Total**          | **300** | **56**  |

Rules for new entries: only `ALLOWED_DEPENDENCIES` (packages/core/src/constants.ts), `@/` imports,
reuse existing components, pass `npx tsx packages/ui/scripts/validate-registry.ts`.

---

## 1. Primitives (60)

### Actions (8)

- [x] `button` — Pill button, variants, sizes, loading; IconButton.
- [x] `button-group` — Joined buttons / split button.
- [ ] `toggle` — Pressed/unpressed single button.
- [x] `toggle-group` — Exclusive or multi toggle row (view switcher).
- [ ] `link` — Styled inline/external link with icon.
- [ ] `copy-button` — Copies text, shows confirmation.
- [ ] `fab` — Floating action button.
- [x] `kbd` — Keyboard key hint.

### Form controls (20)

- [x] `input` — Text input with prefix, invalid state; FormField.
- [x] `textarea` — **B1** Multi-line, auto-resize, counter.
- [x] `checkbox` — Radix checkbox with indeterminate.
- [x] `switch` — **B1** On/off toggle with label/description.
- [x] `radio-group` — **B1** Radios or selectable cards, roving focus.
- [x] `select` — Radix select.
- [x] `slider` — Radix slider.
- [x] `number-input` — Stepper buttons, min/max, formatting.
- [x] `currency-input` — Locale money input.
- [ ] `phone-input` — Country code + number.
- [x] `password-input` — Show/hide, strength meter.
- [x] `otp-input` — One-time code boxes.
- [x] `search-input` — Icon, clear, shortcut hint.
- [x] `tag-input` — Free-form tokens.
- [x] `combobox` — Searchable single select.
- [x] `multi-select` — Searchable multi select with chips.
- [x] `date-picker` — **B1** Popover calendar with min/max, keyboard grid.
- [ ] `date-range-picker` — Two-month range + presets.
- [x] `time-picker` — Time slots / free entry.
- [x] `color-picker` — Swatches for tags and pipelines.

### Display (18)

- [x] `avatar` — Initials fallback, badge; LogoTile.
- [x] `avatar-group` — Stacked avatars with +N.
- [x] `badge` — CountBadge, StatusBadge.
- [x] `tag` — Coloured pill, TagList.
- [x] `chip` — Removable / selectable chip.
- [x] `divider` — Horizontal/vertical with label.
- [ ] `heading` — Typographic scale.
- [ ] `text` — Body/caption/eyebrow variants.
- [ ] `icon-tile` — Tinted icon square.
- [x] `status-dot` — Online/away/busy dot.
- [ ] `presence-indicator` — Avatar + live status.
- [x] `rating` — Interactive star rating.
- [ ] `code-block` — Syntax-light code with copy.
- [ ] `inline-code` — Monospace token.
- [x] `truncated-text` — Clamp with expand.
- [x] `relative-time` — "3h ago" with tooltip date.
- [ ] `money` — Formatted amount with currency.
- [x] `trend-arrow` — Up/down delta indicator.

### Feedback (8)

- [x] `feedback` — Skeleton, EmptyState.
- [x] `progress` — **B1** Linear + ring, indeterminate.
- [x] `alert` — **B1** Inline banner, four tones.
- [x] `toast` — **B1** Provider + useToast, actions.
- [x] `tooltip` — **B1** Hover/focus hint, no deps.
- [x] `spinner` — Loading indicator.
- [ ] `loading-overlay` — Blocking overlay over a region.
- [ ] `inline-error` — Field-level error text.

### Layout (6)

- [x] `card` — Surface with header/body/footer.
- [ ] `stack` — Flex gap helper.
- [ ] `scroll-area` — Styled scroll container.
- [ ] `resizable-panels` — Split panes with drag handle.
- [ ] `aspect-ratio` — Fixed ratio media box.
- [ ] `visually-hidden` — SR-only wrapper.

## 2. Composites (100)

### Navigation (14)

- [x] `app-sidebar` — Sidebar, sections, items, trial card.
- [x] `tabs` — Radix tabs.
- [x] `page-header` — Title, badge, actions; ProfileChip.
- [x] `breadcrumbs` — **B1** Trail with collapsing ellipsis.
- [x] `pagination` — **B1** Numbered/compact pager + summary.
- [x] `stepper` — **B1** Horizontal/vertical steps.
- [ ] `top-nav` — Horizontal app bar.
- [ ] `mobile-nav` — Bottom tab bar / drawer.
- [x] `workspace-switcher` — Org/team dropdown.
- [x] `user-menu` — Avatar menu with account links.
- [x] `vertical-tabs` — Settings-style side tabs.
- [ ] `anchor-nav` — Scroll-spy section links.
- [x] `segmented-control` — Pill view switcher.
- [ ] `tree-nav` — Nested folders/objects.

### Overlays (12)

- [x] `dialog` — Radix dialog with sections.
- [x] `sheet` — Side panel.
- [x] `command-palette` — ⌘K search and actions.
- [x] `notifications` — Notification popover.
- [x] `dropdown-menu` — **B1** Items, checkbox items, shortcuts.
- [x] `popover` — Generic styled popover.
- [ ] `context-menu` — Right-click menu.
- [x] `confirm-dialog` — Destructive confirmation.
- [x] `hover-card` — Record preview on hover.
- [x] `drawer` — Bottom sheet for mobile.
- [ ] `lightbox` — Image/file viewer.
- [ ] `spotlight-tour` — Onboarding coachmarks.

### Forms (18)

- [x] `filter-select` — Filter dropdown.
- [x] `file-drop` — Drag-and-drop upload.
- [x] `comment-box` — **B1** Composer with @mentions.
- [x] `filter-chips` — **B1** Applied filter row.
- [x] `filter-builder` — Field/operator/value rule editor.
- [x] `sort-menu` — Multi-column sort.
- [x] `column-picker` — Show/hide/reorder columns.
- [x] `inline-edit` — Click-to-edit field.
- [ ] `address-form` — Structured address.
- [x] `form-section` — Titled group with description.
- [x] `settings-row` — Label/description/control row.
- [x] `email-composer` — To/CC/subject/body.
- [ ] `rich-text-toolbar` — Formatting toolbar.
- [ ] `signature-pad` — Draw signature.
- [ ] `custom-field-editor` — Define field type/options.
- [ ] `import-mapper` — CSV column → field mapping.
- [ ] `search-with-filters` — Search + quick filters.
- [x] `saved-views` — Named filter presets.

### Data display (30)

- [x] `data-table` — Table primitives, footer aggregates.
- [x] `data-cells` — MoneyValue, DateCell, ContactLine.
- [x] `stat-card` — Label/value tile, SectionLabel.
- [x] `score-card` — Score + star rating.
- [x] `segmented-meter` — Segmented meter, ProgressRow.
- [x] `sparkline` — Mini bars, TrendStat.
- [x] `account-list-item` — Company row with meter.
- [x] `activity-timeline` — **B1** Typed activity feed.
- [x] `kpi-grid` — **B1** KPI tiles, DeltaPill.
- [x] `pipeline-stage-bar` — **B1** Chevron stage bar.
- [x] `contact-card` — **B1** Person card / compact row.
- [x] `deal-card` — **B1** Deal tile, draggable.
- [x] `kanban-column` — **B1** Board column with DnD.
- [x] `description-list` — Key/value record fields.
- [x] `property-panel` — Editable record sidebar.
- [ ] `company-card` — Account summary card.
- [ ] `lead-score-badge` — Hot/warm/cold score.
- [ ] `health-score` — Customer health gauge.
- [ ] `funnel-chart` — Stage conversion funnel.
- [ ] `bar-chart` — SVG bars.
- [ ] `line-chart` — SVG line/area.
- [ ] `donut-chart` — Share breakdown.
- [ ] `heatmap` — Activity by day/hour.
- [ ] `leaderboard` — Ranked reps.
- [ ] `quota-gauge` — Attainment gauge.
- [ ] `calendar-month` — Month event grid.
- [ ] `agenda-list` — Upcoming meetings.
- [ ] `file-list` — Attachments with type icons.
- [ ] `email-thread` — Collapsible message thread.
- [ ] `tree-table` — Hierarchical rows.

### Collaboration (12)

- [ ] `mention-list` — @mention suggestion list.
- [ ] `comment-thread` — Threaded comments with replies.
- [ ] `reaction-bar` — Emoji reactions.
- [ ] `presence-avatars` — Who is viewing.
- [ ] `assignee-picker` — Owner selector.
- [ ] `task-item` — Checkbox task with due date.
- [ ] `task-list` — Grouped tasks.
- [ ] `reminder-chip` — Snoozed follow-up.
- [ ] `share-dialog` — Invite + permission levels.
- [ ] `audit-log-row` — Field change diff.
- [ ] `version-history` — Record revisions.
- [ ] `chat-bubble` — Live chat message.

### Commerce and billing (14)

- [ ] `pricing-card` — Plan tier card.
- [ ] `plan-switcher` — Monthly/yearly toggle.
- [ ] `invoice-row` — Invoice status line.
- [ ] `quote-line-items` — Products, qty, discount, tax.
- [ ] `payment-method` — Card on file.
- [ ] `usage-meter` — Seats/API usage vs limit.
- [ ] `coupon-input` — Promo code apply.
- [ ] `order-summary` — Totals block.
- [ ] `subscription-status` — Active/past due/cancelled.
- [ ] `product-picker` — Catalog search + add.
- [ ] `currency-switcher` — Change display currency.
- [ ] `tax-breakdown` — Tax lines.
- [ ] `receipt` — Printable receipt.
- [ ] `upgrade-banner` — Upsell prompt.

## 3. Blocks (100)

Full sections built from primitives and composites.

### App shells (10)

- [ ] `shell-sidebar` · [ ] `shell-topnav` · [ ] `shell-split` · [ ] `shell-settings` ·
      [ ] `shell-mobile` · [ ] `shell-auth` · [ ] `shell-onboarding` · [ ] `shell-admin` ·
      [ ] `shell-inbox` · [ ] `shell-docs` — application layouts.

### Dashboards (15)

- [ ] `sales-dashboard` — KPIs, pipeline, leaderboard.
- [ ] `revenue-dashboard` — MRR/ARR, churn, expansion.
- [ ] `marketing-dashboard` — Leads by source, campaigns.
- [ ] `support-dashboard` — Tickets, SLA, CSAT.
- [ ] `rep-dashboard` — My deals, tasks, quota.
- [ ] `executive-summary` — Board-level metrics.
- [ ] `forecast-view` — Commit/best case/pipeline.
- [ ] `activity-dashboard` — Calls/emails/meetings.
- [ ] `cohort-retention` — Retention grid.
- [ ] `funnel-report` — Conversion by stage.
- [ ] `win-loss-report` — Reasons and trends.
- [ ] `territory-map` — Region performance.
- [ ] `product-usage` — Adoption metrics.
- [ ] `health-overview` — Accounts by health.
- [ ] `goal-tracker` — Team goals progress.

### Records (20)

- [ ] `contact-list` · [ ] `contact-detail` · [ ] `company-list` · [ ] `company-detail` ·
      [ ] `deal-list` · [ ] `deal-detail` · [ ] `deal-board` · [ ] `lead-inbox` ·
      [ ] `lead-detail` · [ ] `ticket-list` · [ ] `ticket-detail` · [ ] `task-board` ·
      [ ] `task-inbox` · [ ] `product-catalog` · [ ] `quote-builder` · [ ] `invoice-detail` ·
      [ ] `meeting-notes` · [ ] `call-log` · [ ] `email-inbox` · [ ] `record-360` — list/detail/board
      pages for CRM objects.

### Settings (15)

- [ ] `settings-profile` · [ ] `settings-team` · [ ] `settings-roles` · [ ] `settings-billing` ·
      [ ] `settings-integrations` · [ ] `settings-notifications` · [ ] `settings-security` ·
      [ ] `settings-api-keys` · [ ] `settings-webhooks` · [ ] `settings-pipelines` ·
      [ ] `settings-custom-fields` · [ ] `settings-email` · [ ] `settings-branding` ·
      [ ] `settings-data-import` · [ ] `settings-audit-log` — admin pages.

### Auth and onboarding (12)

- [ ] `sign-in` · [ ] `sign-up` · [ ] `forgot-password` · [ ] `reset-password` · [ ] `verify-email` ·
      [ ] `two-factor` · [ ] `sso-picker` · [ ] `invite-accept` · [ ] `onboarding-checklist` ·
      [ ] `onboarding-wizard` · [ ] `workspace-create` · [ ] `welcome-tour` — account flows.

### Marketing and portal (15)

- [ ] `hero` · [ ] `feature-grid` · [ ] `pricing-table` · [ ] `testimonials` · [ ] `logo-cloud` ·
      [ ] `faq` · [ ] `cta-banner` · [ ] `footer` · [ ] `changelog` · [ ] `status-page` ·
      [ ] `help-center` · [ ] `customer-portal` · [ ] `booking-page` · [ ] `web-form` ·
      [ ] `newsletter-signup` — public-facing sections.

### Workflows (13)

- [ ] `automation-builder` · [ ] `sequence-editor` · [ ] `approval-flow` · [ ] `lead-routing` ·
      [ ] `csv-import-flow` · [ ] `merge-duplicates` · [ ] `bulk-edit` · [ ] `report-builder` ·
      [ ] `dashboard-editor` · [ ] `email-template-editor` · [ ] `meeting-scheduler` ·
      [ ] `calendar-week` · [ ] `notification-center` — multi-step tools.

## 4. Industry templates (40)

Opinionated page sets (shell + records + dashboard) per vertical, 4 per industry.

- [ ] Real estate: `re-listings`, `re-lead-board`, `re-showings`, `re-agent-dashboard`.
- [ ] Recruiting: `ats-pipeline`, `ats-candidate`, `ats-interviews`, `ats-dashboard`.
- [ ] Healthcare clinic: `clinic-patients`, `clinic-appointments`, `clinic-intake`, `clinic-dashboard`.
- [ ] Education: `edu-admissions`, `edu-students`, `edu-courses`, `edu-dashboard`.
- [ ] Agency: `agency-clients`, `agency-projects`, `agency-timesheets`, `agency-dashboard`.
- [ ] SaaS B2B: `saas-accounts`, `saas-renewals`, `saas-health`, `saas-dashboard`.
- [ ] E-commerce: `shop-customers`, `shop-orders`, `shop-returns`, `shop-dashboard`.
- [ ] Field service: `fs-jobs`, `fs-dispatch`, `fs-technicians`, `fs-dashboard`.
- [ ] Nonprofit: `np-donors`, `np-campaigns`, `np-volunteers`, `np-dashboard`.
- [x] Hospitality: `hotel-reservations`, `hotel-guests`, `hotel-housekeeping`, `hotel-dashboard`.
