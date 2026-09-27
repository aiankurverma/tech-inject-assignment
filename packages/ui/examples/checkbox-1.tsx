import { useState } from "react";
import { Checkbox } from "@/components/crm/checkbox";

const rows = ["Apple", "Snowflake", "Stripe"];

export default function Example() {
  const [picked, setPicked] = useState<string[]>(["Stripe"]);
  const all = picked.length === rows.length ? true : picked.length ? "indeterminate" : false;
  return (
    <div className="flex flex-col gap-3 text-sm text-crm-fg">
      <label className="flex items-center gap-3 text-crm-subtle">
        <Checkbox
          checked={all}
          onCheckedChange={() => setPicked(all === true ? [] : rows)}
          aria-label="Select all"
        />
        Companies
      </label>
      {rows.map((r) => (
        <label key={r} className="flex items-center gap-3">
          <Checkbox
            checked={picked.includes(r)}
            onCheckedChange={(c) => setPicked((p) => (c ? [...p, r] : p.filter((x) => x !== r)))}
          />
          {r}
        </label>
      ))}
      <label className="flex items-center gap-3 opacity-80">
        <Checkbox disabled /> Disabled
      </label>
    </div>
  );
}
