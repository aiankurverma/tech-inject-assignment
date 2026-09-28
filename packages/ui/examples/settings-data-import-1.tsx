import * as React from "react";
import { SettingsDataImport, type ImportField } from "@/components/crm/settings-data-import";

const FIELDS: ImportField[] = [
  { key: "first_name", label: "First name", required: true, aliases: ["firstname", "given name"] },
  { key: "last_name", label: "Last name", aliases: ["surname", "family name"] },
  {
    key: "email",
    label: "Email",
    type: "email",
    required: true,
    aliases: ["email address", "e-mail"],
  },
  { key: "phone", label: "Phone", type: "phone", aliases: ["mobile", "phone number"] },
  { key: "company", label: "Company", aliases: ["account", "organization"] },
  { key: "title", label: "Job title", aliases: ["title", "role"] },
  { key: "arr", label: "ARR", type: "number", aliases: ["annual revenue"] },
  { key: "last_contacted", label: "Last contacted", type: "date" },
];

const SAMPLE = `First Name,Surname,Email Address,Mobile,Account,Title,Annual Revenue,Lead Source
Priya,Raman,priya@northwind.io,+1 415 555 0101,Northwind,VP Sales,"120,000",Webinar
Tom,Becker,tom.becker@contoso,+49 30 1234567,Contoso,CTO,86000,Referral
Aisha,Khan,aisha.khan@harborview.health,555-0199,Harborview,Head of Ops,54000,Event
Priya,R.,PRIYA@northwind.io,,Northwind,VP Sales,,Import
,Lopez,m.lopez@brightpath.co,+34 600 000 000,BrightPath,Founder,abc,Cold`;

export default function Example() {
  const [existing] = React.useState(new Set(["aisha.khan@harborview.health"]));
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="self-start text-xs text-crm-primary underline"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([SAMPLE], { type: "text/csv" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "hubspot-export.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download a sample CSV to try
      </button>
      <SettingsDataImport
        objectName="contacts"
        fields={FIELDS}
        matchKey="email"
        onImport={async (rows, { dedupe }, onProgress) => {
          let created = 0;
          let updated = 0;
          let skipped = 0;
          for (let i = 0; i < rows.length; i++) {
            await new Promise((r) => setTimeout(r, 250));
            const exists = existing.has((rows[i]?.email ?? "").toLowerCase());
            if (!exists || dedupe === "create") created++;
            else if (dedupe === "update") updated++;
            else skipped++;
            onProgress((i + 1) / rows.length);
          }
          return { created, updated, skipped };
        }}
      />
    </div>
  );
}
