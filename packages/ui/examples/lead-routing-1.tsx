import * as React from "react";
import { LeadRouting, type RoutingRule } from "@/components/crm/lead-routing";

export default function Example() {
  const [rules, setRules] = React.useState<RoutingRule[]>([
    {
      id: "ent",
      name: "Enterprise NA",
      enabled: true,
      countries: ["US", "CA"],
      minEmployees: 1000,
      sources: [],
      assignees: ["maya", "omar"],
    },
    {
      id: "emea",
      name: "EMEA mid-market",
      enabled: true,
      countries: ["GB", "DE", "FR"],
      minEmployees: 100,
      maxEmployees: 999,
      sources: [],
      assignees: ["lena"],
    },
    {
      id: "inbound",
      name: "Inbound SMB",
      enabled: true,
      countries: [],
      maxEmployees: 99,
      sources: ["demo", "trial"],
      assignees: ["sam", "priya"],
    },
  ]);
  return (
    <LeadRouting
      rules={rules}
      onRulesChange={setRules}
      fallbackRepId="queue"
      reps={[
        { id: "maya", name: "Maya Chen", openLeads: 38, capacity: 40 },
        { id: "omar", name: "Omar Haddad", openLeads: 22, capacity: 40 },
        { id: "lena", name: "Lena Vogel", openLeads: 15, capacity: 30, outOfOffice: true },
        { id: "sam", name: "Sam Rivera", openLeads: 61, capacity: 80 },
        { id: "priya", name: "Priya Nair", openLeads: 44, capacity: 80 },
        { id: "queue", name: "SDR queue", openLeads: 12, capacity: 500 },
      ]}
      countries={[
        { value: "US", label: "US" },
        { value: "CA", label: "Canada" },
        { value: "GB", label: "UK" },
        { value: "DE", label: "Germany" },
        { value: "FR", label: "France" },
        { value: "IN", label: "India" },
      ]}
      sources={[
        { value: "demo", label: "Demo request" },
        { value: "trial", label: "Free trial" },
        { value: "event", label: "Event" },
        { value: "outbound", label: "Outbound" },
      ]}
    />
  );
}
