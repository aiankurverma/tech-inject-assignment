import * as React from "react";
import { InlineError, useFieldError } from "@/components/crm/inline-error";
import { Input } from "@/components/crm/input";
import { Button } from "@/components/crm/button";

const freeDomains = ["gmail.com", "yahoo.com", "outlook.com"];

export default function Example() {
  const [email, setEmail] = React.useState("");
  const [domain, setDomain] = React.useState("northwind.co");
  const [sent, setSent] = React.useState(false);

  const emailField = useFieldError({
    value: email,
    rules: [
      (v) => !v.trim() && "Work email is required",
      (v) =>
        !!v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && "Enter a valid email like name@company.com",
      (v) =>
        freeDomains.some((d) => v.endsWith(`@${d}`)) && "Use a company address, not a personal one",
    ],
  });
  const suggested = domain.replace(/\.co$/, ".com");

  return (
    <form
      noValidate
      className="w-full max-w-sm space-y-4 font-crm"
      onSubmit={(e) => {
        e.preventDefault();
        emailField.touch();
        setSent(emailField.valid);
      }}
    >
      <div>
        <label htmlFor="inv-email" className="mb-1 block text-xs font-medium text-crm-soft">
          Invite teammate
        </label>
        <Input
          id="inv-email"
          type="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSent(false);
          }}
          {...emailField.inputProps}
        />
        <InlineError {...emailField.errorProps} />
      </div>
      <div>
        <label htmlFor="inv-domain" className="mb-1 block text-xs font-medium text-crm-soft">
          Company domain
        </label>
        <Input
          id="inv-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          aria-describedby="dom-warn"
        />
        <InlineError
          id="dom-warn"
          tone="warning"
          message={
            domain.endsWith(".co")
              ? `No MX records for ${domain}. Did you mean ${suggested}?`
              : null
          }
          action={{ label: `Use ${suggested}`, onClick: () => setDomain(suggested) }}
        />
      </div>
      <Button type="submit" variant="primary">
        Send invite
      </Button>
      {sent && <p className="text-xs text-crm-success">Invite sent to {email}</p>}
    </form>
  );
}
