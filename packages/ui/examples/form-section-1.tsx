import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { FormSection } from "@/components/crm/form-section";

export default function Example() {
  return (
    <FormSection
      title="Company details"
      description="Shown on quotes, invoices and the customer portal."
      className="max-w-xl"
      footer={
        <>
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary">Save changes</Button>
        </>
      }
    >
      <FormField label="Legal name" htmlFor="legal-name" required>
        <Input id="legal-name" defaultValue="Northwind Traders Ltd." />
      </FormField>
      <FormField label="Website" htmlFor="website" hint="Used to fetch the company logo.">
        <Input id="website" defaultValue="northwind.io" aria-describedby="website-msg" />
      </FormField>
    </FormSection>
  );
}
