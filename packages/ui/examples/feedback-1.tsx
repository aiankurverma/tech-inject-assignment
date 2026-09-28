import { Skeleton } from "@/components/crm/feedback";

const loaded = [
  { name: "Northwind Logistics", owner: "Priya Raman", arr: "$184K" },
  { name: "Brightline Health", owner: "Marcus Lee", arr: "$72.5K" },
];

export default function Example() {
  return (
    <div className="w-[440px] rounded-xl border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-crm-fg">Companies</p>
        <p className="text-xs text-crm-soft">Loading 3 more…</p>
      </div>
      <ul className="flex flex-col divide-y divide-crm-border">
        {loaded.map((c) => (
          <li key={c.name} className="flex items-center gap-3 py-2.5">
            <span className="grid size-6 place-items-center rounded-full bg-crm-muted text-[10px] font-medium text-crm-fg">
              {c.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-crm-fg">{c.name}</p>
              <p className="text-xs text-crm-soft">{c.owner}</p>
            </div>
            <span className="text-sm font-medium text-crm-fg tabular-nums">{c.arr}</span>
          </li>
        ))}
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="flex items-center gap-3 py-2.5"
            aria-busy="true"
            aria-label="Loading company"
          >
            <Skeleton className="size-6 rounded-full border border-crm-border" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-3/5 border border-crm-border" />
              <Skeleton className="h-2.5 w-2/5 border border-crm-border" />
            </div>
            <Skeleton className="h-3 w-12 border border-crm-border" />
          </li>
        ))}
      </ul>
    </div>
  );
}
