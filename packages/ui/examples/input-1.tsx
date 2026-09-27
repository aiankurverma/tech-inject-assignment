import { useState } from "react";
import { FormField, Input } from "@/components/crm/input";

export default function Example() {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const error = touched && !name ? "Enter a company name." : undefined;
  return (
    <div className="grid w-[420px] gap-4">
      <FormField label="Company name" htmlFor="company" required error={error}>
        <Input
          id="company"
          placeholder="Acme Inc."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          invalid={!!error}
          aria-describedby="company-msg"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Pipeline value" htmlFor="value">
          <Input id="value" prefix="$" inputMode="numeric" placeholder="250000" />
        </FormField>
        <FormField label="Open deals" htmlFor="deals" hint="Whole number">
          <Input id="deals" type="number" defaultValue={1} aria-describedby="deals-msg" />
        </FormField>
      </div>
      <FormField label="Date" htmlFor="date">
        <Input id="date" type="date" defaultValue="2026-09-14" />
      </FormField>
    </div>
  );
}
