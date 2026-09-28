import * as React from "react";
import { Button } from "@/components/crm/button";
import {
  AddressForm,
  validateAddress,
  type Address,
  type AddressErrors,
} from "@/components/crm/address-form";

const shipping: Address = {
  country: "US",
  line1: "1450 W Fulton Market",
  line2: "Suite 400",
  city: "Chicago",
  region: "IL",
  postalCode: "60607",
};

export default function Example() {
  const [billing, setBilling] = React.useState<Address>({
    country: "GB",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
  });
  const [errors, setErrors] = React.useState<AddressErrors>(validateAddress(billing));
  const [submitted, setSubmitted] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <form
      noValidate
      className="flex w-full max-w-[560px] flex-col gap-4 rounded-xl border border-crm-border bg-crm-sidebar p-5 font-crm"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        setSaved(Object.keys(errors).length === 0);
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-crm-fg">Billing address</h3>
        <p className="mt-1 text-xs text-crm-subtle">
          Printed on invoices for Acme Logistics. Postal format follows the selected country.
        </p>
      </div>
      <AddressForm
        idPrefix="billing"
        value={billing}
        onChange={(a, errs) => {
          setBilling(a);
          setErrors(errs);
          setSaved(false);
        }}
        showAllErrors={submitted}
        copyFrom={{ label: "shipping address", address: shipping }}
      />
      <div className="flex items-center justify-end gap-3">
        {submitted ? (
          <span className="text-xs text-crm-subtle" role="status">
            {saved ? "Saved" : `${Object.keys(errors).length} field(s) need attention`}
          </span>
        ) : null}
        <Button type="submit" variant="primary">
          Save address
        </Button>
      </div>
    </form>
  );
}
