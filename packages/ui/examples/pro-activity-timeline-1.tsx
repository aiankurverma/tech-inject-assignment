import { useMemo, useState } from "react";
import {
  ProActivityTimeline,
  type ActivityType,
  type TimelineActivity,
} from "@/components/crm/pro-activity-timeline";

// Deterministic PRNG so the demo is stable between renders and screenshots.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REPS = ["Maya Chen", "Leo Park", "Sam Ortiz", "Priya Nair", "Jonas Weber"];
const CONTACTS = [
  { name: "Rachel Green", email: "rachel.green@northwind.io" },
  { name: "Tom Alvarez", email: "tom.alvarez@northwind.io" },
  { name: "Aiko Tanaka", email: "aiko@northwind.io" },
  { name: "Ben Okafor", email: "ben.okafor@northwind.io" },
];
const SUBJECTS = [
  "Renewal pricing for FY27",
  "Security questionnaire follow-up",
  "SSO rollout timeline",
  "Invoice #4821 question",
  "Seats expansion for the EMEA team",
  "Recap: quarterly business review",
];
const EMAIL_BODIES = [
  "Hi Rachel,\n\nThanks for the time on Tuesday. As promised, attached is the revised proposal with 3-year pricing. We held the per-seat rate flat for year two and applied a 6% uplift in year three, which is below the list increase.\n\nThe SSO add-on is now bundled, and onboarding for the EMEA team can begin the week of the 14th if we countersign by the end of the month.\n\nHappy to walk procurement through it on a call.\n\nBest,\nMaya",
  "Hi team,\n\nWe've reviewed the security questionnaire. Two open items: data residency for the EU instance and the pen-test summary. Could you share the latest SOC 2 bridge letter as well?\n\nThanks,\nTom",
  "Quick one: finance flagged invoice #4821 as including 12 seats we removed in March. Can you confirm and reissue?\n\nBen",
];
const NOTES = [
  "Champion (Rachel) confirmed budget is approved but procurement wants a 30-day out clause. Legal will push back; offer a 60-day notice instead.",
  "Competitor evaluation paused. They're consolidating tools in Q3, which is a good window for the platform pitch.",
  "Exec sponsor changed: Tom now reports to the new COO. Book an intro before renewal.",
];
const STAGES = ["Discovery", "Qualified", "Proposal", "Negotiation", "Closed won"];

function generate(count: number, now: number): TimelineActivity[] {
  const rand = mulberry32(42);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const out: TimelineActivity[] = [];
  let t = now - 20 * 60_000;
  for (let i = 0; i < count; i++) {
    t -= Math.floor(rand() * 7 * 3_600_000) + 5 * 60_000; // ~3.5h apart on average -> ~5 years
    const r = rand();
    const rep = pick(REPS);
    const contact = pick(CONTACTS);
    const type: ActivityType =
      r < 0.38
        ? "email"
        : r < 0.58
          ? "call"
          : r < 0.7
            ? "meeting"
            : r < 0.84
              ? "note"
              : r < 0.9
                ? "stage"
                : "task";
    const base = { id: `act-${i}`, type, at: t, actor: { name: rep } };
    if (type === "email") {
      const inbound = rand() < 0.45;
      out.push({
        ...base,
        actor: { name: inbound ? contact.name : rep },
        title: `${inbound ? "replied" : "emailed"} · ${pick(SUBJECTS)}`,
        body: pick(EMAIL_BODIES),
        email: {
          direction: inbound ? "inbound" : "outbound",
          from: inbound ? contact.email : `${rep.split(" ")[0]!.toLowerCase()}@kitbase.dev`,
          to: [inbound ? `${rep.split(" ")[0]!.toLowerCase()}@kitbase.dev` : contact.email],
          cc: rand() < 0.3 ? ["deals@kitbase.dev"] : undefined,
        },
      });
    } else if (type === "call") {
      const o = rand();
      out.push({
        ...base,
        title: `called ${contact.name}`,
        body:
          o < 0.6
            ? "Walked through the rollout plan; they asked for a reference customer in fintech."
            : undefined,
        call: {
          outcome: o < 0.6 ? "connected" : o < 0.85 ? "voicemail" : "no-answer",
          durationSec: o < 0.6 ? 180 + Math.floor(rand() * 2400) : 0,
        },
      });
    } else if (type === "meeting") {
      out.push({
        ...base,
        title: pick([
          "held Quarterly business review",
          "held Security review",
          "held Pricing workshop",
        ]),
        meeting: {
          attendees: 2 + Math.floor(rand() * 7),
          location: rand() < 0.7 ? "Zoom" : "Northwind HQ, Berlin",
        },
      });
    } else if (type === "note") {
      out.push({ ...base, title: "added a note", body: pick(NOTES) });
    } else if (type === "stage") {
      const s = Math.floor(rand() * (STAGES.length - 1));
      out.push({
        ...base,
        title: "moved the deal",
        stage: { from: STAGES[s]!, to: STAGES[s + 1]! },
      });
    } else {
      out.push({
        ...base,
        title: pick([
          "created task: send MSA redlines",
          "created task: book exec intro",
          "completed task: share ROI model",
        ]),
        task: { done: rand() < 0.6, due: t + 3 * 86_400_000 },
      });
    }
  }
  return out;
}

export default function ProActivityTimelineExample() {
  const [now] = useState(() => Date.now());
  const items = useMemo(() => generate(12_000, now), [now]);
  // Open the feed 21 days back (e.g. from a "jump to date" link): scroll up for newer, down for older.
  const anchor = useMemo(() => new Date(now - 21 * 86_400_000), [now]);
  // Pinned notes usually come from a separate endpoint, since they can be far outside the window.
  const pinnedItems = useMemo(() => items.filter((a) => a.type === "note").slice(0, 2), [items]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="crm-eyebrow text-crm-muted-fg">Northwind Traders · Account</p>
          <h2 className="text-lg font-semibold text-crm-fg">Activity</h2>
        </div>
        <p className="text-xs text-crm-muted-fg">12,000 activities · opened at 3 weeks ago</p>
      </div>
      <ProActivityTimeline
        queryKey={["account", "northwind", "activity"]}
        items={items}
        anchor={anchor}
        defaultPinnedIds={pinnedItems.map((a) => a.id)}
        pinnedItems={pinnedItems}
        height={520}
        label="Northwind Traders activity"
      />
    </div>
  );
}
