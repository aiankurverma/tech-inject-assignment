import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/crm/button";
import { EmptyState } from "@/components/crm/feedback";

export default function Example() {
  return (
    <EmptyState
      tone="error"
      icon={<AlertTriangle />}
      title="Could not load the pipeline"
      description="Check your connection and try again."
      action={<Button>Retry</Button>}
    />
  );
}
