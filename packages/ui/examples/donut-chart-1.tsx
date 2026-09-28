import * as React from "react";
import { DonutChart } from "@/components/crm/donut-chart";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const sources = [
  { key: "outbound", label: "Outbound SDR", value: 1240000 },
  { key: "inbound", label: "Inbound demo request", value: 980000 },
  { key: "partner", label: "Partner referral", value: 610000 },
  { key: "events", label: "Events", value: 290000 },
  { key: "expansion", label: "Customer expansion", value: 455000 },
  { key: "paid", label: "Paid social", value: 120000 },
  { key: "webinar", label: "Webinars", value: 85000 },
  { key: "other", label: "Unattributed", value: 40000 },
];

export default function Example() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const seg = sources.find((s) => s.key === selected);
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <DonutChart
        label="Open pipeline by source"
        data={sources}
        centerLabel="Open pipeline"
        formatValue={(v) => usd.format(v)}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <p className="font-crm text-xs text-crm-subtle">
        {seg
          ? `Filtering deals table to ${seg.label}`
          : "Click a segment to filter the deals table"}
      </p>
    </div>
  );
}
