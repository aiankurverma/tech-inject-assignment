import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Stepper } from "@/components/crm/stepper";

export type WizardValues = Record<string, unknown>;
export type WizardErrors = Record<string, string>;

export interface WizardStepContext<V extends WizardValues> {
  values: V;
  errors: WizardErrors;
  /** Merge a patch into the values; clears errors for the patched keys. */
  setValues: (patch: Partial<V>) => void;
  /** True once the user tried to leave the step. */
  showErrors: boolean;
}

export interface WizardStep<V extends WizardValues> {
  id: string;
  title: string;
  description?: string;
  render: (ctx: WizardStepContext<V>) => React.ReactNode;
  /** Return field errors to block moving forward. */
  validate?: (values: V) => WizardErrors;
  /** Optional steps get a "Skip" button. */
  optional?: boolean;
}

export interface OnboardingWizardProps<V extends WizardValues> {
  steps: WizardStep<V>[];
  initialValues: V;
  /** Called on the last step. Reject to show the error and stay. */
  onComplete: (values: V) => Promise<void> | void;
  /** Persist progress (e.g. localStorage or API draft). */
  onStepChange?: (index: number, values: V) => void;
  initialStep?: number;
  finishLabel?: string;
  className?: string;
}

/** Multi-step onboarding with per-step validation, back/skip/next, stepper navigation to completed steps and async finish. */
export function OnboardingWizard<V extends WizardValues>({
  steps,
  initialValues,
  onComplete,
  onStepChange,
  initialStep = 0,
  finishLabel = "Finish setup",
  className,
}: OnboardingWizardProps<V>) {
  const [index, setIndex] = React.useState(Math.min(initialStep, Math.max(0, steps.length - 1)));
  const [values, setAll] = React.useState<V>(initialValues);
  const [errors, setErrors] = React.useState<WizardErrors>({});
  const [showErrors, setShowErrors] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);

  const step = steps[index];
  const last = index === steps.length - 1;

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  if (!step) return null;

  const setValues = (patch: Partial<V>) => {
    setAll((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  const go = (to: number) => {
    setIndex(to);
    setShowErrors(false);
    setErrors({});
    setSubmitError(null);
    onStepChange?.(to, values);
  };

  const next = async () => {
    const errs = step.validate?.(values) ?? {};
    if (Object.keys(errs).length) {
      setErrors(errs);
      setShowErrors(true);
      return;
    }
    if (!last) return go(index + 1);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete(values);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not finish setup.");
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <section
      aria-label="Onboarding"
      className={cn(
        "flex w-full max-w-2xl flex-col rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="hidden border-b border-crm-border p-5 sm:block">
        <Stepper
          steps={steps.map((s) => ({ title: s.title }))}
          current={index}
          onStepClick={(i) => go(i)}
        />
      </div>
      <p className="crm-caption border-b border-crm-border px-5 py-3 text-crm-subtle sm:hidden">
        Step {index + 1} of {steps.length}
      </p>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
        className="flex flex-col"
      >
        <div className="flex flex-col gap-5 p-5">
          <header className="flex flex-col gap-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-medium outline-none">
              {step.title}
              {step.optional ? (
                <span className="ml-2 text-xs font-normal text-crm-subtle">Optional</span>
              ) : null}
            </h2>
            {step.description ? (
              <p className="text-sm text-crm-muted-fg">{step.description}</p>
            ) : null}
          </header>
          {showErrors && errorCount ? (
            <p role="alert" className="text-xs text-crm-danger">
              Fix {errorCount} {errorCount === 1 ? "field" : "fields"} to continue.
            </p>
          ) : null}
          {step.render({ values, errors: showErrors ? errors : {}, setValues, showErrors })}
          {submitError ? (
            <p role="alert" className="rounded-crm bg-crm-danger/10 p-2.5 text-xs text-crm-danger">
              {submitError}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center gap-2 border-t border-crm-border px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            disabled={index === 0 || submitting}
            onClick={() => go(index - 1)}
          >
            <ArrowLeft aria-hidden /> Back
          </Button>
          <span className="flex-1" />
          {step.optional && !last ? (
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => go(index + 1)}
            >
              Skip
            </Button>
          ) : null}
          <Button type="submit" variant="primary" loading={submitting}>
            {last ? finishLabel : "Continue"}
            {last ? null : <ArrowRight aria-hidden />}
          </Button>
        </footer>
      </form>
    </section>
  );
}
