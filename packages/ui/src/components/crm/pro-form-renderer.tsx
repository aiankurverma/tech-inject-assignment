import * as React from "react";
import { toNestErrors } from "@hookform/resolvers";
import {
  useForm,
  useWatch,
  type FieldErrors,
  type FieldError,
  type Resolver,
} from "react-hook-form";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { FieldRenderer } from "@/components/crm/pro-form-renderer/fields";
import {
  buildPageZod,
  defaultValues as schemaDefaults,
  isInputField,
  resolveVisibility,
  validateFormSchema,
  type AsyncValidator,
  type FormSchema,
  type FormValues,
} from "@/components/crm/pro-form-renderer/schema";
import { readStoredDraft, useFormAutosave, type PartialResponse } from "@/hooks/use-form-autosave";

export * from "@/components/crm/pro-form-renderer/schema";

export interface SubmitMeta {
  /** Names of fields hidden by logic at submit time (their values are stripped). */
  hiddenFields: string[];
  /** Ids of pages actually shown to the respondent. */
  pagesShown: string[];
  durationMs: number;
}

export interface ProFormRendererProps {
  /** Form JSON (from ProFormBuilder or your API). Validated with Ajv before rendering. */
  schema: FormSchema;
  /** Values to start from, e.g. a saved partial response or CRM prefill. */
  initialValues?: FormValues;
  /** Step to open on (clamped to visible pages). */
  initialStep?: number;
  onSubmit?: (values: FormValues, meta: SubmitMeta) => void | Promise<void>;
  /** Debounced partial-response save; reject to show a "not saved" indicator. */
  onSavePartial?: (partial: PartialResponse<FormValues>) => void | Promise<void>;
  /** Mirror drafts to localStorage under this key and restore them on mount. */
  draftKey?: string;
  /** Async checks referenced by `field.asyncValidator`; resolve an error message or null. */
  asyncValidators?: Record<string, AsyncValidator>;
  onStepChange?: (step: number, pageId: string) => void;
  /** Keep values of fields hidden by logic in the submitted payload. */
  keepHiddenValues?: boolean;
  disabled?: boolean;
  /** Show a skeleton while the schema is being fetched. */
  loading?: boolean;
  /** Replace the default thank-you panel. */
  renderSuccess?: (reset: () => void) => React.ReactNode;
  className?: string;
}

function collectErrors(issues: { path: (string | number)[]; message: string; code: string }[]) {
  const errors: Record<string, FieldError> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = { type: issue.code, message: issue.message };
  }
  return errors;
}

/**
 * Renders a FormSchema as a themed, validated, multi-step form: Ajv-checked schema, zod rules per
 * page, react-querybuilder logic for show/hide and page skipping, async validators, react-dropzone
 * file fields and debounced partial saves.
 */
export function ProFormRenderer(props: ProFormRendererProps) {
  const check = React.useMemo(() => validateFormSchema(props.schema), [props.schema]);
  if (props.loading) return <RendererSkeleton className={props.className} />;
  if (!check.ok)
    return (
      <div
        role="alert"
        className={cn(
          "rounded-crm border border-crm-danger/40 bg-crm-danger/10 p-4 font-crm text-sm text-crm-fg",
          props.className,
        )}
      >
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 text-crm-danger" aria-hidden /> This form could not be
          loaded
        </p>
        <ul className="mt-2 list-disc pl-5 text-xs text-crm-muted-fg">
          {check.errors.slice(0, 8).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  return <RendererInner {...props} schema={check.schema} />;
}

function RendererInner({
  schema,
  initialValues,
  initialStep = 0,
  onSubmit,
  onSavePartial,
  draftKey,
  asyncValidators,
  onStepChange,
  keepHiddenValues,
  disabled,
  renderSuccess,
  className,
}: ProFormRendererProps) {
  const idPrefix = React.useId().replace(/:/g, "");
  const startedAt = React.useRef(Date.now());
  const restored = React.useMemo(() => readStoredDraft<FormValues>(draftKey), [draftKey]);
  const baseDefaults = React.useMemo(
    () => ({ ...schemaDefaults(schema), ...restored?.values, ...initialValues }),
    // Defaults are captured once per schema; later prop changes go through reset().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema],
  );

  const stepRef = React.useRef(0);
  const validateAll = React.useRef(false);
  const asyncRef = React.useRef(asyncValidators);
  asyncRef.current = asyncValidators;

  const resolver = React.useCallback<Resolver<FormValues>>(
    async (values, _ctx, options) => {
      const vis = resolveVisibility(schema, values);
      const pages = validateAll.current
        ? vis.pages
        : vis.pages.slice(stepRef.current, stepRef.current + 1);
      const fields = pages.flatMap((p) => p.fields);
      const result = await buildPageZod(fields, vis.hiddenFields, asyncRef.current).safeParseAsync(
        values,
      );
      if (result.success) return { values, errors: {} };
      return {
        values: {},
        errors: toNestErrors(
          collectErrors(result.error.issues),
          options,
        ) as FieldErrors<FormValues>,
      };
    },
    [schema],
  );

  const form = useForm<FormValues>({
    defaultValues: baseDefaults,
    resolver,
    mode: "onTouched",
    disabled,
  });
  const { control, handleSubmit, trigger, reset, formState } = form;
  const values = useWatch({ control }) as FormValues;
  const visibility = React.useMemo(() => resolveVisibility(schema, values), [schema, values]);
  const pages = visibility.pages;

  const [step, setStepState] = React.useState(() =>
    Math.max(0, Math.min(restored?.step ?? initialStep, pages.length - 1)),
  );
  const current = Math.min(step, Math.max(0, pages.length - 1));
  stepRef.current = current;
  const page = pages[current];
  const isLast = current >= pages.length - 1;

  const [submitState, setSubmitState] = React.useState<
    { kind: "idle" } | { kind: "success" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const autosave = useFormAutosave<FormValues>({ onSave: onSavePartial, storageKey: draftKey });
  const { schedule } = autosave;
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (formState.isDirty) schedule(values, current);
  }, [values, current, formState.isDirty, schedule]);

  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const goTo = React.useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, pages.length - 1));
      setStepState(clamped);
      onStepChange?.(clamped, pages[clamped]?.id ?? "");
      requestAnimationFrame(() => headingRef.current?.focus());
    },
    [pages, onStepChange],
  );

  const pageFieldNames = React.useMemo(
    () =>
      (page?.fields ?? [])
        .filter((f) => isInputField(f) && !visibility.hiddenFields.has(f.name))
        .map((f) => f.name),
    [page, visibility.hiddenFields],
  );

  const next = async () => {
    validateAll.current = false;
    const ok = await trigger(pageFieldNames, { shouldFocus: true });
    if (ok) {
      void autosave.flush();
      goTo(current + 1);
    }
  };

  const submit = handleSubmit(
    async (data) => {
      const hidden = [...visibility.hiddenFields];
      const payload: FormValues = {};
      for (const [k, v] of Object.entries(data)) {
        if (!keepHiddenValues && visibility.hiddenFields.has(k)) continue;
        payload[k] = v;
      }
      try {
        await onSubmit?.(payload, {
          hiddenFields: hidden,
          pagesShown: pages.map((p) => p.id),
          durationMs: Date.now() - startedAt.current,
        });
        autosave.clear();
        setSubmitState({ kind: "success" });
      } catch (err) {
        setSubmitState({
          kind: "error",
          message: err instanceof Error ? err.message : "Something went wrong. Try again.",
        });
      }
    },
    () => {
      // Jump to the first page that still has an error.
      const errs = form.formState.errors;
      const idx = pages.findIndex((p) => p.fields.some((f) => errs[f.name]));
      if (idx >= 0 && idx !== current) goTo(idx);
    },
  );

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLast) return void next();
    validateAll.current = true;
    void submit(e).finally(() => {
      validateAll.current = false;
    });
  };

  const restart = React.useCallback(() => {
    reset(schemaDefaults(schema));
    startedAt.current = Date.now();
    setSubmitState({ kind: "idle" });
    setStepState(0);
  }, [reset, schema]);

  if (submitState.kind === "success") {
    return (
      <div
        className={cn(
          "rounded-crm bg-crm-card p-8 text-center font-crm shadow-crm-raised",
          className,
        )}
      >
        {renderSuccess ? (
          renderSuccess(restart)
        ) : (
          <div role="status" className="flex flex-col items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-crm-success/15 text-crm-success">
              <Check className="size-5" aria-hidden />
            </span>
            <p className="text-base font-semibold text-crm-fg">
              {schema.settings?.successMessage ?? "Thanks, your response was recorded."}
            </p>
            <Button variant="ghost" size="sm" onClick={restart}>
              Submit another response
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!page) {
    return (
      <div
        className={cn(
          "rounded-crm bg-crm-card p-8 text-center font-crm text-sm text-crm-muted-fg shadow-crm-raised",
          className,
        )}
      >
        This form has no questions yet.
      </div>
    );
  }

  const showProgress = schema.settings?.showProgress !== false && pages.length > 1;
  const pct = Math.round(((current + (isLast ? 1 : 0)) / pages.length) * 100);

  return (
    <form
      noValidate
      onSubmit={onFormSubmit}
      aria-labelledby={`${idPrefix}-title`}
      className={cn(
        "flex flex-col gap-5 rounded-crm bg-crm-card p-5 font-crm shadow-crm-raised sm:p-6",
        className,
      )}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${idPrefix}-title`} className="text-lg font-semibold text-crm-fg">
              {schema.title}
            </h2>
            {schema.description ? (
              <p className="mt-0.5 text-sm text-crm-muted-fg">{schema.description}</p>
            ) : null}
          </div>
          <SaveIndicator
            status={autosave.status}
            savedAt={autosave.savedAt}
            active={autosave.active}
          />
        </div>
        {showProgress ? (
          <div className="flex flex-col gap-2">
            <div
              role="progressbar"
              aria-label="Form progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={`Step ${current + 1} of ${pages.length}`}
              className="h-1.5 overflow-hidden rounded-full bg-crm-track"
            >
              <div
                className="h-full rounded-full bg-crm-primary transition-[width] duration-300 ease-crm"
                style={{ width: `${Math.max(4, pct)}%` }}
              />
            </div>
            <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Steps">
              {pages.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={i > current || disabled}
                    aria-current={i === current ? "step" : undefined}
                    onClick={() => goTo(i)}
                    className={cn(
                      "cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-default",
                      i === current
                        ? "font-medium text-crm-fg"
                        : i < current
                          ? "text-crm-soft hover:text-crm-fg"
                          : "text-crm-subtle",
                    )}
                  >
                    <span className="tabular-nums">{i + 1}.</span> {p.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </header>

      <section aria-labelledby={`${idPrefix}-page`} className="flex flex-col gap-4">
        {pages.length > 1 || page.description ? (
          <div>
            <h3
              id={`${idPrefix}-page`}
              ref={headingRef}
              tabIndex={-1}
              className="text-sm font-semibold text-crm-fg outline-none"
            >
              {page.title}
            </h3>
            {page.description ? (
              <p className="mt-0.5 text-xs text-crm-subtle">{page.description}</p>
            ) : null}
          </div>
        ) : (
          <span id={`${idPrefix}-page`} className="sr-only">
            {page.title}
          </span>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {page.fields.map((f) =>
            visibility.hiddenFields.has(f.name) ? null : (
              <FieldRenderer
                key={f.id}
                field={f}
                control={control}
                disabled={disabled || formState.isSubmitting}
                idPrefix={idPrefix}
              />
            ),
          )}
        </div>
      </section>

      {submitState.kind === "error" ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-crm bg-crm-danger/10 px-3 py-2 text-sm text-crm-danger"
        >
          <AlertTriangle className="size-4" aria-hidden /> {submitState.message}
        </p>
      ) : null}

      <footer className="flex items-center justify-between gap-3 border-t border-crm-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => goTo(current - 1)}
          disabled={current === 0 || formState.isSubmitting}
          className={cn(current === 0 && "invisible")}
        >
          <ChevronLeft aria-hidden /> Back
        </Button>
        <span className="text-xs text-crm-subtle tabular-nums">
          {pages.length > 1 ? `Step ${current + 1} of ${pages.length}` : null}
        </span>
        <Button
          type="submit"
          variant="primary"
          loading={formState.isSubmitting || formState.isValidating}
          disabled={disabled}
        >
          {isLast ? (schema.settings?.submitLabel ?? "Submit") : "Continue"}
          {!isLast ? <ChevronRight aria-hidden /> : null}
        </Button>
      </footer>
    </form>
  );
}

function SaveIndicator({
  status,
  savedAt,
  active,
}: {
  status: string;
  savedAt: Date | null;
  active: boolean;
}) {
  if (!active || status === "idle") return null;
  return (
    <span aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-xs text-crm-subtle">
      {status === "saving" || status === "pending" ? (
        <>
          <Loader2 className="size-3 animate-spin" aria-hidden /> Saving draft…
        </>
      ) : status === "error" ? (
        <span className="flex items-center gap-1.5 text-crm-danger">
          <CloudOff className="size-3" aria-hidden /> Draft not saved
        </span>
      ) : (
        <>
          <Check className="size-3 text-crm-success" aria-hidden /> Draft saved
          {savedAt
            ? ` ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </>
      )}
    </span>
  );
}

function RendererSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading form"
      className={cn("flex flex-col gap-4 rounded-crm bg-crm-card p-6 shadow-crm-raised", className)}
    >
      <div className="h-5 w-1/3 animate-pulse rounded bg-crm-muted" />
      <div className="h-1.5 w-full animate-pulse rounded-full bg-crm-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-crm-muted" />
          <div className="h-9 w-full animate-pulse rounded-crm bg-crm-muted" />
        </div>
      ))}
    </div>
  );
}
