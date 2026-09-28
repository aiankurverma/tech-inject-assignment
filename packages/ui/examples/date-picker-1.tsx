import * as React from "react";
import { DatePicker } from "@/components/crm/date-picker";

export default function Example() {
  const [date, setDate] = React.useState<Date | null>(null);
  return (
    <div className="flex w-[260px] flex-col gap-2">
      <span className="text-xs text-crm-soft">Expected close date</span>
      <DatePicker
        value={date}
        onChange={setDate}
        aria-label="Expected close date"
        min={new Date()}
      />
    </div>
  );
}
