import * as React from "react";
import { ColorPicker, ColorSwatches } from "@/components/crm/color-picker";
import { Tag, type TagColor } from "@/components/crm/tag";

export default function Example() {
  const [stage, setStage] = React.useState<TagColor>("blue");
  const [label, setLabel] = React.useState<TagColor>("green");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <ColorPicker value={stage} onChange={setStage} title="Stage colour" />
        <Tag color={stage}>Negotiation</Tag>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs text-crm-soft">Label colour</span>
        <ColorSwatches value={label} onChange={setLabel} aria-label="Label colour" />
      </div>
    </div>
  );
}
