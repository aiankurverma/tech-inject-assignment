import * as React from "react";
import { ResizablePanels } from "@/components/crm/resizable-panels";

const tickets = [
  { id: "T-1042", subject: "Invoice shows wrong seat count", customer: "Globex", priority: "High" },
  { id: "T-1041", subject: "SSO login loop on Safari", customer: "Initech", priority: "Urgent" },
  {
    id: "T-1039",
    subject: "Export to CSV missing columns",
    customer: "Umbrella",
    priority: "Normal",
  },
  { id: "T-1036", subject: "Webhook retries not firing", customer: "Hooli", priority: "High" },
];

export default function Example() {
  const [selected, setSelected] = React.useState(tickets[0]!);
  const [sizes, setSizes] = React.useState<number[]>([]);

  return (
    <div className="w-full space-y-2 font-crm">
      <div className="h-80">
        <ResizablePanels
          storageKey="example-inbox-layout"
          onSizesChange={setSizes}
          panels={[
            {
              id: "list",
              label: "Resize ticket list",
              defaultSize: 32,
              minSize: 22,
              maxSize: 50,
              content: (
                <ul role="listbox" aria-label="Tickets" className="divide-y divide-crm-border">
                  {tickets.map((t) => (
                    <li
                      key={t.id}
                      role="option"
                      aria-selected={selected.id === t.id}
                      tabIndex={0}
                      onClick={() => setSelected(t)}
                      onKeyDown={(e) => e.key === "Enter" && setSelected(t)}
                      className={`cursor-pointer px-3 py-2 text-sm outline-none focus-visible:bg-crm-muted ${
                        selected.id === t.id ? "bg-crm-muted" : "hover:bg-crm-raised"
                      }`}
                    >
                      <p className="truncate text-crm-fg">{t.subject}</p>
                      <p className="crm-caption">
                        {t.id} · {t.customer}
                      </p>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              id: "detail",
              label: "Resize customer sidebar",
              defaultSize: 44,
              minSize: 30,
              content: (
                <div className="space-y-2 p-4">
                  <span className="crm-eyebrow">{selected.id}</span>
                  <h3 className="text-base font-semibold text-crm-fg">{selected.subject}</h3>
                  <p className="text-sm text-crm-soft">
                    Priority <strong className="text-crm-fg">{selected.priority}</strong> · opened
                    by {selected.customer}
                  </p>
                </div>
              ),
            },
            {
              id: "context",
              defaultSize: 24,
              minSize: 18,
              collapsible: true,
              collapsedSize: 0,
              content: (
                <div className="space-y-1 p-4 text-sm">
                  <span className="crm-eyebrow">Customer</span>
                  <p className="text-crm-fg">{selected.customer}</p>
                  <p className="crm-caption">Plan: Growth · ARR $36k · Health 72</p>
                </div>
              ),
            },
          ]}
        />
      </div>
      <p className="crm-caption">
        Drag or focus a divider and use arrow keys (Shift for bigger steps). Double-click or Enter
        on the right divider collapses the customer sidebar.{" "}
        {sizes.length ? `Layout: ${sizes.map((s) => Math.round(s)).join(" / ")}%` : ""}
      </p>
    </div>
  );
}
