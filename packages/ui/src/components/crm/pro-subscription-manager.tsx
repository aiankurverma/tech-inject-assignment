import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format as fmtDate, parseISO } from "date-fns";
import { AlertTriangle, Check, CirclePause, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  formatMoney,
  upcomingInvoice,
  type Plan,
  type RetentionOffer,
  type Subscription,
  type SubscriptionStatus,
} from "@/components/crm/pro-subscription-manager/billing";
import { ChangePlanDialog } from "@/components/crm/pro-subscription-manager/change-plan-dialog";
import {
  CancelDialog,
  PauseDialog,
  SeatsDialog,
} from "@/components/crm/pro-subscription-manager/lifecycle-dialogs";
import {
  BillingTimeline,
  InvoicePanel,
} from "@/components/crm/pro-subscription-manager/invoice-panel";
import { useSubscription, type SubscriptionApi } from "@/hooks/use-subscription";

export type {
  Plan,
  RetentionOffer,
  Subscription,
  TimelineEvent,
} from "@/components/crm/pro-subscription-manager/billing";
export { previewChange, upcomingInvoice } from "@/components/crm/pro-subscription-manager/billing";
export type { SubscriptionApi } from "@/hooks/use-subscription";

export interface ProSubscriptionManagerProps {
  api: SubscriptionApi;
  subscriptionId: string;
  plans: readonly Plan[];
  retentionOffers?: readonly RetentionOffer[];
  /** Seats currently assigned; seat reductions cannot go below this. */
  usedSeats?: number;
  locale?: string;
  /** Provide to share a cache with your app; otherwise an isolated client is created. */
  queryClient?: QueryClient;
  /** Disable all mutations (e.g. viewer role). */
  readOnly?: boolean;
  onChanged?: (sub: Subscription) => void;
  className?: string;
}

const STATUS: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-crm-success/15 text-crm-success" },
  trialing: { label: "Trial", cls: "bg-crm-primary/15 text-crm-primary" },
  paused: { label: "Paused", cls: "bg-crm-warning/15 text-crm-warning" },
  past_due: { label: "Past due", cls: "bg-crm-danger/15 text-crm-danger" },
  canceling: { label: "Cancels at period end", cls: "bg-crm-danger/15 text-crm-danger" },
};

type DialogId = "plan" | "seats" | "pause" | "cancel" | null;

/** Self-serve subscription console: plan card, change-plan wizard, seats, pause, cancel, invoice. */
export function ProSubscriptionManager({ queryClient, ...props }: ProSubscriptionManagerProps) {
  const [fallback] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <Manager {...props} />
    </QueryClientProvider>
  );
}

function Manager({
  api,
  subscriptionId,
  plans,
  retentionOffers = [],
  usedSeats,
  locale = "en-US",
  readOnly,
  onChanged,
  className,
}: Omit<ProSubscriptionManagerProps, "queryClient">) {
  const s = useSubscription(api, subscriptionId);
  const planMap = React.useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const [dialog, setDialog] = React.useState<DialogId>(null);
  const [notice, setNotice] = React.useState("");
  const sub = s.subscription;
  const currency = sub?.currency ?? "USD";
  const money = React.useCallback(
    (m: number) => formatMoney(m, currency, locale),
    [currency, locale],
  );
  const invoice = React.useMemo(() => (sub ? upcomingInvoice(sub, planMap) : null), [sub, planMap]);

  const open = (d: DialogId) => {
    s.resetError();
    setDialog(d);
  };
  const act =
    <A extends unknown[]>(fn: (...a: A) => Promise<Subscription>, msg: string) =>
    async (...a: A) => {
      const next = await fn(...a);
      setNotice(msg);
      onChanged?.(next);
      return next;
    };

  if (s.query.isPending) {
    return (
      <div
        role="status"
        aria-busy
        className={cn(
          "flex h-60 items-center justify-center gap-2 rounded-crm border border-crm-border bg-crm-card text-xs text-crm-subtle",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading subscription…
      </div>
    );
  }
  if (s.query.isError || !sub) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center gap-3 rounded-crm border border-crm-border bg-crm-card p-8 text-center text-xs",
          className,
        )}
      >
        <AlertTriangle className="size-5 text-crm-danger" aria-hidden />
        <p className="text-crm-fg">{s.query.error?.message ?? "Subscription not found."}</p>
        <Button onClick={() => void s.query.refetch()}>
          <RefreshCw className="size-3.5" aria-hidden /> Retry
        </Button>
      </div>
    );
  }

  const plan = planMap.get(sub.planId);
  const status = STATUS[sub.status];
  const scheduled = sub.scheduledChange ? planMap.get(sub.scheduledChange.planId) : null;
  const disabled = readOnly || s.pending;
  const price = plan ? plan.prices[sub.interval] * sub.seats : 0;

  return (
    <div className={cn("flex flex-col gap-4 font-crm text-crm-fg", className)}>
      <section
        aria-labelledby="sub-plan-title"
        className="rounded-crm bg-crm-raised p-4 shadow-crm-raised"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="sub-plan-title" className="text-base font-semibold">
                {plan?.name ?? "Unknown plan"}
              </h2>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.cls)}>
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-crm-subtle">
              {sub.customer} · {sub.seats} seats{usedSeats ? ` (${usedSeats} used)` : ""} · billed{" "}
              {sub.interval}ly
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{money(price)}</p>
            <p className="text-xs text-crm-subtle">per {sub.interval}</p>
          </div>
        </div>

        {usedSeats ? (
          <div className="mt-3">
            <div
              role="meter"
              aria-label="Seat usage"
              aria-valuemin={0}
              aria-valuemax={sub.seats}
              aria-valuenow={usedSeats}
              className="h-1.5 overflow-hidden rounded-full bg-crm-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  usedSeats >= sub.seats ? "bg-crm-warning" : "bg-crm-primary",
                )}
                style={{ width: `${Math.min(100, (usedSeats / sub.seats) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        {plan ? (
          <ul className="mt-3 grid gap-1 text-xs text-crm-muted-fg sm:grid-cols-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-crm-success" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-3 text-xs text-crm-subtle">
          {sub.status === "paused"
            ? sub.resumesAt
              ? `Paused, resumes ${fmtDate(parseISO(sub.resumesAt), "d MMM yyyy")}`
              : "Paused until resumed"
            : `Current period ${fmtDate(parseISO(sub.currentPeriodStart), "d MMM")} – ${fmtDate(parseISO(sub.currentPeriodEnd), "d MMM yyyy")}`}
          {sub.creditBalance > 0 ? ` · ${money(sub.creditBalance)} credit` : ""}
        </p>

        {scheduled || sub.status === "canceling" ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-crm bg-crm-warning/10 px-3 py-2 text-xs text-crm-warning">
            <span>
              {sub.status === "canceling"
                ? `Access ends ${fmtDate(parseISO(sub.currentPeriodEnd), "d MMM yyyy")}.`
                : `Switching to ${scheduled?.name} × ${sub.scheduledChange?.seats} on ${fmtDate(parseISO(sub.currentPeriodEnd), "d MMM yyyy")}.`}
            </span>
            <Button
              size="sm"
              disabled={disabled}
              onClick={() =>
                void act(
                  s.reactivate,
                  sub.status === "canceling"
                    ? "Subscription reactivated"
                    : "Scheduled change removed",
                )()
              }
            >
              {sub.status === "canceling" ? "Keep subscription" : "Undo change"}
            </Button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={disabled || sub.status === "canceling"}
            onClick={() => open("plan")}
          >
            Change plan
          </Button>
          <Button disabled={disabled || sub.status !== "active"} onClick={() => open("seats")}>
            Manage seats
          </Button>
          {sub.status === "paused" ? (
            <Button
              disabled={disabled}
              onClick={() => void act(s.resume, "Subscription resumed")()}
            >
              Resume now
            </Button>
          ) : (
            <Button disabled={disabled || sub.status !== "active"} onClick={() => open("pause")}>
              <CirclePause className="size-3.5" aria-hidden /> Pause
            </Button>
          )}
          <Button
            variant="ghost"
            className="ml-auto"
            disabled={disabled || sub.status === "canceling"}
            onClick={() => open("cancel")}
          >
            Cancel subscription
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-crm-success">
          {s.pending ? "Saving…" : notice}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <InvoicePanel invoice={invoice} money={money} />
        <BillingTimeline events={sub.events} />
      </div>

      <ChangePlanDialog
        open={dialog === "plan"}
        onOpenChange={(o) => setDialog(o ? "plan" : null)}
        subscription={sub}
        plans={plans}
        planMap={planMap}
        money={money}
        pending={s.pending}
        error={s.mutationError}
        onConfirm={act(s.changePlan, "Plan updated")}
      />
      <SeatsDialog
        open={dialog === "seats"}
        onOpenChange={(o) => setDialog(o ? "seats" : null)}
        subscription={sub}
        planMap={planMap}
        money={money}
        usedSeats={usedSeats}
        pending={s.pending}
        error={s.mutationError}
        onConfirm={act(s.updateSeats, "Seats updated")}
      />
      <PauseDialog
        open={dialog === "pause"}
        onOpenChange={(o) => setDialog(o ? "pause" : null)}
        subscription={sub}
        pending={s.pending}
        error={s.mutationError}
        onConfirm={act(s.pause, "Subscription paused")}
      />
      <CancelDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        subscription={sub}
        offers={retentionOffers}
        pending={s.pending}
        error={s.mutationError}
        onPause={() => open("pause")}
        onAcceptOffer={act(s.acceptOffer, "Offer applied, thanks for staying")}
        onConfirm={act(s.cancel, "Cancellation scheduled")}
      />
    </div>
  );
}
