import * as React from "react";
import { Building2, Handshake, Users } from "lucide-react";
import { SegmentedControl } from "@/components/crm/segmented-control";

export default function Example() {
  const [range, setRange] = React.useState("30d");
  return (
    <div className="flex w-[420px] flex-col gap-4 font-crm text-crm-fg">
      <SegmentedControl
        label="Records"
        defaultValue="deals"
        options={[
          { value: "companies", label: "Companies", icon: <Building2 />, count: 18 },
          { value: "deals", label: "Deals", icon: <Handshake />, count: 90 },
          { value: "people", label: "People", icon: <Users />, count: 214 },
        ]}
      />
      <SegmentedControl
        label="Date range"
        size="sm"
        fullWidth
        value={range}
        onValueChange={setRange}
        options={[
          { value: "7d", label: "7 days" },
          { value: "30d", label: "30 days" },
          { value: "90d", label: "Quarter" },
          { value: "1y", label: "Year", disabled: true },
        ]}
      />
    </div>
  );
}
