import * as React from "react";
import { TimePicker } from "@/components/crm/time-picker";

export default function Example() {
  const [time, setTime] = React.useState<string | null>("10:30");
  return (
    <div className="flex w-[220px] flex-col gap-1.5">
      <label htmlFor="call-time" className="text-xs text-crm-soft">
        Call time
      </label>
      <TimePicker
        id="call-time"
        value={time}
        onChange={setTime}
        interval={15}
        min="08:00"
        max="18:00"
      />
      <span className="text-[11px] text-crm-subtle">Type freely, e.g. &quot;2:45pm&quot;</span>
    </div>
  );
}
