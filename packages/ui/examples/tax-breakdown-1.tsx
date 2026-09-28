import { useState } from "react";
import { TaxBreakdown, type TaxableLine, type TaxRate } from "@/components/crm/tax-breakdown";

const lines: TaxableLine[] = [
  { id: "l1", description: "Growth plan · 25 seats × 12 mo", amount: 10_500 },
  { id: "l2", description: "Onboarding & data migration", amount: 2_400 },
  { id: "l3", description: "Premium support (exported service)", amount: 1_800, exempt: true },
];

const regions: Record<string, { label: string; rates: TaxRate[] }> = {
  in: {
    label: "India · intra-state",
    rates: [
      { id: "cgst", label: "CGST", rate: 9, jurisdiction: "Central" },
      { id: "sgst", label: "SGST", rate: 9, jurisdiction: "Karnataka" },
    ],
  },
  qc: {
    label: "Canada · Québec",
    rates: [
      { id: "gst", label: "GST", rate: 5, jurisdiction: "Federal" },
      { id: "qst", label: "QST", rate: 9.975, jurisdiction: "QC" },
    ],
  },
  ca: {
    label: "US · San Francisco",
    rates: [
      { id: "state", label: "State sales tax", rate: 7.25, jurisdiction: "CA" },
      { id: "local", label: "District tax", rate: 1.375, jurisdiction: "San Francisco" },
    ],
  },
};

export default function Example() {
  const [region, setRegion] = useState("in");
  const [inclusive, setInclusive] = useState(false);
  const [reverse, setReverse] = useState(false);
  return (
    <div className="flex w-full max-w-md flex-col gap-3 font-crm">
      <div className="flex flex-wrap items-center gap-3 text-xs text-crm-soft">
        <select
          aria-label="Tax region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-8 rounded-crm border border-crm-border bg-crm-raised px-2 text-crm-fg"
        >
          {Object.entries(regions).map(([k, r]) => (
            <option key={k} value={k}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={inclusive}
            onChange={(e) => setInclusive(e.target.checked)}
          />
          Tax-inclusive prices
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
          Reverse charge
        </label>
      </div>
      <TaxBreakdown
        lines={lines}
        rates={regions[region]?.rates ?? []}
        currency={region === "in" ? "INR" : region === "qc" ? "CAD" : "USD"}
        locale={region === "in" ? "en-IN" : "en-US"}
        inclusive={inclusive}
        exemptReason={
          reverse
            ? "Reverse charge: VAT to be accounted for by the recipient (Art. 196)."
            : undefined
        }
      />
    </div>
  );
}
