import * as React from "react";
import { Changelog, type ChangelogEntry } from "@/components/crm/changelog";

const entries: ChangelogEntry[] = [
  {
    id: "r9",
    version: "4.12.0",
    date: "2026-09-24",
    title: "Forecast categories and rollups",
    summary: "Managers can now roll up commit / best case by team.",
    plans: ["Pro", "Enterprise"],
    changes: [
      { type: "new", text: "Forecast categories on every deal with manager overrides." },
      { type: "improved", text: "Pipeline board loads 2.3x faster on workspaces with 50k+ deals." },
      { type: "fixed", text: "Currency totals no longer round EUR to whole numbers." },
    ],
  },
  {
    id: "r8",
    version: "4.11.2",
    date: "2026-09-15",
    title: "Security patch",
    changes: [
      { type: "security", text: "Rotated OAuth signing keys; reconnect Gmail if sync paused." },
      { type: "fixed", text: "SCIM deprovisioning now revokes API tokens immediately." },
    ],
  },
  {
    id: "r7",
    version: "4.11.0",
    date: "2026-09-03",
    title: "Sequences v2",
    plans: ["Pro"],
    changes: [
      { type: "new", text: "A/B test subject lines inside sequences." },
      { type: "breaking", text: "The /v1/sequences endpoint is removed; use /v2/sequences." },
      { type: "improved", text: "Send windows respect each contact's local time zone." },
    ],
  },
  {
    id: "r6",
    version: "4.10.0",
    date: "2026-08-20",
    title: "Custom objects",
    changes: [
      { type: "new", text: "Create custom objects with relations to accounts and deals." },
      { type: "fixed", text: "CSV import handles UTF-8 BOM headers." },
    ],
  },
  {
    id: "r5",
    version: "4.9.1",
    date: "2026-08-06",
    title: "Reporting fixes",
    changes: [
      { type: "fixed", text: "Win-rate report excluded deals closed on the last day of month." },
      { type: "improved", text: "Report filters remember your last date range." },
    ],
  },
  {
    id: "r4",
    version: "4.9.0",
    date: "2026-07-22",
    title: "Mobile call logging",
    changes: [{ type: "new", text: "Log calls from iOS and Android with automatic duration." }],
  },
  {
    id: "r3",
    version: "4.8.0",
    date: "2026-07-01",
    title: "Approval rules",
    plans: ["Enterprise"],
    changes: [
      { type: "new", text: "Require manager approval for discounts over a threshold." },
      { type: "improved", text: "Audit log shows who approved each discount." },
    ],
  },
];

export default function Example() {
  const [lastSeen, setLastSeen] = React.useState("2026-09-10");
  return (
    <div className="w-full max-w-2xl">
      <Changelog
        entries={entries}
        lastSeen={lastSeen}
        pageSize={2}
        onMarkAllRead={() => setLastSeen(new Date().toISOString())}
      />
    </div>
  );
}
