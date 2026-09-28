import { Download, Plus } from "lucide-react";
import { Heading } from "@/components/crm/heading";
import { Button } from "@/components/crm/button";

export default function Example() {
  return (
    <div className="flex w-[560px] max-w-full flex-col gap-8 font-crm">
      <Heading
        level={1}
        size="display"
        eyebrow="Revenue · Q3 FY26"
        description="Committed and best-case pipeline across all regions, refreshed every 15 minutes from Salesforce."
        actions={
          <>
            <Button size="sm">
              <Download /> Export
            </Button>
            <Button size="sm" variant="primary">
              <Plus /> New forecast
            </Button>
          </>
        }
      >
        Forecast overview
      </Heading>
      <div className="flex flex-col gap-3">
        <Heading level={2} anchor meta="12 open">
          Deals at risk
        </Heading>
        <Heading level={3} anchor>
          Billing & invoicing
        </Heading>
        <Heading level={3} truncate className="max-w-[260px]">
          Enterprise renewal — Northwind Traders International Holdings (EMEA)
        </Heading>
        <Heading level={4} tone="muted">
          Archived workspaces
        </Heading>
      </div>
    </div>
  );
}
