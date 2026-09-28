import * as React from "react";
import { ReminderChip } from "@/components/crm/reminder-chip";

export default function Example() {
  const now = React.useMemo(() => new Date(), []);
  const [a, setA] = React.useState<Date | null>(new Date(now.getTime() - 26 * 3_600_000));
  const [b, setB] = React.useState<Date | null>(new Date(now.getTime() + 10 * 60_000));
  const [c, setC] = React.useState<Date | null>(new Date(now.getTime() + 3 * 86_400_000));
  const [d, setD] = React.useState<Date | null>(null);
  const [done, setDone] = React.useState(false);
  const rows = [
    { who: "Acme Corp — send revised quote", at: a, set: setA },
    { who: "Globex — confirm pilot start", at: b, set: setB },
    { who: "Initech — renewal check-in", at: c, set: setC },
    { who: "Umbrella — intro call", at: d, set: setD },
  ];
  return (
    <ul className="flex max-w-lg flex-col divide-y divide-crm-border rounded-xl border border-crm-border bg-crm-card font-crm">
      {rows.map((r, i) => (
        <li key={r.who} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="truncate text-sm text-crm-fg">{r.who}</span>
          <ReminderChip
            at={r.at}
            onChange={r.set}
            subject={r.who}
            done={i === 0 ? done : undefined}
            onDone={i === 0 ? () => setDone(true) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
