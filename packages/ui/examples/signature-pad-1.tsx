import * as React from "react";
import { Button } from "@/components/crm/button";
import { SignaturePad, type SignatureValue } from "@/components/crm/signature-pad";

const quote = {
  number: "Q-2026-0418",
  customer: "Acme Logistics Inc.",
  total: 62500,
  currency: "USD",
};

export default function Example() {
  const [sig, setSig] = React.useState<SignatureValue | null>(null);
  const [error, setError] = React.useState<string>();
  const [accepted, setAccepted] = React.useState<SignatureValue | null>(null);
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: quote.currency });

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4 rounded-xl border border-crm-border bg-crm-sidebar p-5 font-crm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-[11px] text-crm-faint">Quote {quote.number}</p>
          <h3 className="mt-1 text-sm font-semibold text-crm-fg">{quote.customer}</h3>
        </div>
        <p className="text-lg font-semibold text-crm-fg tabular-nums">
          {money.format(quote.total)}
        </p>
      </div>
      {accepted ? (
        <div className="flex flex-col gap-2 rounded-xl border border-crm-border bg-crm-card p-4">
          <p className="text-sm text-crm-success">Quote accepted</p>
          <img src={accepted.dataUrl} alt="Captured signature" className="h-20 object-contain" />
          <p className="text-xs text-crm-subtle">
            {accepted.name} · {new Date(accepted.signedAt).toLocaleString()} · {accepted.mode}
          </p>
          <Button size="sm" className="self-start" onClick={() => setAccepted(null)}>
            Sign again
          </Button>
        </div>
      ) : (
        <>
          <SignaturePad
            signerName="Priya Raman"
            required
            error={error}
            onChange={(v) => {
              setSig(v);
              if (v) setError(undefined);
            }}
            statement={`By signing, you accept quote ${quote.number} for ${money.format(quote.total)} and the Northwind Master Services Agreement.`}
          />
          <Button
            variant="primary"
            className="self-end"
            onClick={() => (sig ? setAccepted(sig) : setError("Please sign before accepting."))}
          >
            Accept and sign
          </Button>
        </>
      )}
    </div>
  );
}
