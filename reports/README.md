# Reports

Generated demand reports are written here by the admin action **Demand pipeline → Weekly report**
(`POST /api/admin/demand/report`). The filename is `demand-YYYY-MM-DD.md`.

Generated reports are **not committed**. Only this README and the sample below are versioned, so
the format is reviewable without leaking live demand data.

## Format

```markdown
# Demand report — 2026-11-09

Kill switch: **off** · auto-build: **off** · auto-publish: **off** · batch limit: **10/day**

## New demand signals (last 7 days)

- **contact table with tags** — 14 searches, 3 upvotes, 220 impressions, 4 clicks (site_search)

## Ranked opportunities

- **contact table with tags** — score 81, decision **build**, status **approved**. Passes the demand threshold...

## Request board

- **Kanban with swimlanes** — 6 votes, status **building**

## Quality reports (last 7 days)

- contact-table-with-tags: **not passed** (0 failing, 3 manual)

## Published this week

- /components/activity-timeline — 2026-11-07

## Search Console follow-ups

- Import a fresh GSC Queries CSV to refresh impressions and clicks.
- For pages with impressions but low CTR, rewrite the title and description; do not create a new page.
- For pages with no impressions after 60 days, improve, merge or noindex them.

## Rejection reasons (feedback for future drafts)

- **invoice table** — too close to the existing billing table; improve that page instead.
```

## Retention

Keep reports for at least 90 days. They contain aggregate queries only; no emails, IPs or account
identifiers. Review the rejection reasons before approving the next AI draft so the same idea is
not rejected twice.
