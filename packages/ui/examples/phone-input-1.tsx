import * as React from "react";
import { PhoneInput, type PhoneValue } from "@/components/crm/phone-input";

export default function Example() {
  const [mobile, setMobile] = React.useState<PhoneValue | null>(null);
  const [office, setOffice] = React.useState("+442079460958");
  return (
    <form
      className="flex w-[360px] flex-col gap-4 font-crm"
      onSubmit={(e) => e.preventDefault()}
      aria-label="Contact phone numbers"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mobile" className="text-xs text-crm-soft">
          Mobile
        </label>
        <PhoneInput
          id="mobile"
          name="mobile"
          defaultCountry="US"
          preferred={["US", "GB", "IN"]}
          onChange={setMobile}
        />
        <p className="text-[11px] text-crm-subtle">
          Tip: paste an international number like +91 98765 43210 to switch country.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="office" className="text-xs text-crm-soft">
          Office (controlled)
        </label>
        <PhoneInput
          id="office"
          value={office}
          onChange={(v) => setOffice(v.e164)}
          preferred={["GB"]}
        />
      </div>
      <PhoneInput aria-label="Fax (disabled)" defaultValue="+14155550100" disabled />
      <dl className="grid grid-cols-[80px_1fr] gap-y-1 rounded-crm border border-crm-border bg-crm-card p-3 text-xs">
        <dt className="text-crm-subtle">Mobile</dt>
        <dd className="font-mono text-crm-fg">{mobile?.e164 || "—"}</dd>
        <dt className="text-crm-subtle">Valid</dt>
        <dd className={mobile?.valid ? "text-crm-success" : "text-crm-soft"}>
          {mobile ? (mobile.valid ? "Yes" : "Not yet") : "—"}
        </dd>
        <dt className="text-crm-subtle">Office</dt>
        <dd className="font-mono text-crm-fg">{office || "—"}</dd>
      </dl>
    </form>
  );
}
