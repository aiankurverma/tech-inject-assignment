import { MoreHorizontal } from "lucide-react";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/crm/card";

export default function Example() {
  return (
    <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader
          title="Acme Corp renewal"
          description="Negotiation · closes in 12 days"
          action={
            <button
              type="button"
              aria-label="More actions"
              className="grid size-7 cursor-pointer place-items-center rounded-md text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <MoreHorizontal className="size-4" />
            </button>
          }
        />
        <CardBody>
          <div className="text-2xl font-medium text-crm-fg">$48,000</div>
          <p className="mt-1 text-xs text-crm-muted-fg">3-year term, SSO included</p>
        </CardBody>
        <CardFooter>
          <button
            type="button"
            className="h-7 cursor-pointer rounded-md px-2.5 text-xs text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            View deal
          </button>
        </CardFooter>
      </Card>
      <Card variant="raised" interactive tabIndex={0}>
        <CardHeader title="Pipeline health" bordered />
        <CardBody>Clickable raised card with a bordered header.</CardBody>
      </Card>
    </div>
  );
}
