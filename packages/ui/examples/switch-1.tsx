import * as React from "react";
import { Switch } from "@/components/crm/switch";

export default function Example() {
  const [digest, setDigest] = React.useState(true);
  return (
    <div className="flex w-[360px] flex-col gap-4">
      <Switch
        label="Daily pipeline digest"
        description="Email a summary of deal movement every morning."
        checked={digest}
        onCheckedChange={setDigest}
      />
      <Switch label="Auto-assign new leads" defaultChecked />
      <Switch label="Sync with calendar" size="sm" />
      <Switch label="Two-way Salesforce sync" description="Available on Premium." disabled />
    </div>
  );
}
