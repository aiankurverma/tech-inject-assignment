import * as React from "react";
import { FilterChips, type ActiveFilter } from "@/components/crm/filter-chips";

const initial: ActiveFilter[] = [
  { id: "stage", field: "Stage", value: "Proposal, Negotiation" },
  { id: "owner", field: "Owner", value: "Maya Chen" },
  { id: "amount", field: "Amount", operator: ">", value: "$50,000" },
  { id: "region", field: "Region", operator: "is not", value: "APAC" },
];

export default function Example() {
  const [filters, setFilters] = React.useState(initial);
  return (
    <div className="w-[560px]">
      <FilterChips
        filters={filters}
        onRemove={(id) => setFilters((f) => f.filter((x) => x.id !== id))}
        onClearAll={() => setFilters([])}
        onAdd={() => setFilters(initial)}
      />
    </div>
  );
}
