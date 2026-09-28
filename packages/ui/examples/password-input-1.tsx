import * as React from "react";
import { PasswordInput } from "@/components/crm/password-input";

export default function Example() {
  const [pw, setPw] = React.useState("");
  return (
    <div className="flex w-[280px] flex-col gap-1.5">
      <label htmlFor="new-password" className="text-xs text-crm-soft">
        New password
      </label>
      <PasswordInput
        id="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="new-password"
        placeholder="At least 12 characters"
        showStrength
      />
    </div>
  );
}
