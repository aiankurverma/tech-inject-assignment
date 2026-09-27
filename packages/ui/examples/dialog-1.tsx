import { Plus } from "lucide-react";
import { Button } from "@/components/crm/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogSection,
  DialogTrigger,
} from "@/components/crm/dialog";
import { FormField, Input } from "@/components/crm/input";

export default function Example() {
  return (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus /> New Company
        </Button>
      </DialogTrigger>
      <DialogContent
        title="New Company"
        description="Add a company to the pipeline. It appears in the list right away."
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button variant="primary">
              <Plus /> Create Company
            </Button>
          </>
        }
      >
        <DialogSection title="Company">
          <FormField label="Company name" htmlFor="dlg-name" required>
            <Input id="dlg-name" placeholder="Acme Inc." />
          </FormField>
        </DialogSection>
        <DialogSection title="Ownership & deal">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Pipeline value" htmlFor="dlg-value">
              <Input id="dlg-value" prefix="$" placeholder="250000" />
            </FormField>
            <FormField label="Open deals" htmlFor="dlg-deals">
              <Input id="dlg-deals" type="number" defaultValue={1} />
            </FormField>
          </div>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
}
