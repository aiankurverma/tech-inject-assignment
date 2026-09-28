import * as React from "react";
import { PlanSwitcher, type BillingInterval } from "@/components/crm/plan-switcher";

export default function Example() {
  const [interval, setInterval] = React.useState<BillingInterval>("monthly");
  const seats = 25;
  const monthly = 49 * seats;
  const yearly = 39 * 12 * seats;
  return (
    <div className="flex flex-col items-center gap-3">
      <PlanSwitcher
        value={interval}
        onValueChange={setInterval}
        monthlyPrice={monthly}
        yearlyPrice={yearly}
      />
      <p className="text-xs text-crm-soft">
        Growth plan, {seats} seats:{" "}
        <span className="text-crm-fg">
          {interval === "yearly"
            ? `$${yearly.toLocaleString()} / year`
            : `$${monthly.toLocaleString()} / month`}
        </span>
      </p>
      <PlanSwitcher defaultValue="yearly" yearlyDiscount={15} disabled label="Locked interval" />
    </div>
  );
}
