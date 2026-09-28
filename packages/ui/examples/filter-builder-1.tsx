import * as React from "react";
import { FilterBuilder, type FilterGroup } from "@/components/crm/filter-builder";

export default function Example() {
  const [filters, setFilters] = React.useState<FilterGroup>({
    conjunction: "and",
    rules: [
      { id: "r1", field: "stage", operator: "is", value: "proposal" },
      { id: "r2", field: "amount", operator: "gt", value: "10000" },
    ],
  });
  return (
    <FilterBuilder
      className="max-w-3xl"
      value={filters}
      onChange={setFilters}
      onApply={(v) => console.log("apply", v)}
      fields={[
        { value: "name", label: "Deal name", type: "text" },
        { value: "amount", label: "Amount", type: "number" },
        { value: "close", label: "Close date", type: "date" },
        {
          value: "stage",
          label: "Stage",
          type: "select",
          options: [
            { value: "qualified", label: "Qualified" },
            { value: "proposal", label: "Proposal" },
            { value: "won", label: "Closed won" },
          ],
        },
      ]}
    />
  );
}
