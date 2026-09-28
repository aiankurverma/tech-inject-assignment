import { useState } from "react";
import { UpgradeBanner } from "@/components/crm/upgrade-banner";

export default function Example() {
  const [contacts, setContacts] = useState(8_620);
  const [log, setLog] = useState<string>();
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 font-crm">
      <UpgradeBanner
        plan="Starter"
        targetPlan="Growth"
        targetPrice="$49/seat/mo"
        usage={[
          { label: "Contacts", used: contacts, limit: 10_000 },
          { label: "Seats", used: 4, limit: 5 },
          { label: "Emails this month", used: 1_940, limit: 5_000 },
        ]}
        features={["Unlimited pipelines", "Sequences", "Forecast reports", "Salesforce sync"]}
        onUpgrade={() =>
          new Promise<void>((r) => setTimeout(() => (setLog("Checkout opened"), r()), 900))
        }
        onDismiss={(d) => setLog(d ? `Snoozed ${d} day(s)` : "Hidden for this session")}
      />
      <UpgradeBanner
        variant="card"
        plan="Starter"
        targetPlan="Growth"
        trialDaysLeft={3}
        features={["Workflow automation", "Custom dashboards"]}
        onUpgrade={() => Promise.reject(new Error("Card declined — update your payment method."))}
        onDismiss={() => undefined}
      />
      <div className="flex items-center gap-3 text-xs text-crm-soft">
        <label className="flex items-center gap-2">
          Contacts used
          <input
            type="range"
            min={2_000}
            max={11_000}
            step={100}
            value={contacts}
            onChange={(e) => setContacts(Number(e.target.value))}
          />
        </label>
        <span className="tabular-nums">{contacts.toLocaleString()}</span>
        {log ? <span className="text-crm-success">{log}</span> : null}
      </div>
    </div>
  );
}
