import { Plus, SearchX } from "lucide-react";
import { Button } from "@/components/crm/button";
import { EmptyState } from "@/components/crm/feedback";

export default function Example() {
  return (
    <EmptyState
      icon={<SearchX />}
      title="No companies match these filters"
      description="Try another stage or owner, or add a new company."
      action={
        <Button variant="primary">
          <Plus /> New Company
        </Button>
      }
    />
  );
}
