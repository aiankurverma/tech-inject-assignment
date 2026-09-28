import * as React from "react";
import { AgencyClients, type AgencyClient } from "@/components/crm/agency-clients";

const clients: AgencyClient[] = [
  {
    id: "c1",
    name: "Northwind Outfitters",
    industry: "Retail",
    accountLead: "Priya Shah",
    status: "active",
    retainer: 18000,
    hoursIncluded: 120,
    hoursUsed: 131.5,
    outstanding: 18000,
    oldestInvoiceDays: 12,
    renewsOn: "2026-11-15",
  },
  {
    id: "c2",
    name: "Helio Health",
    industry: "Healthcare",
    accountLead: "Marcus Lee",
    status: "active",
    retainer: 24500,
    hoursIncluded: 160,
    hoursUsed: 118,
    outstanding: 49000,
    oldestInvoiceDays: 44,
    renewsOn: "2027-03-01",
  },
  {
    id: "c3",
    name: "Brightline Fintech",
    industry: "Financial services",
    accountLead: "Priya Shah",
    status: "onboarding",
    retainer: 12000,
    hoursIncluded: 80,
    hoursUsed: 22.5,
    outstanding: 0,
    oldestInvoiceDays: 0,
    renewsOn: "2027-09-01",
  },
  {
    id: "c4",
    name: "Cedar & Pine Hotels",
    industry: "Hospitality",
    accountLead: "Dana Ortiz",
    status: "active",
    retainer: 9500,
    hoursIncluded: 60,
    hoursUsed: 57,
    outstanding: 9500,
    oldestInvoiceDays: 5,
    renewsOn: "2026-10-20",
  },
  {
    id: "c5",
    name: "Orbit Logistics",
    industry: "Logistics",
    accountLead: "Marcus Lee",
    status: "paused",
    retainer: 6000,
    hoursIncluded: 40,
    hoursUsed: 3,
    outstanding: 6000,
    oldestInvoiceDays: 67,
    renewsOn: "2026-09-10",
  },
  {
    id: "c6",
    name: "Kinfolk Coffee Co.",
    industry: "Food & beverage",
    accountLead: "Dana Ortiz",
    status: "active",
    retainer: 4800,
    hoursIncluded: 32,
    hoursUsed: 30,
    outstanding: 0,
    oldestInvoiceDays: 0,
    renewsOn: "2027-01-31",
  },
];

export default function Example() {
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <div className="flex w-[1000px] flex-col gap-2">
      <AgencyClients
        clients={clients}
        today={new Date(2026, 8, 28)}
        onOpenClient={(c) => setOpen(c.name)}
      />
      <p className="text-xs text-crm-soft" aria-live="polite">
        {open ? `Opened ${open}` : "Click a client name to open the record."}
      </p>
    </div>
  );
}
