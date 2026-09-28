import * as React from "react";
import { Bell, Globe, Trash2 } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Select } from "@/components/crm/select";
import { SettingsGroup, SettingsRow } from "@/components/crm/settings-row";
import { Switch } from "@/components/crm/switch";

export default function Example() {
  const [digest, setDigest] = React.useState(true);
  return (
    <SettingsGroup heading="Workspace" className="max-w-2xl">
      <SettingsRow
        icon={<Bell />}
        label="Daily digest"
        htmlFor="digest"
        description="Email a summary of deals that moved stage yesterday."
        control={<Switch id="digest" checked={digest} onCheckedChange={setDigest} />}
      />
      <SettingsRow
        icon={<Globe />}
        label="Default currency"
        description="Used for new deals and pipeline totals."
        control={
          <Select
            aria-label="Default currency"
            className="w-32"
            defaultValue="usd"
            options={[
              { value: "usd", label: "USD" },
              { value: "eur", label: "EUR" },
              { value: "inr", label: "INR" },
            ]}
          />
        }
      />
      <SettingsRow
        icon={<Trash2 />}
        danger
        label="Delete workspace"
        description="Permanently removes all records. This cannot be undone."
        control={<Button variant="danger">Delete</Button>}
      />
    </SettingsGroup>
  );
}
