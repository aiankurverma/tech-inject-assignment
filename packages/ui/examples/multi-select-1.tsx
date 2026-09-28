import * as React from "react";
import { MultiSelect, type MultiSelectOption } from "@/components/crm/multi-select";

const SEGMENTS: MultiSelectOption[] = [
  { value: "enterprise", label: "Enterprise", color: "purple" },
  { value: "mid-market", label: "Mid-market", color: "blue" },
  { value: "smb", label: "SMB", color: "teal" },
  { value: "partner", label: "Partner", color: "green" },
  { value: "churn-risk", label: "Churn risk", color: "red" },
  { value: "expansion", label: "Expansion", color: "amber" },
];

export default function Example() {
  const [segments, setSegments] = React.useState<string[]>(["enterprise", "expansion"]);
  return (
    <div className="flex w-[320px] flex-col gap-1.5">
      <span className="text-xs text-crm-soft">Segments</span>
      <MultiSelect
        options={SEGMENTS}
        value={segments}
        onChange={setSegments}
        placeholder="Filter by segment"
        showActions
        aria-label="Segments"
      />
    </div>
  );
}
