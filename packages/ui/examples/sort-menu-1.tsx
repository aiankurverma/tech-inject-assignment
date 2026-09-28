import * as React from "react";
import { SortMenu, type SortRule } from "@/components/crm/sort-menu";

export default function Example() {
  const [rules, setRules] = React.useState<SortRule[]>([
    { field: "amount", direction: "desc" },
    { field: "close", direction: "asc" },
  ]);
  return (
    <div className="flex h-[320px] w-[460px] items-start">
      <SortMenu
        defaultOpen
        value={rules}
        onChange={setRules}
        fields={[
          { value: "name", label: "Deal name" },
          { value: "amount", label: "Amount" },
          { value: "close", label: "Close date" },
          { value: "owner", label: "Owner" },
          { value: "updated", label: "Last activity" },
        ]}
      />
    </div>
  );
}
