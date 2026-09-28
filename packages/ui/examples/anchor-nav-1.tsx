import * as React from "react";
import { AnchorNav, type AnchorNavSection } from "@/components/crm/anchor-nav";

const sections: AnchorNavSection[] = [
  { id: "an-overview", label: "Overview" },
  { id: "an-contacts", label: "Contacts", count: 6 },
  { id: "an-deals", label: "Open deals", count: 3 },
  { id: "an-deals-q4", label: "Q4 renewals", level: 1 },
  { id: "an-billing", label: "Billing", invalid: true },
  { id: "an-activity", label: "Activity", count: 42 },
  { id: "an-files", label: "Files", count: 9 },
];

const copy: Record<string, string> = {
  "an-overview":
    "Acme Logistics · 420 employees · Chicago, IL. Customer since March 2021, ARR $184,000.",
  "an-contacts":
    "Priya Raman (VP Ops, champion), Tom Becker (IT Director), Lena Ortiz (Procurement) and 3 others.",
  "an-deals": "Fleet tracking expansion — $62,500, Negotiation, closes Nov 14.",
  "an-deals-q4":
    "Core platform renewal — $184,000, Commit, auto-renews Dec 31 unless notice is given.",
  "an-billing": "Tax ID missing on the billing profile; invoices will be held until it is added.",
  "an-activity":
    "Last touch 2 days ago: QBR deck sent by Maya Chen. 42 activities in the last 90 days.",
  "an-files": "MSA (signed), Security questionnaire v3, Q3 QBR deck, 6 more.",
};

export default function Example() {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  return (
    <div className="flex h-[420px] w-full max-w-[820px] gap-6 rounded-xl border border-crm-border bg-crm-bg p-4 font-crm">
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto pr-2">
        {sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="mb-6 min-h-[180px] rounded-xl border border-crm-border bg-crm-card p-4"
          >
            <h3 className="text-sm font-semibold text-crm-fg">{s.label}</h3>
            <p className="mt-2 text-sm text-crm-soft">{copy[s.id]}</p>
          </section>
        ))}
      </div>
      <div className="hidden w-52 shrink-0 sm:block">
        <AnchorNav sections={sections} scrollContainer={scrollRef} offset={0} updateHash={false} />
      </div>
    </div>
  );
}
