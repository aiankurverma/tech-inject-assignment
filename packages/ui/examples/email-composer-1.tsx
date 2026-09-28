import * as React from "react";
import { EmailComposer, type EmailAttachment } from "@/components/crm/email-composer";

export default function Example() {
  const [files, setFiles] = React.useState<EmailAttachment[]>([
    { id: "f1", name: "Acme-proposal-v3.pdf", size: 482_000 },
  ]);
  return (
    <EmailComposer
      className="max-w-2xl"
      from="Sam Lee <sam@northwind.io>"
      defaultValue={{
        to: ["priya@acme.io"],
        subject: "Updated proposal for the 2-year term",
        body: "Hi Priya,\n\nAttached is the revised proposal with quarterly billing.\n\nBest,\nSam",
      }}
      attachments={files}
      onAttach={() =>
        setFiles((f) => [...f, { id: `f${f.length + 1}`, name: "Pricing.xlsx", size: 38_000 }])
      }
      onRemoveAttachment={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
      onSend={() => new Promise((r) => setTimeout(r, 800))}
      onDiscard={() => setFiles([])}
    />
  );
}
