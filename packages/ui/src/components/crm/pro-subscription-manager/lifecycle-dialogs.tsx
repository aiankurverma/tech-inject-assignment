import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { addMonths, format as fmtDate, parseISO } from "date-fns";
import { Gift, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { DialogShell, ErrorNote } from "@/components/crm/pro-subscription-manager/dialog-shell";
import {
  previewChange,
  type Plan,
  type RetentionOffer,
  type Subscription,
} from "@/components/crm/pro-subscription-manager/billing";

interface Base {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription;
  pending: boolean;
  error: Error | null;
}

/* ---------------- Seats ---------------- */

export function SeatsDialog({
  open,
  onOpenChange,
  subscription: sub,
  planMap,
  money,
  pending,
  error,
  usedSeats,
  onConfirm,
}: Base & {
  planMap: ReadonlyMap<string, Plan>;
  money: (m: number) => string;
  usedSeats?: number;
  onConfirm: (seats: number) => Promise<unknown>;
}) {
  const plan = planMap.get(sub.planId);
  const min = Math.max(plan?.minSeats ?? 1, usedSeats ?? 1);
  const max = plan?.maxSeats ?? 10_000;
  const [seats, setSeats] = React.useState(sub.seats);
  React.useEffect(() => {
    if (open) setSeats(sub.seats);
  }, [open, sub.seats]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.trunc(n) || min));
  const preview = React.useMemo(
    () =>
      previewChange(sub, planMap, {
        planId: sub.planId,
        interval: sub.interval,
        seats,
        timing: "now",
      }),
    [sub, planMap, seats],
  );
  const step = (d: number) => setSeats((s) => clamp(s + d));
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Change seats"
      description={`${usedSeats ?? "–"} of ${sub.seats} seats in use`}
      footer={
        <Button
          variant="primary"
          loading={pending}
          disabled={seats === sub.seats}
          onClick={async () => {
            await onConfirm(seats);
            onOpenChange(false);
          }}
        >
          Update to {seats} seats
        </Button>
      }
    >
      <div className="flex items-center justify-center gap-3 py-2">
        <Button aria-label="Remove seat" onClick={() => step(-1)} disabled={seats <= min}>
          <Minus className="size-3.5" aria-hidden />
        </Button>
        <input
          aria-label="Seats"
          type="number"
          min={min}
          max={max}
          value={seats}
          onChange={(e) => setSeats(clamp(Number(e.target.value)))}
          className="h-9 w-24 rounded-crm border border-crm-border bg-crm-input text-center text-sm font-semibold text-crm-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        />
        <Button aria-label="Add seat" onClick={() => step(1)} disabled={seats >= max}>
          <Plus className="size-3.5" aria-hidden />
        </Button>
      </div>
      {usedSeats && seats <= usedSeats ? (
        <p className="text-center text-[11px] text-crm-subtle">
          Remove members before going below {usedSeats} seats.
        </p>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
        <dt className="text-crm-muted-fg">
          {preview.dueNow >= 0 ? "Prorated charge today" : "Credit"}
        </dt>
        <dd className="text-right tabular-nums">{money(Math.abs(preview.dueNow))}</dd>
        <dt className="text-crm-muted-fg">New recurring</dt>
        <dd className="text-right tabular-nums">
          {money(preview.nextRecurring)} / {sub.interval}
        </dd>
      </dl>
      <ErrorNote error={error} />
    </DialogShell>
  );
}

/* ---------------- Pause ---------------- */

export function PauseDialog({
  open,
  onOpenChange,
  subscription: sub,
  pending,
  error,
  onConfirm,
}: Base & { onConfirm: (resumesAt: string | null) => Promise<unknown> }) {
  const [months, setMonths] = React.useState<number>(1);
  const options = [1, 2, 3, 0];
  const resumeDate = months ? addMonths(parseISO(sub.currentPeriodEnd), months) : null;
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Pause subscription"
      description="Billing stops at the end of the current period. Data is kept while paused."
      footer={
        <Button
          variant="primary"
          loading={pending}
          onClick={async () => {
            await onConfirm(resumeDate ? resumeDate.toISOString() : null);
            onOpenChange(false);
          }}
        >
          Pause billing
        </Button>
      }
    >
      <div role="radiogroup" aria-label="Pause length" className="grid grid-cols-4 gap-2">
        {options.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={months === m}
            onClick={() => setMonths(m)}
            className={cn(
              "rounded-crm border px-2 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              months === m
                ? "border-crm-primary bg-crm-primary/10 text-crm-fg"
                : "border-crm-border text-crm-muted-fg hover:bg-crm-muted/50",
            )}
          >
            {m ? `${m} mo` : "Until resumed"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-crm-muted-fg">
        {resumeDate
          ? `Billing resumes automatically on ${fmtDate(resumeDate, "d MMM yyyy")}.`
          : "Billing stays paused until someone resumes it."}
      </p>
      <ErrorNote error={error} />
    </DialogShell>
  );
}

/* ---------------- Cancel with retention ---------------- */

const REASONS = [
  { id: "price", label: "Too expensive" },
  { id: "features", label: "Missing features" },
  { id: "unused", label: "Not using it enough" },
  { id: "competitor", label: "Switching to another tool" },
  { id: "temporary", label: "Only need it seasonally" },
  { id: "other", label: "Other" },
] as const;

const cancelSchema = z
  .object({
    reason: z.string().min(1, "Choose a reason"),
    feedback: z.string().max(1000),
    atPeriodEnd: z.boolean(),
  })
  .refine((v) => v.reason !== "other" || v.feedback.trim().length >= 5, {
    message: "Tell us a little more",
    path: ["feedback"],
  });
type CancelValues = z.infer<typeof cancelSchema>;

const cancelResolver: Resolver<CancelValues> = async (values) => {
  const r = cancelSchema.safeParse(values);
  if (r.success) return { values: r.data, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const i of r.error.issues)
    errors[String(i.path[0])] ??= { type: i.code, message: i.message };
  return { values: {}, errors };
};

export function CancelDialog({
  open,
  onOpenChange,
  subscription: sub,
  pending,
  error,
  offers,
  onPause,
  onAcceptOffer,
  onConfirm,
}: Base & {
  offers: readonly RetentionOffer[];
  onPause: () => void;
  onAcceptOffer: (offerId: string) => Promise<unknown>;
  onConfirm: (v: CancelValues) => Promise<unknown>;
}) {
  const [stage, setStage] = React.useState<"reason" | "offer" | "confirm">("reason");
  const form = useForm<CancelValues>({
    resolver: cancelResolver,
    defaultValues: { reason: "", feedback: "", atPeriodEnd: true },
  });
  const { register, handleSubmit, watch, reset, formState } = form;
  React.useEffect(() => {
    if (open) {
      reset();
      setStage("reason");
    }
  }, [open, reset]);
  const reason = watch("reason");
  // Pick the offer that fits the reason: price-sensitive users get the deepest discount.
  const offer = React.useMemo(() => {
    if (!offers.length || reason === "competitor") return null;
    const sorted = [...offers].sort((a, b) => b.discountBp - a.discountBp);
    return reason === "price" ? sorted[0]! : sorted[sorted.length - 1]!;
  }, [offers, reason]);
  const alreadyDiscounted = (sub.discountBp ?? 0) > 0;

  const toNext = handleSubmit(() => setStage(offer && !alreadyDiscounted ? "offer" : "confirm"));
  const confirm = handleSubmit(async (v) => {
    await onConfirm(v);
    onOpenChange(false);
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={stage === "offer" ? "Before you go" : "Cancel subscription"}
      footer={
        stage === "reason" ? (
          <Button variant="primary" onClick={toNext}>
            Continue
          </Button>
        ) : stage === "offer" ? (
          <>
            <Button variant="ghost" onClick={() => setStage("confirm")}>
              No thanks, cancel
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={async () => {
                await onAcceptOffer(offer!.id);
                onOpenChange(false);
              }}
            >
              Accept offer
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Keep subscription
            </Button>
            <Button variant="danger" loading={pending} onClick={confirm}>
              Confirm cancellation
            </Button>
          </>
        )
      }
    >
      {stage === "reason" ? (
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3" noValidate>
          <fieldset
            aria-invalid={formState.errors.reason ? true : undefined}
            className="flex flex-col gap-1.5"
          >
            <legend className="mb-1 text-[11px] font-medium text-crm-muted-fg">
              Why are you cancelling?
            </legend>
            {REASONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-xs text-crm-fg">
                <input
                  type="radio"
                  value={r.id}
                  {...register("reason")}
                  className="accent-[var(--crm-primary,#6d5bff)]"
                />
                {r.label}
              </label>
            ))}
            {formState.errors.reason ? (
              <p className="text-[11px] text-crm-danger">{formState.errors.reason.message}</p>
            ) : null}
          </fieldset>
          <div>
            <label
              htmlFor="cx-feedback"
              className="mb-1 block text-[11px] font-medium text-crm-muted-fg"
            >
              Anything we could do better?
            </label>
            <textarea
              id="cx-feedback"
              rows={3}
              {...register("feedback")}
              aria-invalid={formState.errors.feedback ? true : undefined}
              className="w-full rounded-crm border border-crm-border bg-crm-input px-2.5 py-1.5 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            />
            {formState.errors.feedback ? (
              <p className="mt-1 text-[11px] text-crm-danger">
                {formState.errors.feedback.message}
              </p>
            ) : null}
          </div>
          {reason === "temporary" || reason === "unused" ? (
            <p className="rounded-crm bg-crm-muted px-3 py-2 text-xs text-crm-muted-fg">
              You can{" "}
              <button
                type="button"
                onClick={onPause}
                className="font-medium text-crm-primary underline-offset-2 hover:underline"
              >
                pause instead
              </button>{" "}
              and keep your data without paying.
            </p>
          ) : null}
        </form>
      ) : null}

      {stage === "offer" && offer ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-crm-primary/15 text-crm-primary">
            <Gift className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold">{offer.title}</p>
          <p className="text-xs text-crm-muted-fg">{offer.description}</p>
        </div>
      ) : null}

      {stage === "confirm" ? (
        <div className="flex flex-col gap-3 text-xs">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              {...register("atPeriodEnd")}
              className="mt-0.5 accent-[var(--crm-primary,#6d5bff)]"
            />
            <span>
              Keep access until {fmtDate(parseISO(sub.currentPeriodEnd), "d MMM yyyy")} (no refund
              for the remaining period)
            </span>
          </label>
          <p className="text-crm-subtle">
            Unchecked cancels immediately and unused time is credited to the account.
          </p>
        </div>
      ) : null}
      <ErrorNote error={error} />
    </DialogShell>
  );
}
