import * as React from "react";
import { useForm, useWatch, type Resolver, type ResolverResult } from "react-hook-form";
import { z } from "zod";
import { format as fmtDate, parseISO } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { DialogShell, ErrorNote } from "@/components/crm/pro-subscription-manager/dialog-shell";
import {
  previewChange,
  type ChangeInput,
  type Plan,
  type Subscription,
} from "@/components/crm/pro-subscription-manager/billing";

const schema = z.object({
  planId: z.string().min(1),
  interval: z.enum(["month", "year"]),
  seats: z.number().int("Whole seats only").min(1, "At least one seat"),
  timing: z.enum(["now", "period_end"]),
});

export interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription;
  plans: readonly Plan[];
  planMap: ReadonlyMap<string, Plan>;
  money: (minor: number) => string;
  pending: boolean;
  error: Error | null;
  onConfirm: (input: ChangeInput) => Promise<unknown>;
}

const fail = (field: string, type: string, message: string) =>
  ({
    values: {},
    errors: { [field]: { type, message } },
  }) as unknown as ResolverResult<ChangeInput>;

const STEPS = ["Plan", "Seats & billing", "Review"] as const;

/** Three-step wizard: pick plan → seats/interval/timing → proration review and confirm. */
export function ChangePlanDialog({
  open,
  onOpenChange,
  subscription: sub,
  plans,
  planMap,
  money,
  pending,
  error,
  onConfirm,
}: ChangePlanDialogProps) {
  const [step, setStep] = React.useState(0);
  const planRef = React.useRef(planMap);
  planRef.current = planMap;

  const resolver = React.useCallback<Resolver<ChangeInput>>(async (values) => {
    const r = schema.safeParse(values);
    if (!r.success) {
      const issue = r.error.issues[0]!;
      return fail(String(issue.path[0]), issue.code, issue.message);
    }
    const plan = planRef.current.get(r.data.planId);
    if (plan?.minSeats && r.data.seats < plan.minSeats)
      return fail("seats", "min", `${plan.name} needs at least ${plan.minSeats} seats`);
    if (plan?.maxSeats && r.data.seats > plan.maxSeats)
      return fail("seats", "max", `${plan.name} allows up to ${plan.maxSeats} seats`);
    return { values: r.data, errors: {} };
  }, []);

  const form = useForm<ChangeInput>({
    resolver,
    defaultValues: { planId: sub.planId, interval: sub.interval, seats: sub.seats, timing: "now" },
  });
  const { register, setValue, trigger, control, reset, formState } = form;
  React.useEffect(() => {
    if (open) {
      reset({ planId: sub.planId, interval: sub.interval, seats: sub.seats, timing: "now" });
      setStep(0);
    }
  }, [open, sub, reset]);

  const values = useWatch({ control }) as ChangeInput;
  const preview = React.useMemo(() => {
    try {
      return previewChange(sub, planMap, values);
    } catch {
      return null;
    }
  }, [sub, planMap, values]);

  // Downgrades default to period end, upgrades to now (the common SaaS policy).
  const direction = preview?.direction;
  React.useEffect(() => {
    if (direction) setValue("timing", direction === "downgrade" ? "period_end" : "now");
  }, [direction, setValue]);

  const unchanged =
    values.planId === sub.planId && values.interval === sub.interval && values.seats === sub.seats;

  const next = async () => {
    if (step === 1 && !(await trigger())) return;
    setStep((s) => Math.min(2, s + 1));
  };
  const submit = form.handleSubmit(async (v) => {
    await onConfirm(v);
    onOpenChange(false);
  });

  const radioCls = (on: boolean) =>
    cn(
      "flex cursor-pointer flex-col gap-1 rounded-crm border p-3 text-left text-xs outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-crm-ring/60",
      on ? "border-crm-primary bg-crm-primary/10" : "border-crm-border hover:bg-crm-muted/50",
    );

  return (
    <DialogShell
      wide
      open={open}
      onOpenChange={onOpenChange}
      title="Change plan"
      description={`Step ${step + 1} of 3 · ${STEPS[step]}`}
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              Back
            </Button>
          ) : null}
          {step < 2 ? (
            <Button variant="primary" onClick={next} disabled={step === 0 && !values.planId}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" onClick={submit} loading={pending} disabled={unchanged}>
              {values.timing === "now" ? "Confirm and pay" : "Schedule change"}
            </Button>
          )}
        </>
      }
    >
      <ol aria-label="Progress" className="mb-3 flex gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-crm-primary" : "bg-crm-muted")}
          >
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={(e) => e.preventDefault()} noValidate>
        {step === 0 ? (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Choose a plan</legend>
            {plans
              .filter((p) => !p.legacy || p.id === sub.planId)
              .map((p) => {
                const on = values.planId === p.id;
                return (
                  <label key={p.id} className={radioCls(on)}>
                    <input type="radio" value={p.id} {...register("planId")} className="sr-only" />
                    <span className="flex items-center justify-between font-medium text-crm-fg">
                      {p.name}
                      {p.id === sub.planId ? (
                        <span className="rounded-full bg-crm-muted px-2 py-0.5 text-[10px] text-crm-muted-fg">
                          Current
                        </span>
                      ) : on ? (
                        <Check className="size-3.5 text-crm-primary" aria-hidden />
                      ) : null}
                    </span>
                    <span className="text-crm-muted-fg tabular-nums">
                      {money(p.prices[values.interval ?? sub.interval])} / seat /{" "}
                      {values.interval ?? sub.interval}
                    </span>
                    <span className="text-[11px] text-crm-subtle">
                      {p.features.slice(0, 3).join(" · ")}
                    </span>
                  </label>
                );
              })}
          </fieldset>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1.5 text-[11px] font-medium text-crm-muted-fg">Billing</legend>
              {(["month", "year"] as const).map((iv) => (
                <label key={iv} className={radioCls(values.interval === iv)}>
                  <input type="radio" value={iv} {...register("interval")} className="sr-only" />
                  <span className="font-medium text-crm-fg">
                    {iv === "month" ? "Monthly" : "Annual"}
                  </span>
                  <span className="text-crm-subtle tabular-nums">
                    {money((planMap.get(values.planId)?.prices[iv] ?? 0) * (values.seats || 0))} /{" "}
                    {iv}
                  </span>
                </label>
              ))}
            </fieldset>
            <div>
              <label
                htmlFor="cp-seats"
                className="mb-1 block text-[11px] font-medium text-crm-muted-fg"
              >
                Seats
              </label>
              <input
                id="cp-seats"
                type="number"
                min={1}
                aria-invalid={formState.errors.seats ? true : undefined}
                aria-describedby={formState.errors.seats ? "cp-seats-err" : undefined}
                {...register("seats", { valueAsNumber: true })}
                className="h-8 w-28 rounded-crm border border-crm-border bg-crm-input px-2.5 text-xs text-crm-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              />
              {formState.errors.seats ? (
                <p id="cp-seats-err" className="mt-1 text-[11px] text-crm-danger">
                  {formState.errors.seats.message}
                </p>
              ) : null}
            </div>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1.5 text-[11px] font-medium text-crm-muted-fg">When</legend>
              <label className={radioCls(values.timing === "now")}>
                <input type="radio" value="now" {...register("timing")} className="sr-only" />
                <span className="font-medium text-crm-fg">Immediately</span>
                <span className="text-crm-subtle">Prorated today</span>
              </label>
              <label className={radioCls(values.timing === "period_end")}>
                <input
                  type="radio"
                  value="period_end"
                  {...register("timing")}
                  className="sr-only"
                />
                <span className="font-medium text-crm-fg">At renewal</span>
                <span className="text-crm-subtle">
                  {fmtDate(parseISO(sub.currentPeriodEnd), "d MMM yyyy")}
                </span>
              </label>
            </fieldset>
          </div>
        ) : null}

        {step === 2 && preview ? (
          <div className="flex flex-col gap-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium">
              {preview.direction === "downgrade" ? (
                <ArrowDownRight className="size-4 text-crm-warning" aria-hidden />
              ) : (
                <ArrowUpRight className="size-4 text-crm-success" aria-hidden />
              )}
              {planMap.get(sub.planId)?.name} × {sub.seats} → {planMap.get(values.planId)?.name} ×{" "}
              {values.seats} ({values.interval}ly)
            </p>
            {preview.lines.length ? (
              <table className="w-full">
                <caption className="sr-only">Proration</caption>
                <tbody>
                  {preview.lines.map((l) => (
                    <tr key={l.description} className="border-b border-crm-border/60">
                      <td className="py-1.5 text-crm-muted-fg">{l.description}</td>
                      <td className="py-1.5 text-right tabular-nums">{money(l.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="py-1.5 text-left font-semibold">
                      {preview.dueNow >= 0 ? "Due today" : "Credit to balance"}
                    </th>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {money(Math.abs(preview.dueNow))}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="rounded-crm bg-crm-muted px-3 py-2 text-crm-muted-fg">
                Nothing is charged today. The new plan starts on renewal and your team keeps current
                features until then.
              </p>
            )}
            <p className="text-crm-subtle">
              Next invoice {money(preview.nextRecurring)} on{" "}
              {fmtDate(parseISO(preview.nextBillingDate), "d MMM yyyy")} ·{" "}
              {Math.round(preview.remainingRatio * 100)}% of current period remaining.
            </p>
            {unchanged ? <p className="text-crm-warning">No changes selected.</p> : null}
          </div>
        ) : null}
      </form>
      <ErrorNote error={error} />
    </DialogShell>
  );
}
