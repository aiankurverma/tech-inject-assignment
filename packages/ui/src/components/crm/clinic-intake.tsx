import * as React from "react";
import { ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Card } from "@/components/crm/card";
import { Checkbox } from "@/components/crm/checkbox";
import { FormField, Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Stepper } from "@/components/crm/stepper";
import { Textarea } from "@/components/crm/textarea";

export interface IntakeValues {
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD */
  dob: string;
  sex: "" | "F" | "M" | "X";
  phone: string;
  email: string;
  insurer: string;
  memberId: string;
  groupNumber: string;
  selfPay: boolean;
  allergies: string[];
  noKnownAllergies: boolean;
  medications: string;
  conditions: string[];
  reasonForVisit: string;
  consentTreatment: boolean;
  consentPrivacy: boolean;
  signature: string;
}

export const emptyIntake: IntakeValues = {
  firstName: "",
  lastName: "",
  dob: "",
  sex: "",
  phone: "",
  email: "",
  insurer: "",
  memberId: "",
  groupNumber: "",
  selfPay: false,
  allergies: [],
  noKnownAllergies: false,
  medications: "",
  conditions: [],
  reasonForVisit: "",
  consentTreatment: false,
  consentPrivacy: false,
  signature: "",
};

export interface ClinicIntakeProps {
  defaultValues?: Partial<IntakeValues>;
  insurers?: string[];
  /** Checklist of common conditions shown on the history step. */
  conditionOptions?: string[];
  onSubmit?: (values: IntakeValues) => void | Promise<void>;
  /** Fires on every change, e.g. to autosave a draft. */
  onDraftChange?: (values: IntakeValues) => void;
  now?: Date;
  className?: string;
}

type Errors = Partial<Record<keyof IntakeValues, string>>;

const STEPS = [
  { title: "Patient", description: "Demographics" },
  { title: "Insurance", description: "Coverage" },
  { title: "History", description: "Allergies & meds" },
  { title: "Consent", description: "Review & sign" },
];

const digits = (s: string) => s.replace(/\D/g, "");
/** Formats as (555) 123-4567 while typing. */
export function formatUsPhone(raw: string) {
  const d = digits(raw).slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function validateIntake(v: IntakeValues, step: number, now: Date): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!v.firstName.trim()) e.firstName = "Required";
    if (!v.lastName.trim()) e.lastName = "Required";
    if (!v.dob) e.dob = "Required";
    else {
      const d = new Date(v.dob + "T00:00:00");
      if (Number.isNaN(d.getTime()) || d > now) e.dob = "Date of birth can't be in the future";
      else if (now.getFullYear() - d.getFullYear() > 120) e.dob = "Check the year";
    }
    if (digits(v.phone).length !== 10) e.phone = "Enter a 10-digit phone number";
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = "Invalid email";
  }
  if (step === 1 && !v.selfPay) {
    if (!v.insurer) e.insurer = "Choose an insurer or select self-pay";
    if (!/^[A-Za-z0-9]{6,15}$/.test(v.memberId)) e.memberId = "6–15 letters or digits";
  }
  if (step === 2) {
    if (!v.noKnownAllergies && v.allergies.length === 0)
      e.allergies = "List allergies or confirm no known allergies";
    if (!v.reasonForVisit.trim()) e.reasonForVisit = "Tell us why you're visiting";
  }
  if (step === 3) {
    if (!v.consentTreatment) e.consentTreatment = "Required";
    if (!v.consentPrivacy) e.consentPrivacy = "Required";
    const full = `${v.firstName} ${v.lastName}`.trim().toLowerCase();
    if (v.signature.trim().toLowerCase() !== full)
      e.signature = `Type your full name: ${v.firstName} ${v.lastName}`;
  }
  return e;
}

/** Four-step patient intake: demographics, insurance, allergy/medication history and e-consent with per-step validation. */
export function ClinicIntake({
  defaultValues,
  insurers = ["Aetna", "Blue Cross Blue Shield", "Cigna", "Humana", "Medicare", "UnitedHealthcare"],
  conditionOptions = [
    "Asthma",
    "Diabetes",
    "Hypertension",
    "Heart disease",
    "Pregnancy",
    "None of these",
  ],
  onSubmit,
  onDraftChange,
  now: nowProp,
  className,
}: ClinicIntakeProps) {
  const now = nowProp ?? new Date();
  const [v, setV] = React.useState<IntakeValues>({ ...emptyIntake, ...defaultValues });
  const [step, setStep] = React.useState(0);
  const [errors, setErrors] = React.useState<Errors>({});
  const [allergyDraft, setAllergyDraft] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "submitting" | "done" | "error">("idle");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const set = <K extends keyof IntakeValues>(k: K, val: IntakeValues[K]) => {
    setV((prev) => {
      const next = { ...prev, [k]: val };
      onDraftChange?.(next);
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const go = (to: number) => {
    setStep(to);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = async () => {
    const e = validateIntake(v, step, now);
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    if (step < STEPS.length - 1) return go(step + 1);
    setStatus("submitting");
    try {
      await onSubmit?.(v);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const addAllergy = () => {
    const a = allergyDraft.trim();
    if (a && !v.allergies.some((x) => x.toLowerCase() === a.toLowerCase())) {
      set("allergies", [...v.allergies, a]);
      set("noKnownAllergies", false);
    }
    setAllergyDraft("");
  };

  const toggleCondition = (c: string) => {
    if (c === "None of these") return set("conditions", v.conditions.includes(c) ? [] : [c]);
    const base = v.conditions.filter((x) => x !== "None of these");
    set("conditions", base.includes(c) ? base.filter((x) => x !== c) : [...base, c]);
  };

  if (status === "done")
    return (
      <Card className={cn("p-6 text-center font-crm text-crm-fg", className)} role="status">
        <h2 className="text-base font-medium">Intake received</h2>
        <p className="mt-1 text-xs text-crm-muted-fg">
          Thanks, {v.firstName}. The front desk will verify your coverage before your visit.
        </p>
      </Card>
    );

  const err = (k: keyof IntakeValues) => errors[k];

  return (
    <Card className={cn("flex flex-col font-crm text-crm-fg", className)}>
      <div className="border-b border-crm-border p-4">
        <Stepper steps={STEPS} current={step} onStepClick={go} />
      </div>
      <form
        noValidate
        className="flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
      >
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-medium outline-none">
          Step {step + 1} of {STEPS.length}: {STEPS[step]!.title}
        </h2>

        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First name" htmlFor="in-first" required error={err("firstName")}>
              <Input
                id="in-first"
                autoComplete="given-name"
                value={v.firstName}
                invalid={!!err("firstName")}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </FormField>
            <FormField label="Last name" htmlFor="in-last" required error={err("lastName")}>
              <Input
                id="in-last"
                autoComplete="family-name"
                value={v.lastName}
                invalid={!!err("lastName")}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </FormField>
            <FormField label="Date of birth" htmlFor="in-dob" required error={err("dob")}>
              <Input
                id="in-dob"
                type="date"
                autoComplete="bday"
                value={v.dob}
                invalid={!!err("dob")}
                onChange={(e) => set("dob", e.target.value)}
              />
            </FormField>
            <FormField label="Sex assigned at birth" htmlFor="in-sex">
              <Select
                id="in-sex"
                value={v.sex || undefined}
                onValueChange={(s) => set("sex", s as IntakeValues["sex"])}
                placeholder="Select"
                options={[
                  { value: "F", label: "Female" },
                  { value: "M", label: "Male" },
                  { value: "X", label: "Prefer not to say" },
                ]}
              />
            </FormField>
            <FormField label="Mobile phone" htmlFor="in-phone" required error={err("phone")}>
              <Input
                id="in-phone"
                type="tel"
                autoComplete="tel-national"
                inputMode="tel"
                value={v.phone}
                invalid={!!err("phone")}
                onChange={(e) => set("phone", formatUsPhone(e.target.value))}
              />
            </FormField>
            <FormField
              label="Email"
              htmlFor="in-email"
              hint="For visit summaries"
              error={err("email")}
            >
              <Input
                id="in-email"
                type="email"
                autoComplete="email"
                value={v.email}
                invalid={!!err("email")}
                onChange={(e) => set("email", e.target.value)}
              />
            </FormField>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={v.selfPay} onCheckedChange={(c) => set("selfPay", c === true)} />I
              don't have insurance / I'll self-pay
            </label>
            <fieldset
              disabled={v.selfPay}
              className={cn("grid gap-3 sm:grid-cols-2", v.selfPay && "opacity-50")}
            >
              <FormField label="Insurance carrier" htmlFor="in-ins" required error={err("insurer")}>
                <Select
                  id="in-ins"
                  value={v.insurer || undefined}
                  onValueChange={(s) => set("insurer", s)}
                  placeholder="Choose carrier"
                  invalid={!!err("insurer")}
                  options={insurers.map((i) => ({ value: i, label: i }))}
                  disabled={v.selfPay}
                />
              </FormField>
              <FormField label="Member ID" htmlFor="in-member" required error={err("memberId")}>
                <Input
                  id="in-member"
                  value={v.memberId}
                  invalid={!!err("memberId")}
                  onChange={(e) => set("memberId", e.target.value.toUpperCase().replace(/\s/g, ""))}
                />
              </FormField>
              <FormField label="Group number" htmlFor="in-group" hint="Optional">
                <Input
                  id="in-group"
                  value={v.groupNumber}
                  onChange={(e) => set("groupNumber", e.target.value)}
                />
              </FormField>
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <FormField
              label="Allergies"
              htmlFor="in-allergy"
              required
              error={err("allergies")}
              hint="Medication, food or latex. Press Enter to add."
            >
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    id="in-allergy"
                    value={allergyDraft}
                    disabled={v.noKnownAllergies}
                    invalid={!!err("allergies")}
                    placeholder="e.g. Penicillin"
                    onChange={(e) => setAllergyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAllergy();
                      }
                    }}
                  />
                  <Button type="button" onClick={addAllergy} disabled={!allergyDraft.trim()}>
                    Add
                  </Button>
                </div>
                {v.allergies.length ? (
                  <ul className="flex flex-wrap gap-1" aria-label="Listed allergies">
                    {v.allergies.map((a) => (
                      <li
                        key={a}
                        className="flex items-center gap-1 rounded-full border border-crm-danger/40 bg-crm-danger/10 py-0.5 pr-1 pl-2 text-xs text-crm-danger"
                      >
                        <ShieldAlert className="size-3" aria-hidden />
                        {a}
                        <button
                          type="button"
                          aria-label={`Remove ${a}`}
                          className="rounded-full p-0.5 hover:bg-crm-danger/20"
                          onClick={() =>
                            set(
                              "allergies",
                              v.allergies.filter((x) => x !== a),
                            )
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={v.noKnownAllergies}
                    disabled={v.allergies.length > 0}
                    onCheckedChange={(c) => {
                      set("noKnownAllergies", c === true);
                      setErrors((e) => ({ ...e, allergies: undefined }));
                    }}
                  />
                  No known allergies
                </label>
              </div>
            </FormField>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs text-crm-soft">
                Do you have any of these conditions?
              </legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {conditionOptions.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={v.conditions.includes(c)}
                      onCheckedChange={() => toggleCondition(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField
              label="Current medications"
              htmlFor="in-meds"
              hint="Name, dose and how often"
            >
              <Textarea
                id="in-meds"
                autoResize
                maxRows={6}
                value={v.medications}
                onChange={(e) => set("medications", e.target.value)}
              />
            </FormField>
            <FormField
              label="Reason for visit"
              htmlFor="in-reason"
              required
              error={err("reasonForVisit")}
            >
              <Textarea
                id="in-reason"
                showCount
                maxLength={400}
                value={v.reasonForVisit}
                invalid={!!err("reasonForVisit")}
                onChange={(e) => set("reasonForVisit", e.target.value)}
              />
            </FormField>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3 text-xs">
            <dl className="grid grid-cols-[110px_1fr] gap-y-1 rounded-crm border border-crm-border p-3">
              <dt className="text-crm-muted-fg">Patient</dt>
              <dd>
                {v.firstName} {v.lastName} · {v.dob}
              </dd>
              <dt className="text-crm-muted-fg">Coverage</dt>
              <dd>{v.selfPay ? "Self-pay" : `${v.insurer} · ${v.memberId}`}</dd>
              <dt className="text-crm-muted-fg">Allergies</dt>
              <dd className={v.allergies.length ? "text-crm-danger" : undefined}>
                {v.allergies.length ? v.allergies.join(", ") : "None known"}
              </dd>
              <dt className="text-crm-muted-fg">Reason</dt>
              <dd className="line-clamp-2">{v.reasonForVisit}</dd>
            </dl>
            <label className="flex items-start gap-2">
              <Checkbox
                checked={v.consentTreatment}
                aria-invalid={!!err("consentTreatment")}
                onCheckedChange={(c) => set("consentTreatment", c === true)}
              />
              <span>
                I consent to evaluation and treatment by the clinic's providers.
                {err("consentTreatment") ? (
                  <span className="block text-crm-danger">Required</span>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-2">
              <Checkbox
                checked={v.consentPrivacy}
                aria-invalid={!!err("consentPrivacy")}
                onCheckedChange={(c) => set("consentPrivacy", c === true)}
              />
              <span>
                I acknowledge receipt of the Notice of Privacy Practices.
                {err("consentPrivacy") ? (
                  <span className="block text-crm-danger">Required</span>
                ) : null}
              </span>
            </label>
            <FormField
              label="Signature (type your full name)"
              htmlFor="in-sign"
              required
              error={err("signature")}
            >
              <Input
                id="in-sign"
                value={v.signature}
                invalid={!!err("signature")}
                className="italic"
                onChange={(e) => set("signature", e.target.value)}
              />
            </FormField>
            {status === "error" ? (
              <p role="alert" className="text-crm-danger">
                We couldn't submit your intake. Check your connection and try again.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-crm-border pt-3">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
            Back
          </Button>
          <Button type="submit" variant="primary" loading={status === "submitting"}>
            {step === STEPS.length - 1 ? "Submit intake" : "Continue"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
