import * as React from "react";
import { SaasAccounts, type SaasAccount } from "@/components/crm/saas-accounts";
import { Button } from "@/components/crm/button";

const accounts: SaasAccount[] = [
  {
    id: "a1",
    name: "Acme Robotics",
    domain: "acmerobotics.io",
    plan: "enterprise",
    arr: 186000,
    seatsPurchased: 250,
    seatsActive: 238,
    health: 82,
    owner: "Nora Diaz",
    lastActiveDays: 0,
    openTickets: 2,
  },
  {
    id: "a2",
    name: "Lumen Analytics",
    domain: "lumen.ai",
    plan: "growth",
    arr: 42000,
    seatsPurchased: 60,
    seatsActive: 21,
    health: 34,
    owner: "Sam Patel",
    lastActiveDays: 3,
    openTickets: 7,
  },
  {
    id: "a3",
    name: "Fernbrook Legal",
    domain: "fernbrook.law",
    plan: "growth",
    arr: 28800,
    seatsPurchased: 40,
    seatsActive: 38,
    health: 76,
    owner: "Nora Diaz",
    lastActiveDays: 1,
    openTickets: 0,
  },
  {
    id: "a4",
    name: "Quill & Co",
    domain: "quill.co",
    plan: "starter",
    arr: 5400,
    seatsPurchased: 10,
    seatsActive: 4,
    health: 52,
    owner: "Ivan Rossi",
    lastActiveDays: 22,
    openTickets: 1,
  },
  {
    id: "a5",
    name: "Meridian Freight",
    domain: "meridianfreight.com",
    plan: "enterprise",
    arr: 124000,
    seatsPurchased: 180,
    seatsActive: 131,
    health: 64,
    owner: "Sam Patel",
    lastActiveDays: 0,
    openTickets: 3,
  },
  {
    id: "a6",
    name: "Tidepool Studios",
    domain: "tidepool.studio",
    plan: "starter",
    arr: 3600,
    seatsPurchased: 5,
    seatsActive: 5,
    health: 88,
    owner: "Ivan Rossi",
    lastActiveDays: 0,
    openTickets: 0,
  },
];

export default function Example() {
  const [log, setLog] = React.useState("");
  return (
    <div className="flex w-[1100px] flex-col gap-2">
      <SaasAccounts
        accounts={accounts}
        bulkActions={(ids) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setLog(`Queued QBR for ${ids.length} accounts`)}
          >
            Schedule QBR
          </Button>
        )}
      />
      <p className="text-xs text-crm-soft" aria-live="polite">
        {log}
      </p>
    </div>
  );
}
