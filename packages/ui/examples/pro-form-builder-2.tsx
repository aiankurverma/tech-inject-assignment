import * as React from "react";
import { ProFormBuilder, emptySchema, type FormSchema } from "@/components/crm/pro-form-builder";

// Uncontrolled: starts from a blank one-page form; the parent only listens for changes.
export default function Example() {
  const [initial] = React.useState(() => emptySchema("Customer onboarding survey"));
  const [latest, setLatest] = React.useState<FormSchema>(initial);
  const count = latest.pages.reduce((n, p) => n + p.fields.length, 0);
  return (
    <div className="flex flex-col gap-3 bg-crm-bg p-4 font-crm">
      <ProFormBuilder defaultValue={initial} onChange={setLatest} height={600} />
      <p className="text-xs text-crm-subtle">
        Drag a field from the palette to begin · {count} field{count === 1 ? "" : "s"} so far
      </p>
    </div>
  );
}
