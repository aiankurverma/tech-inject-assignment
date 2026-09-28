import { Sparkline, TrendStat } from "@/components/crm/sparkline";

const rows = [
  {
    name: "Acme Corp",
    owner: "Priya S.",
    data: [2, 5, 1, 3, 6, 4, 7, 5, 8, 6, 9, 7],
    total: "63 touches",
  },
  {
    name: "Globex",
    owner: "Marco L.",
    data: [6, 5, 7, 4, 5, 3, 4, 2, 3, 2, 1, 2],
    total: "44 touches",
  },
  {
    name: "Initech",
    owner: "Dana K.",
    data: [1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 8],
    total: "47 touches",
  },
];

export default function Example() {
  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-crm-fg">
      <div>
        <p className="text-xs font-medium text-crm-soft">Meetings booked · last 11 weeks</p>
        <TrendStat
          className="mt-2"
          value={90}
          data={[1, 3, 2, 1, 4, 3, 5, 4, 6, 5, 7]}
          caption="Spikes around QBR prep and renewal review"
        />
      </div>
      <div className="border-t border-crm-border pt-3">
        <p className="mb-2 text-xs font-medium text-crm-soft">Account engagement · 12 weeks</p>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-crm-soft">{r.owner}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Sparkline data={r.data} label={`${r.name} weekly engagement`} />
                <span className="w-20 text-right text-xs tabular-nums text-crm-soft">
                  {r.total}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
