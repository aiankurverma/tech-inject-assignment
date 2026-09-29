import * as React from "react";
import { NuqsAdapter } from "nuqs/adapters/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format, subDays } from "date-fns";
import {
  Building2,
  CalendarDays,
  CircleDot,
  DollarSign,
  Globe,
  RefreshCw,
  Tag,
  User,
} from "lucide-react";
import {
  ProFilterBar,
  useFilteredRows,
  useUrlFilters,
  type FilterField,
  type SavedView,
} from "@/components/crm/pro-filter-bar";

interface Deal {
  id: number;
  company: string;
  stage: string;
  owner: string;
  region: string;
  tags: string[];
  amount: number;
  closeDate: string;
  renewal: boolean;
}

// Deterministic PRNG so the 10k-row dataset is the same on every render and reload.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAGES = ["Lead", "Qualified", "Demo", "Proposal", "Negotiation", "Won", "Lost"];
const STAGE_COLOR: Record<string, string> = {
  Lead: "#7f7f7f",
  Qualified: "#60a5fa",
  Demo: "#a78bfa",
  Proposal: "#fbbf24",
  Negotiation: "#fb923c",
  Won: "#22c55e",
  Lost: "#f97373",
};
const OWNERS = [
  "Ava Chen",
  "Marcus Reid",
  "Priya Nair",
  "Tom Alvarez",
  "Lena Fischer",
  "Noah Lee",
  "Grace Miller",
  "Diego Santos",
];
const REGIONS = ["North America", "EMEA", "APAC", "LATAM"];
const TAGS = [
  "Enterprise",
  "Mid-Market",
  "SMB",
  "Expansion",
  "Pilot",
  "Security review",
  "Multi-year",
];
const PREFIX = [
  "North",
  "Blue",
  "Bright",
  "Iron",
  "Silver",
  "Quantum",
  "Summit",
  "Cedar",
  "Nova",
  "Harbor",
  "Atlas",
  "Vertex",
];
const SUFFIX = [
  "Labs",
  "Systems",
  "Health",
  "Logistics",
  "Analytics",
  "Robotics",
  "Capital",
  "Foods",
  "Energy",
  "Cloud",
];

function makeDeals(n: number): Deal[] {
  const rand = mulberry32(42);
  const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)]!;
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const tagCount = Math.floor(rand() * 3);
    return {
      id: 10_000 + i,
      company: `${pick(PREFIX)} ${pick(SUFFIX)}`,
      stage: STAGES[Math.min(6, Math.floor(rand() ** 1.4 * 7))]!,
      owner: pick(OWNERS),
      region: pick(REGIONS),
      tags: [...new Set(Array.from({ length: tagCount }, () => pick(TAGS)))],
      amount: Math.round((rand() ** 3 * 240_000 + 1_500) / 100) * 100,
      closeDate: format(subDays(today, Math.floor(rand() * 400) - 60), "yyyy-MM-dd"),
      renewal: rand() < 0.28,
    };
  });
}

const DEALS = makeDeals(10_000);
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dot = (c: string) => <span className="size-2 rounded-full" style={{ background: c }} />;
const initials = (name: string) => (
  <span className="flex size-4 items-center justify-center rounded-full bg-crm-muted text-[9px] font-medium text-crm-soft">
    {name
      .split(" ")
      .map((p) => p[0])
      .join("")}
  </span>
);

const FIELDS: FilterField<Deal>[] = [
  {
    id: "stage",
    label: "Stage",
    type: "enum",
    icon: <CircleDot />,
    options: STAGES.map((s) => ({ value: s, label: s, icon: dot(STAGE_COLOR[s] ?? "#7f7f7f") })),
  },
  {
    id: "owner",
    label: "Owner",
    type: "enum",
    icon: <User />,
    options: OWNERS.map((o) => ({
      value: o,
      label: o,
      icon: initials(o),
      keywords: (o.split(" ")[0] ?? o).toLowerCase() + "@acme.io",
    })),
  },
  { id: "region", label: "Region", type: "enum", icon: <Globe /> },
  { id: "tags", label: "Tags", type: "enum", icon: <Tag /> },
  {
    id: "amount",
    label: "Amount",
    type: "number",
    icon: <DollarSign />,
    format: (n) => usd.format(n),
  },
  {
    id: "close",
    label: "Close date",
    type: "date",
    icon: <CalendarDays />,
    accessor: (d) => d.closeDate,
  },
  { id: "company", label: "Company", type: "text", icon: <Building2 /> },
  { id: "renewal", label: "Renewal", type: "boolean", icon: <RefreshCw /> },
];

const VIEWS: SavedView[] = [
  { id: "all", name: "All deals", filters: [], locked: true },
  {
    id: "open",
    name: "Open pipeline",
    locked: true,
    filters: [{ id: "v1", field: "stage", operator: "is_not", values: ["Won", "Lost"] }],
  },
  {
    id: "big-emea",
    name: "EMEA > $100k closing soon",
    filters: [
      { id: "v2", field: "region", operator: "is", values: ["EMEA"] },
      { id: "v3", field: "amount", operator: "gt", values: ["100000"] },
      { id: "v4", field: "close", operator: "last_days", values: ["90"] },
    ],
  },
];

function DealList({ deals, stale }: { deals: Deal[]; stale: boolean }) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: deals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });
  if (!deals.length)
    return (
      <div className="flex h-[440px] flex-col items-center justify-center gap-1 text-sm text-crm-muted-fg">
        No deals match these filters
        <span className="text-xs text-crm-subtle">Try removing a filter or press ⌘Z to undo</span>
      </div>
    );
  return (
    <div
      ref={parentRef}
      className={`h-[440px] overflow-auto transition-opacity ${stale ? "opacity-60" : ""}`}
      role="table"
      aria-rowcount={deals.length}
    >
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((item) => {
          const d = deals[item.index];
          if (!d) return null;
          return (
            <div
              key={d.id}
              role="row"
              className="absolute inset-x-0 grid grid-cols-[1.4fr_1fr_1fr_1fr_110px_110px] items-center gap-3 border-b border-crm-border px-4 text-[13px]"
              style={{ height: item.size, transform: `translateY(${item.start}px)` }}
            >
              <span role="cell" className="truncate text-crm-fg">
                {d.company}
              </span>
              <span role="cell" className="flex items-center gap-1.5 text-crm-chip">
                {dot(STAGE_COLOR[d.stage] ?? "#7f7f7f")}
                {d.stage}
              </span>
              <span role="cell" className="truncate text-crm-soft">
                {d.owner}
              </span>
              <span role="cell" className="truncate text-crm-muted-fg">
                {d.region}
              </span>
              <span role="cell" className="text-right tabular-nums text-crm-fg">
                {usd.format(d.amount)}
              </span>
              <span role="cell" className="text-right tabular-nums text-crm-muted-fg">
                {format(new Date(d.closeDate), "MMM d, yy")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealsPage() {
  const [filters, setFilters] = useUrlFilters("filters");
  const [views, setViews] = React.useState(VIEWS);
  const { rows, facets, options, stale } = useFilteredRows(DEALS, FIELDS, filters);
  const total = React.useMemo(() => rows.reduce((s, d) => s + d.amount, 0), [rows]);
  return (
    <div className="w-full overflow-hidden rounded-crm border border-crm-border bg-crm-bg">
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-sm font-medium text-crm-fg">Deals</h2>
        <span className="text-xs tabular-nums text-crm-muted-fg">
          {usd.format(total)} total value
        </span>
      </div>
      <ProFilterBar
        fields={FIELDS}
        value={filters}
        onChange={setFilters}
        options={options}
        facets={facets}
        views={views}
        onViewsChange={setViews}
        resultCount={rows.length}
        totalCount={DEALS.length}
        loading={stale}
      />
      <DealList deals={rows} stale={stale} />
    </div>
  );
}

export default function Example() {
  return (
    <NuqsAdapter>
      <DealsPage />
    </NuqsAdapter>
  );
}
