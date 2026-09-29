import * as React from "react";
import { NuqsAdapter } from "nuqs/adapters/react";
import { z } from "zod";
import {
  EMPTY_VIEW,
  ProDataGrid,
  type GridColumn,
  type SavedGridView,
} from "@/components/crm/pro-data-grid";
import { useGridUrlView } from "@/hooks/use-grid-url-view";

interface Deal {
  id: string;
  name: string;
  company: string;
  owner: string;
  stage: string;
  region: string;
  amount: number;
  probability: number;
  closeDate: string;
  seats: number;
  source: string;
  industry: string;
  country: string;
  lastActivity: string;
  priority: string;
  renewal: boolean;
}

const STAGES = [
  "Lead",
  "Qualified",
  "Discovery",
  "Proposal",
  "Negotiation",
  "Closed won",
  "Closed lost",
] as const;
const OWNERS = [
  "Ava Chen",
  "Marcus Reid",
  "Priya Nair",
  "Diego Alvarez",
  "Sofia Rossi",
  "Kenji Watanabe",
  "Leah Goldberg",
  "Omar Haddad",
  "Grace Okafor",
  "Tom Becker",
  "Mei Lin",
  "Rahul Mehta",
];
const REGIONS = ["North America", "EMEA", "APAC", "LATAM"] as const;
const SOURCES = ["Inbound", "Outbound", "Partner", "Event", "Referral", "Self-serve"];
const INDUSTRIES = [
  "Fintech",
  "Healthcare",
  "Retail",
  "Logistics",
  "Media",
  "Education",
  "Manufacturing",
  "SaaS",
  "Energy",
  "Public sector",
];
const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "India",
  "Japan",
  "Australia",
  "Brazil",
  "Mexico",
  "Singapore",
  "Netherlands",
];
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
const PREFIX = [
  "North",
  "Blue",
  "Bright",
  "Iron",
  "Silver",
  "Clear",
  "Summit",
  "Cedar",
  "Nova",
  "Atlas",
  "Harbor",
  "Pioneer",
  "Vertex",
  "Quantum",
  "Lumen",
  "Granite",
];
const SUFFIX = [
  "Labs",
  "Logistics",
  "Health",
  "Systems",
  "Foods",
  "Energy",
  "Robotics",
  "Capital",
  "Media",
  "Analytics",
  "Works",
  "Networks",
];
const DEAL = [
  "Platform expansion",
  "Annual renewal",
  "Pilot",
  "Enterprise rollout",
  "Add-on seats",
  "Multi-year",
  "Migration",
  "Security add-on",
];

/** Deterministic PRNG so the demo (and screenshots) are stable. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDeals(count: number): Deal[] {
  const rand = mulberry32(42);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const base = Date.UTC(2026, 0, 1);
  const out: Deal[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const stage = pick(STAGES);
    const company = `${pick(PREFIX)} ${pick(SUFFIX)}`;
    const seats = 5 + Math.floor(rand() ** 2 * 2000);
    out[i] = {
      id: `D-${String(100000 + i)}`,
      name: `${company} — ${pick(DEAL)}`,
      company,
      owner: pick(OWNERS),
      stage,
      region: pick(REGIONS),
      amount: Math.round(seats * (180 + rand() * 900)),
      probability:
        stage === "Closed won"
          ? 1
          : stage === "Closed lost"
            ? 0
            : Math.round(rand() * 90 + 5) / 100,
      closeDate: new Date(base + Math.floor(rand() * 540) * 86_400_000).toISOString().slice(0, 10),
      seats,
      source: pick(SOURCES),
      industry: pick(INDUSTRIES),
      country: pick(COUNTRIES),
      lastActivity: new Date(base + Math.floor(rand() * 270) * 86_400_000)
        .toISOString()
        .slice(0, 10),
      priority: pick(PRIORITIES),
      renewal: rand() < 0.3,
    };
  }
  return out;
}

const columns: GridColumn<Deal>[] = [
  { id: "id", header: "Deal ID", width: 110, pinned: "start", sortable: true, groupable: false },
  {
    id: "name",
    header: "Deal",
    width: 280,
    pinned: "start",
    editable: true,
    schema: z
      .string()
      .trim()
      .min(3, "At least 3 characters")
      .max(120, "Keep it under 120 characters"),
  },
  { id: "company", header: "Company", width: 180, aggregate: "uniqueCount" },
  {
    id: "owner",
    header: "Owner",
    type: "enum",
    options: OWNERS,
    editable: true,
    schema: z.enum(OWNERS as [string, ...string[]], { message: "Pick an owner from the list" }),
  },
  {
    id: "stage",
    header: "Stage",
    type: "enum",
    options: STAGES,
    editable: (d) => d.stage !== "Closed won" && d.stage !== "Closed lost",
    schema: z.enum(STAGES),
  },
  { id: "region", header: "Region", type: "enum", options: REGIONS, width: 140 },
  {
    id: "amount",
    header: "Amount",
    type: "currency",
    aggregate: "sum",
    editable: true,
    schema: z
      .number({ message: "Enter an amount" })
      .min(0, "Amount can’t be negative")
      .max(50_000_000, "Over the $50M deal-desk limit"),
  },
  {
    id: "probability",
    header: "Probability",
    type: "percent",
    width: 120,
    aggregate: "mean",
    editable: true,
    schema: z.number({ message: "Enter a percentage" }).min(0, "Min 0%").max(1, "Max 100%"),
  },
  {
    id: "closeDate",
    header: "Close date",
    type: "date",
    editable: true,
    schema: z.string({ message: "Pick a date" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  },
  {
    id: "seats",
    header: "Seats",
    type: "number",
    width: 100,
    aggregate: "sum",
    editable: true,
    schema: z.number().int("Whole seats only").min(1, "At least 1 seat"),
  },
  {
    id: "priority",
    header: "Priority",
    type: "enum",
    options: PRIORITIES,
    width: 120,
    editable: true,
    schema: z.enum(PRIORITIES),
  },
  { id: "source", header: "Source", type: "enum", options: SOURCES, width: 130 },
  { id: "industry", header: "Industry", type: "enum", options: INDUSTRIES, width: 150 },
  { id: "country", header: "Country", type: "enum", options: COUNTRIES, width: 150 },
  { id: "lastActivity", header: "Last activity", type: "date", width: 130 },
  { id: "renewal", header: "Renewal", type: "boolean", width: 100, pinned: "end", editable: true },
];

const views: SavedGridView[] = [
  { id: "all", name: "All deals", builtIn: true, view: EMPTY_VIEW },
  {
    id: "pipeline",
    name: "Open pipeline by stage",
    builtIn: true,
    view: {
      ...EMPTY_VIEW,
      grouping: ["stage"],
      sorting: [{ id: "amount", desc: true }],
      filters: [
        {
          id: "stage",
          value: { kind: "set", values: ["Qualified", "Discovery", "Proposal", "Negotiation"] },
        },
      ],
    },
  },
  {
    id: "big-emea",
    name: "EMEA deals over $500k",
    builtIn: true,
    view: {
      ...EMPTY_VIEW,
      sorting: [{ id: "closeDate", desc: false }],
      filters: [
        { id: "region", value: { kind: "set", values: ["EMEA"] } },
        { id: "amount", value: { kind: "range", min: 500_000 } },
      ],
    },
  },
];

const DEFAULT_VIEW = {
  ...EMPTY_VIEW,
  sorting: [{ id: "amount", desc: true }],
  pinning: { start: ["id", "name"], end: ["renewal"] },
};

function DealsGrid() {
  const data = React.useMemo(() => makeDeals(100_000), []);
  const [view, setView] = useGridUrlView("deals", DEFAULT_VIEW);
  const [saved, setSaved] = React.useState(views);
  return (
    <ProDataGrid
      label="Deals"
      data={data}
      columns={columns}
      getRowId={(d) => d.id}
      view={view}
      onViewChange={setView}
      savedViews={saved}
      onSavedViewsChange={setSaved}
      exportFileName="deals"
      height={560}
      onCellEdit={async (edit) => {
        // Simulate the API round-trip; a rejected promise rolls the optimistic edit back.
        await new Promise((r) => setTimeout(r, 120));
        if (edit.columnId === "amount" && Number(edit.value) === 13)
          throw new Error("Server rejected the amount");
      }}
    />
  );
}

export default function Example() {
  return (
    <NuqsAdapter>
      <div className="w-full max-w-[1200px]">
        <DealsGrid />
      </div>
    </NuqsAdapter>
  );
}
