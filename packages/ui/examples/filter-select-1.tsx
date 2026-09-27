import { useState } from "react";
import { FilterSelect } from "@/components/crm/filter-select";

export default function Example() {
  const [sort, setSort] = useState("Pipeline Value");
  const [owner, setOwner] = useState("All Owners");
  const [stage, setStage] = useState("Any");
  const [days, setDays] = useState("90 Days");
  return (
    <div className="flex flex-wrap gap-2">
      <FilterSelect
        label="Sort by"
        value={sort}
        onValueChange={setSort}
        options={[
          "Pipeline Value",
          "Win Probability",
          "Open Deals",
          "Last Interaction",
          "Company Name",
        ]}
      />
      <FilterSelect
        label="Filter"
        value={owner}
        onValueChange={setOwner}
        options={["All Owners", "Sarah Nguyen", "James Taylor", "Maria Keller"]}
      />
      <FilterSelect
        label="Stage"
        value={stage}
        onValueChange={setStage}
        options={["Any", "Enterprise", "Mid-Market", "SMB", "Pilot", "Renewal"]}
      />
      <FilterSelect
        label="Last Activity"
        value={days}
        onValueChange={setDays}
        options={["7 Days", "30 Days", "90 Days", "All time"]}
      />
    </div>
  );
}
