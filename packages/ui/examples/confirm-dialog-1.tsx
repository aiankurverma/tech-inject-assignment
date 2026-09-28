import { Trash2 } from "lucide-react";
import { Button } from "@/components/crm/button";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";

export default function Example() {
  return (
    <ConfirmDialog
      defaultOpen
      trigger={
        <Button variant="danger">
          <Trash2 /> Delete company
        </Button>
      }
      title="Delete Acme Inc.?"
      description="This removes the company, its 4 open deals and all activity. This cannot be undone."
      confirmLabel="Delete company"
      confirmText="Acme Inc."
      onConfirm={() => new Promise((resolve) => setTimeout(resolve, 800))}
    />
  );
}
