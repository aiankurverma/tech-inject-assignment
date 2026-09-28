import * as React from "react";
import { NumberInput } from "@/components/crm/number-input";

export default function Example() {
  const [seats, setSeats] = React.useState<number | null>(25);
  const [discount, setDiscount] = React.useState<number | null>(0.1);
  return (
    <div className="flex w-[260px] flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-crm-soft">Seats</span>
        <NumberInput value={seats} onChange={setSeats} min={1} max={500} aria-label="Seats" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-crm-soft">Discount</span>
        <NumberInput
          value={discount}
          onChange={setDiscount}
          min={0}
          max={0.5}
          step={0.05}
          formatOptions={{ style: "percent" }}
          aria-label="Discount"
        />
      </label>
    </div>
  );
}
