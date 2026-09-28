import * as React from "react";
import { TreeTable, type TreeColumn, type TreeRow } from "@/components/crm/tree-table";

interface Account extends TreeRow {
  name: string;
  region: string;
  arr?: number;
  seats?: number;
  children?: Account[];
}

const rows: Account[] = [
  {
    id: "acme",
    name: "Acme Holdings",
    region: "Global",
    children: [
      {
        id: "acme-na",
        name: "Acme North America",
        region: "NA",
        children: [
          { id: "acme-us", name: "Acme Inc. (US)", region: "NA", arr: 420_000, seats: 380 },
          { id: "acme-ca", name: "Acme Canada Ltd.", region: "NA", arr: 86_000, seats: 64 },
        ],
      },
      {
        id: "acme-eu",
        name: "Acme Europe",
        region: "EMEA",
        children: [
          { id: "acme-de", name: "Acme GmbH", region: "EMEA", arr: 142_000, seats: 120 },
          { id: "acme-uk", name: "Acme UK Ltd.", region: "EMEA", arr: 98_500, seats: 75 },
        ],
      },
      { id: "acme-in", name: "Acme India Pvt. Ltd.", region: "APAC", arr: 54_000, seats: 90 },
    ],
  },
  {
    id: "globex",
    name: "Globex Group",
    region: "Global",
    children: [
      { id: "globex-us", name: "Globex Corp", region: "NA", arr: 210_000, seats: 150 },
      { id: "globex-sg", name: "Globex Singapore", region: "APAC", arr: 38_000, seats: 25 },
    ],
  },
  { id: "initech", name: "Initech", region: "NA", arr: 64_000, seats: 40 },
];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const columns: TreeColumn<Account>[] = [
  { key: "name", header: "Account" },
  { key: "region", header: "Region", width: "90px" },
  { key: "seats", header: "Seats", aggregate: "sum", align: "right", width: "90px" },
  {
    key: "arr",
    header: "ARR",
    aggregate: "sum",
    align: "right",
    width: "120px",
    format: (v) => usd.format(v),
  },
];

export default function Example() {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<Account | null>(null);
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search accounts…"
        aria-label="Search accounts"
        className="h-8 w-60 rounded-full border border-crm-border bg-crm-raised px-3 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus:border-crm-ring"
      />
      <TreeTable
        rows={rows}
        columns={columns}
        defaultExpanded={["acme"]}
        filter={q}
        label="Account hierarchy"
        onRowClick={setOpen}
      />
      <p className="text-xs text-crm-muted-fg" aria-live="polite">
        {open ? `Selected ${open.name}` : "Tip: use arrow keys to walk the hierarchy."}
      </p>
    </div>
  );
}
