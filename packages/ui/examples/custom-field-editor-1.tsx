import * as React from "react";
import {
  CustomFieldEditor,
  type CustomFieldDefinition,
} from "@/components/crm/custom-field-editor";

export default function Example() {
  const [saved, setSaved] = React.useState<CustomFieldDefinition | null>(null);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <CustomFieldEditor
        objectName="Deal"
        existingKeys={["amount", "close_date", "stage", "contract_term"]}
        initial={{
          label: "Procurement status",
          type: "select",
          options: [
            { id: "o1", label: "Not started" },
            { id: "o2", label: "Security review" },
            { id: "o3", label: "Legal redlines" },
            { id: "o4", label: "PO issued" },
          ],
        }}
        onSave={async (f) => {
          await new Promise((r) => setTimeout(r, 600));
          setSaved(f);
        }}
        onCancel={() => setSaved(null)}
      />
      {saved ? (
        <pre className="overflow-x-auto rounded-crm bg-crm-muted p-3 font-mono text-[11px] text-crm-soft">
          {JSON.stringify(saved, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
