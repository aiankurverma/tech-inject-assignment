import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { FormField, Input } from "@/components/crm/input";
import { Textarea } from "@/components/crm/textarea";

export type WebFormValue = string | boolean;
export type WebFormValues = Record<string, WebFormValue>;

export interface WebFormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "url" | "textarea" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLength?: number;
  /** Regex source plus the message shown when it fails. */
  pattern?: { source: string; message: string };
  /** Reject free-mail domains (email fields). */
  workEmail?: boolean;
  /** Only show (and validate) when another field has one of these values. */
  showIf?: { field: string; equals: WebFormValue | WebFormValue[] };
  /** Half width on wide screens. */
  half?: boolean;
}

export interface WebFormStep {
  title: string;
  description?: string;
  fields: WebFormField[];
}

export interface WebFormProps {
  steps: WebFormStep[];
  title?: string;
  submitLabel?: string;
  initialValues?: WebFormValues;
  /** Hidden context appended on submit (UTM params, page URL, campaign id). */
  hiddenFields?: Record<string, string>;
  /** Resolve to show success; reject with Error to show its message. Values exclude the honeypot. */
  onSubmit: (values: WebFormValues) => Promise<void>;
  successTitle?: string;
  successMessage?: string;
  /** Legal copy shown above submit, e.g. privacy notice. */
  consent?: React.ReactNode;
  className?: string;
}

const FREE_MAIL = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "proton.me",
];
const HONEYPOT = "company_website";

function visible(f: WebFormField, v: WebFormValues) {
  if (!f.showIf) return true;
  const want = Array.isArray(f.showIf.equals) ? f.showIf.equals : [f.showIf.equals];
  return want.includes(v[f.showIf.field] ?? "");
}

/** Validate one field; exported so servers can reuse the same rules. */
export function validateWebField(f: WebFormField, raw: WebFormValue | undefined): string | null {
  if (f.type === "checkbox")
    return f.required && raw !== true ? "Please confirm to continue." : null;
  const val = typeof raw === "string" ? raw.trim() : "";
  if (!val) return f.required ? `${f.label} is required.` : null;
  if (f.type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return "Enter a valid email address.";
    if (f.workEmail && FREE_MAIL.includes((val.split("@")[1] ?? "").toLowerCase()))
      return "Please use your work email.";
  }
  if (f.type === "tel" && val.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  if (f.type === "url" && !/^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(val))
    return "Enter a full URL starting with https://";
  if (f.type === "number") {
    const n = Number(val);
    if (Number.isNaN(n)) return "Enter a number.";
    if (f.min !== undefined && n < f.min) return `Must be at least ${f.min.toLocaleString()}.`;
    if (f.max !== undefined && n > f.max) return `Must be at most ${f.max.toLocaleString()}.`;
  }
  if (f.maxLength && val.length > f.maxLength) return `Keep it under ${f.maxLength} characters.`;
  if (f.pattern && !new RegExp(f.pattern.source).test(val)) return f.pattern.message;
  return null;
}

/** Schema-driven lead / intake form: multi-step, conditional fields, validation, honeypot and async submit. */
export function WebForm({
  steps,
  title,
  submitLabel = "Submit",
  initialValues = {},
  hiddenFields,
  onSubmit,
  successTitle = "Thanks — we got it",
  successMessage = "Someone from our team will reach out within one business day.",
  consent,
  className,
}: WebFormProps) {
  const uid = React.useId();
  const [values, setValues] = React.useState<WebFormValues>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<"idle" | "submitting" | "done">("idle");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const last = step === steps.length - 1;
  const current = steps[step] ?? { title: "", fields: [] };

  const set = (name: string, v: WebFormValue) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    if (touched[name]) {
      const f = current.fields.find((x) => x.name === name);
      if (f) setErrors((e) => ({ ...e, [name]: validateWebField(f, v) ?? "" }));
    }
  };

  const validateStep = () => {
    const next: Record<string, string> = {};
    for (const f of current.fields) {
      if (!visible(f, values)) continue;
      const err = validateWebField(f, values[f.name]);
      if (err) next[f.name] = err;
    }
    setErrors(next);
    setTouched((t) => ({ ...t, ...Object.fromEntries(current.fields.map((f) => [f.name, true])) }));
    const firstBad = current.fields.find((f) => next[f.name]);
    if (firstBad) formRef.current?.querySelector<HTMLElement>(`[name="${firstBad.name}"]`)?.focus();
    return !firstBad;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    if (!last) {
      setStep((s) => s + 1);
      return;
    }
    // Bots fill every field; silently "succeed".
    if (values[HONEYPOT]) {
      setState("done");
      return;
    }
    const clean: WebFormValues = { ...hiddenFields };
    for (const s of steps)
      for (const f of s.fields)
        if (visible(f, values)) {
          const v = values[f.name];
          if (v !== undefined) clean[f.name] = typeof v === "string" ? v.trim() : v;
        }
    setState("submitting");
    setSubmitError(null);
    try {
      await onSubmit(clean);
      setState("done");
    } catch (x) {
      setState("idle");
      setSubmitError(x instanceof Error ? x.message : "Something went wrong. Please try again.");
    }
  };

  if (state === "done")
    return (
      <div
        role="status"
        className={cn(
          "flex flex-col items-center gap-2 rounded-crm border border-crm-border bg-crm-card p-8 text-center font-crm",
          className,
        )}
      >
        <CheckCircle2 aria-hidden className="size-8 text-crm-success" />
        <p className="text-base font-semibold text-crm-fg">{successTitle}</p>
        <p className="max-w-sm text-sm text-crm-soft">{successMessage}</p>
      </div>
    );

  const renderField = (f: WebFormField) => {
    if (!visible(f, values)) return null;
    const fid = `${uid}-${f.name}`;
    const err = touched[f.name] ? errors[f.name] || undefined : undefined;
    const common = {
      id: fid,
      name: f.name,
      required: f.required,
      "aria-describedby": err || f.hint ? `${fid}-msg` : undefined,
      onBlur: () => {
        setTouched((t) => ({ ...t, [f.name]: true }));
        setErrors((e) => ({ ...e, [f.name]: validateWebField(f, values[f.name]) ?? "" }));
      },
    };
    const str = typeof values[f.name] === "string" ? (values[f.name] as string) : "";
    if (f.type === "checkbox")
      return (
        <div key={f.name} className="col-span-2 flex flex-col gap-1">
          <label htmlFor={fid} className="flex items-start gap-2 text-sm text-crm-soft">
            <Checkbox
              {...common}
              checked={values[f.name] === true}
              aria-invalid={!!err || undefined}
              onCheckedChange={(c) => set(f.name, c === true)}
              className="mt-0.5"
            />
            <span>
              {f.label}
              {f.required ? <span className="text-crm-subtle"> *</span> : null}
            </span>
          </label>
          {err ? (
            <p id={`${fid}-msg`} role="alert" className="text-xs text-crm-danger">
              {err}
            </p>
          ) : null}
        </div>
      );
    return (
      <FormField
        key={f.name}
        label={f.label}
        htmlFor={fid}
        required={f.required}
        hint={f.hint}
        error={err}
        className={cn("col-span-2", f.half && "sm:col-span-1")}
      >
        {f.type === "textarea" ? (
          <Textarea
            {...common}
            rows={4}
            autoResize
            maxLength={f.maxLength}
            showCount={!!f.maxLength}
            placeholder={f.placeholder}
            invalid={!!err}
            value={str}
            onChange={(e) => set(f.name, e.target.value)}
          />
        ) : f.type === "select" ? (
          <select
            {...common}
            value={str}
            aria-invalid={!!err || undefined}
            onChange={(e) => set(f.name, e.target.value)}
            className="h-9 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-2.5 text-sm text-crm-fg outline-none [color-scheme:dark] focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 aria-[invalid=true]:border-crm-danger"
          >
            <option value="">{f.placeholder ?? "Select…"}</option>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            {...common}
            type={f.type}
            inputMode={f.type === "number" ? "numeric" : f.type === "tel" ? "tel" : undefined}
            autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : undefined}
            min={f.min}
            max={f.max}
            placeholder={f.placeholder}
            invalid={!!err}
            value={str}
            onChange={(e) => set(f.name, e.target.value)}
          />
        )}
      </FormField>
    );
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      aria-labelledby={title ? `${uid}-title` : undefined}
      className={cn(
        "relative flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm sm:p-6",
        className,
      )}
    >
      {title ? (
        <h2 id={`${uid}-title`} className="text-lg font-semibold text-crm-fg">
          {title}
        </h2>
      ) : null}
      {steps.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <p className="crm-caption text-crm-subtle">
            Step {step + 1} of {steps.length} · {current.title}
          </p>
          <div
            role="progressbar"
            aria-label="Form progress"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={step + 1}
            className="flex gap-1"
          >
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i <= step ? "bg-crm-primary" : "bg-crm-track",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
      <fieldset className="flex flex-col gap-1">
        <legend className={cn("text-sm font-medium text-crm-fg", steps.length === 1 && "sr-only")}>
          {current.title}
        </legend>
        {current.description ? (
          <p className="text-xs text-crm-soft">{current.description}</p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-3">{current.fields.map(renderField)}</div>
      </fieldset>
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-hp`}>Leave this empty</label>
        <input
          id={`${uid}-hp`}
          tabIndex={-1}
          autoComplete="off"
          value={typeof values[HONEYPOT] === "string" ? (values[HONEYPOT] as string) : ""}
          onChange={(e) => setValues((v) => ({ ...v, [HONEYPOT]: e.target.value }))}
        />
      </div>
      {last && consent ? <div className="text-xs text-crm-subtle">{consent}</div> : null}
      {submitError ? (
        <p role="alert" className="text-sm text-crm-danger">
          {submitError}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {step > 0 ? (
          <Button type="button" size="lg" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" variant="primary" loading={state === "submitting"}>
          {last ? submitLabel : "Continue"}
        </Button>
      </div>
    </form>
  );
}
