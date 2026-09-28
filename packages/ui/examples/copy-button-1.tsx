import * as React from "react";
import { CopyButton, CopyField } from "@/components/crm/copy-button";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  const [last, setLast] = React.useState<string | null>(null);
  return (
    <div className="flex w-[420px] flex-col gap-4 font-crm">
      <div className="flex items-center justify-between rounded-crm border border-crm-border bg-crm-card px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-crm-fg">Invoice INV-2026-00418</p>
          <p className="text-xs text-crm-soft">Northwind Traders · $12,480.00 due Oct 15</p>
        </div>
        <CopyButton value="INV-2026-00418" aria-label="Copy invoice number" onCopied={setLast} />
      </div>
      <CopyField label="Publishable key" value="pk_live_51NwTraders8fA2kQ9x0Lm4cVb" />
      <CopyField
        label="Webhook signing secret"
        value="whsec_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c"
        secret
      />
      <div className="flex gap-2">
        <CopyButton
          variant="secondary"
          label="Copy share link"
          copiedLabel="Link copied"
          value={async () => {
            await wait(600);
            return "https://app.example.com/share/q/7Hk2p?expires=2026-10-05";
          }}
          onCopied={setLast}
        />
        <CopyButton
          variant="secondary"
          label="Copy email"
          value="billing@northwind-traders.com"
          onCopied={setLast}
        />
      </div>
      <p className="text-xs text-crm-subtle">
        {last ? `Last copied: ${last}` : "Nothing copied yet."}
      </p>
    </div>
  );
}
