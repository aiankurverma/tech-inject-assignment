import { useState } from "react";
import { SegmentedMeter } from "@/components/crm/segmented-meter";
import { Slider } from "@/components/crm/slider";

export default function Example() {
  const [value, setValue] = useState(50);
  return (
    <div className="flex w-[420px] flex-col gap-3">
      <Slider label="Win probability" value={value} onValueChange={setValue} />
      <SegmentedMeter
        value={value}
        segments={42}
        size="md"
        label="Win probability"
        className="w-full"
      />
    </div>
  );
}
