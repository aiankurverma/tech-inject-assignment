import * as React from "react";
import { Calendar } from "@/components/crm/date-picker";

export default function Example() {
  const [date, setDate] = React.useState<Date>(() => new Date());
  return (
    <div className="rounded-xl border border-crm-border bg-crm-popover p-3">
      <Calendar value={date} onChange={setDate} />
    </div>
  );
}
