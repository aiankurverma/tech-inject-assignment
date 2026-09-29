import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  billingKeys,
  type BillingApi,
  type BillingInterval,
  type BillingOverview,
} from "@/components/crm/pro-billing-portal/billing-types";

export function PlanPanel({
  api,
  data,
  formatMoney,
  disabled,
}: {
  api: BillingApi;
  data: BillingOverview;
  formatMoney: (minor: number) => string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const sub = data.subscription;
  const [interval, setInterval] = React.useState<BillingInterval>(sub.interval);
  const change = useMutation({
    mutationFn: (planId: string) => api.changePlan(planId, interval),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.overview }),
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelSubscription!(),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.overview }),
  });
  const current = data.plans.find((p) => p.id === sub.planId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-crm border border-crm-border bg-crm-card p-4">
        <div className="mr-auto">
          <p className="text-xs text-crm-muted-fg">Current plan</p>
          <p className="text-base font-semibold">
            {current?.name ?? sub.planId}{" "}
            <span className="text-xs font-normal capitalize text-crm-muted-fg">
              · {sub.status.replace("_", " ")} · billed {sub.interval}ly
            </span>
          </p>
          <p className="text-xs text-crm-muted-fg">
            {sub.cancelAtPeriodEnd ? "Ends" : "Renews"} on{" "}
            {format(parseISO(sub.currentPeriodEnd), "dd MMM yyyy")}
          </p>
        </div>
        {api.cancelSubscription && !sub.cancelAtPeriodEnd && (
          <Button
            variant="danger"
            loading={cancel.isPending}
            disabled={disabled}
            onClick={() => cancel.mutate()}
          >
            Cancel at period end
          </Button>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Billing interval"
        className="flex w-fit gap-1 rounded-crm bg-crm-muted p-1 text-xs"
      >
        {(["month", "year"] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={interval === i}
            onClick={() => setInterval(i)}
            className={cn(
              "rounded-md px-3 py-1 capitalize",
              interval === i ? "bg-crm-raised text-crm-fg shadow-crm-raised" : "text-crm-muted-fg",
            )}
          >
            {i}ly
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {data.plans.map((p) => {
          const price = p.prices[interval];
          const isCurrent = p.id === sub.planId && interval === sub.interval;
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col gap-3 rounded-crm border bg-crm-card p-4",
                p.highlighted ? "border-crm-primary" : "border-crm-border",
              )}
            >
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                {p.description && <p className="text-xs text-crm-muted-fg">{p.description}</p>}
              </div>
              <p className="text-xl font-semibold tabular-nums">
                {price == null ? "Custom" : formatMoney(price)}
                {price != null && (
                  <span className="text-xs font-normal text-crm-muted-fg"> /{interval}</span>
                )}
              </p>
              <ul className="flex flex-1 flex-col gap-1 text-xs text-crm-muted-fg">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <Check className="mt-0.5 size-3 shrink-0 text-crm-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent ? "muted" : p.highlighted ? "primary" : "secondary"}
                disabled={disabled || isCurrent || price == null || change.isPending}
                loading={change.isPending && change.variables === p.id}
                onClick={() => change.mutate(p.id)}
              >
                {isCurrent ? "Current plan" : price == null ? "Contact sales" : "Switch plan"}
              </Button>
            </div>
          );
        })}
      </div>
      {(change.error || cancel.error) && (
        <p role="alert" className="text-xs text-crm-danger">
          {String((change.error ?? cancel.error) as Error)}
        </p>
      )}
    </div>
  );
}
