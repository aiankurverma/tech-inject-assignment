import * as React from "react";
import { CsvImportFlow } from "@/components/crm/csv-import-flow";

/* Paste to try:
First,Surname,E-mail,Account,Annual revenue
Ana,Lopez,ana@globex.com,Globex,120000
Ben,Okafor,ben@umbrella.co,Umbrella,"48,000"
Chloe,,chloe@@hooli,Hooli,90000
Raj,Patel,raj@initech.io,Initech,abc
Dee,Wong,dee@stark.com,Stark Industries,310000
*/

export default function Example() {
  return (
    <CsvImportFlow
      className="max-w-3xl"
      dedupeKey="email"
      existingKeys={["ana@globex.com", "raj@initech.io"]}
      fields={[
        {
          key: "first_name",
          label: "First name",
          required: true,
          aliases: ["first", "given name"],
        },
        { key: "last_name", label: "Last name", aliases: ["surname", "last"] },
        {
          key: "email",
          label: "Email",
          required: true,
          type: "email",
          aliases: ["e-mail", "email address"],
        },
        { key: "company", label: "Company", aliases: ["account", "organization"] },
        { key: "arr", label: "ARR", type: "number", aliases: ["annual revenue"] },
      ]}
      onImport={async (rows, onProgress) => {
        for (let i = 1; i <= 10; i++) {
          await new Promise((r) => setTimeout(r, 120));
          onProgress(i / 10);
        }
        return { imported: rows.length, skipped: 0 };
      }}
    />
  );
}
