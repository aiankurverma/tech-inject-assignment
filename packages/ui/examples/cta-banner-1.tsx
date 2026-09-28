import * as React from "react";
import { CtaBanner } from "@/components/crm/cta-banner";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  const [deadline] = React.useState(() => new Date(Date.now() + 3 * 86_400_000 + 5 * 3_600_000));
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <CtaBanner
        eyebrow="Annual plan · 20% off"
        title="Lock in Pro pricing before the Q4 price change"
        description="Get the forecasting add-on free for your first year. Work email required."
        actionLabel="Send me the offer"
        requireWorkEmail
        expiresAt={deadline}
        onSubmitEmail={async (email) => {
          await wait(900);
          if (email.endsWith("@example.com"))
            throw new Error("This domain is already on an enterprise contract.");
        }}
        onDismiss={() => console.log("dismissed")}
      />
      <CtaBanner
        tone="neutral"
        title="Ready to move your pipeline off spreadsheets?"
        description="Import from CSV, HubSpot or Salesforce in under 10 minutes."
        actionLabel="Start free trial"
        secondaryLabel="Book a demo"
        onAction={() => console.log("trial")}
        onSecondary={() => console.log("demo")}
      />
    </div>
  );
}
