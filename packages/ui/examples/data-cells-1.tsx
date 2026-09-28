import { ContactLine, DateCell, MoneyValue } from "@/components/crm/data-cells";

const rows = [
  { label: "Pipeline value", cell: <MoneyValue amount={530111} /> },
  { label: "Last interaction", cell: <DateCell date="Mar 12" type="Exec" /> },
  {
    label: "Primary contact",
    cell: <ContactLine email="alex.santos@crm.com" phone="+1 (202) 203-5668" />,
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-lg rounded-crm border border-crm-border bg-crm-card font-crm">
      <div className="flex items-center gap-3 border-b border-crm-border px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-crm-raised text-xs font-medium text-crm-fg">
          AS
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-crm-fg">Apple · Enterprise renewal</p>
          <p className="text-xs text-crm-soft">Owned by Alex Santos</p>
        </div>
      </div>
      <dl className="divide-y divide-crm-border px-4">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center">
            <dt className="w-36 shrink-0 text-xs text-crm-subtle">{r.label}</dt>
            <dd className="min-w-0">{r.cell}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
