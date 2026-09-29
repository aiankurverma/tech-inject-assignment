import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Landmark, Plus } from "lucide-react";
import { Button } from "@/components/crm/button";
import {
  billingKeys,
  type BillingApi,
  type PaymentMethod,
} from "@/components/crm/pro-billing-portal/billing-types";

export function PaymentMethodsPanel({
  api,
  methods,
  onAdd,
  disabled,
}: {
  api: BillingApi;
  methods: PaymentMethod[];
  onAdd?: () => void;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: billingKeys.overview });
  const makeDefault = useMutation({
    mutationFn: api.setDefaultPaymentMethod,
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: api.removePaymentMethod, onSuccess: invalidate });
  const [confirming, setConfirming] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {methods.length === 0 && (
        <p className="rounded-crm border border-dashed border-crm-border p-6 text-center text-sm text-crm-muted-fg">
          No payment method on file.
        </p>
      )}
      <ul className="flex flex-col gap-2" aria-label="Payment methods">
        {methods.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-3 rounded-crm border border-crm-border bg-crm-card p-3"
          >
            {m.kind === "card" ? (
              <CreditCard className="size-5 text-crm-muted-fg" />
            ) : (
              <Landmark className="size-5 text-crm-muted-fg" />
            )}
            <div className="mr-auto text-sm">
              <span className="capitalize">{m.brand ?? m.kind.toUpperCase()}</span> •••• {m.last4}
              {m.expMonth && (
                <span className="ml-2 text-xs text-crm-muted-fg">
                  exp {String(m.expMonth).padStart(2, "0")}/{String(m.expYear).slice(-2)}
                </span>
              )}
              {m.isDefault && (
                <span className="ml-2 rounded-full bg-crm-primary/15 px-2 py-0.5 text-[11px] text-crm-primary">
                  Default
                </span>
              )}
            </div>
            {!m.isDefault && (
              <Button
                size="sm"
                disabled={disabled}
                loading={makeDefault.isPending && makeDefault.variables === m.id}
                onClick={() => makeDefault.mutate(m.id)}
              >
                Make default
              </Button>
            )}
            {confirming === m.id ? (
              <>
                <Button
                  size="sm"
                  variant="danger"
                  loading={remove.isPending}
                  onClick={() => remove.mutate(m.id, { onSettled: () => setConfirming(null) })}
                >
                  Confirm remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || (m.isDefault && methods.length > 1)}
                title={m.isDefault && methods.length > 1 ? "Set another default first" : undefined}
                onClick={() => setConfirming(m.id)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      {onAdd && (
        <Button className="w-fit" disabled={disabled} onClick={onAdd}>
          <Plus className="size-3.5" /> Add payment method
        </Button>
      )}
      <p className="text-[11px] text-crm-faint">
        Card details are collected and tokenised by your payment provider; only tokens are stored
        here.
      </p>
      {(makeDefault.error || remove.error) && (
        <p role="alert" className="text-xs text-crm-danger">
          {String((makeDefault.error ?? remove.error) as Error)}
        </p>
      )}
    </div>
  );
}
