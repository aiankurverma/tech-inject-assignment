import * as React from "react";
import { Rating } from "@/components/crm/rating";

export default function Example() {
  const [value, setValue] = React.useState(3);
  return (
    <div className="flex flex-col gap-4 font-crm text-xs text-crm-soft">
      <div className="flex items-center gap-2">
        <Rating value={value} onValueChange={setValue} label="Lead quality" />
        <span>{value ? `${value} / 5` : "Not rated"}</span>
      </div>
      <Rating readOnly value={4.5} size="sm" label="Average rating" />
      <Rating defaultValue={2} size="lg" disabled />
    </div>
  );
}
