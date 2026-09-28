import * as React from "react";
import { Check, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { FormField, Input } from "@/components/crm/input";
import { PasswordInput } from "@/components/crm/password-input";
import { Select } from "@/components/crm/select";

export interface SignUpValues {
  fullName: string;
  email: string;
  company: string;
  teamSize: string;
  password: string;
  marketingOptIn: boolean;
}

export interface ExistingWorkspace {
  /** Email domain that maps to this workspace, e.g. "acme.com". */
  domain: string;
  name: string;
  members: number;
}

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string, values: { email: string; fullName: string }) => boolean;
}

export const DEFAULT_PASSWORD_RULES: PasswordRule[] = [
  { id: "len", label: "At least 10 characters", test: (p) => p.length >= 10 },
  {
    id: "case",
    label: "Upper and lower case letters",
    test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  },
  { id: "num", label: "A number or symbol", test: (p) => /[\d\W_]/.test(p) },
  {
    id: "personal",
    label: "Doesn't contain your name or email",
    test: (p, v) => {
      const lower = p.toLowerCase();
      const parts = [v.email.split("@")[0] ?? "", ...v.fullName.split(/\s+/)]
        .map((s) => s.toLowerCase())
        .filter((s) => s.length >= 3);
      return p.length > 0 && !parts.some((s) => lower.includes(s));
    },
  },
];

const FREE_MAIL = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
];

const TEAM_SIZES = [
  { value: "1-10", label: "1-10 people" },
  { value: "11-50", label: "11-50 people" },
  { value: "51-200", label: "51-200 people" },
  { value: "201-1000", label: "201-1,000 people" },
  { value: "1000+", label: "1,000+ people" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SignUpProps {
  /** Resolve a string (or throw) to show a form-level error. */
  onSubmit: (values: SignUpValues) => Promise<string | void> | string | void;
  /** Ask to join a workspace matched by email domain instead of creating a new one. */
  onJoinWorkspace?: (workspace: ExistingWorkspace, email: string) => void;
  existingWorkspaces?: ExistingWorkspace[];
  /** Reject personal email providers (gmail.com, outlook.com...). */
  requireWorkEmail?: boolean;
  passwordRules?: PasswordRule[];
  onSignIn?: () => void;
  termsHref?: string;
  privacyHref?: string;
  className?: string;
}

type Field = "fullName" | "email" | "company" | "teamSize" | "password" | "confirm" | "terms";

/** Account creation with work-email check, workspace-by-domain matching, live password rules and terms consent. */
export function SignUp({
  onSubmit,
  onJoinWorkspace,
  existingWorkspaces = [],
  requireWorkEmail = true,
  passwordRules = DEFAULT_PASSWORD_RULES,
  onSignIn,
  termsHref = "#",
  privacyHref = "#",
  className,
}: SignUpProps) {
  const id = React.useId();
  const [v, setV] = React.useState({
    fullName: "",
    email: "",
    company: "",
    teamSize: "",
    password: "",
    confirm: "",
  });
  const [terms, setTerms] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);
  const [touched, setTouched] = React.useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));
  const blur = (k: Field) => () => setTouched((t) => ({ ...t, [k]: true }));

  const email = v.email.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const match = EMAIL_RE.test(email)
    ? existingWorkspaces.find((w) => w.domain.toLowerCase() === domain)
    : undefined;

  const rules = passwordRules.map((r) => ({
    ...r,
    ok: r.test(v.password, { email, fullName: v.fullName }),
  }));
  const passwordOk = rules.every((r) => r.ok);

  const errors: Partial<Record<Field, string>> = {};
  if (v.fullName.trim().length < 2) errors.fullName = "Enter your full name.";
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  else if (requireWorkEmail && FREE_MAIL.includes(domain))
    errors.email = `Use your work email - ${domain} addresses aren't accepted.`;
  if (!match && !v.company.trim()) errors.company = "Enter your company name.";
  if (!match && !v.teamSize) errors.teamSize = "Choose a team size.";
  if (!passwordOk) errors.password = "Password doesn't meet every requirement yet.";
  if (!v.confirm || v.confirm !== v.password) errors.confirm = "Passwords don't match.";
  if (!terms) errors.terms = "Accept the terms to continue.";

  const show = (k: Field) => (submitted || touched[k] ? errors[k] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length || loading) {
      const first = (Object.keys(errors) as Field[])[0];
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      const res = await onSubmit({
        fullName: v.fullName.trim(),
        email,
        company: (match?.name ?? v.company).trim(),
        teamSize: v.teamSize,
        password: v.password,
        marketingOptIn: marketing,
      });
      if (typeof res === "string") setFormError(res);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setLoading(false);
    }
  };

  const describe = (k: Field) => (show(k) ? `${id}-${k}-msg` : undefined);

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col gap-6 rounded-crm border border-crm-border bg-crm-card p-6 font-crm shadow-crm-raised sm:p-8",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <span className="crm-eyebrow text-crm-subtle">14-day free trial · no card required</span>
        <h1 className="text-lg font-semibold text-crm-fg">Create your account</h1>
      </header>

      <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-busy={loading}>
        {formError ? (
          <Alert tone="danger" title="Sign-up failed">
            {formError}
          </Alert>
        ) : null}

        <FormField label="Full name" htmlFor={`${id}-fullName`} error={show("fullName")} required>
          <Input
            id={`${id}-fullName`}
            autoComplete="name"
            placeholder="Priya Raman"
            value={v.fullName}
            invalid={!!show("fullName")}
            aria-describedby={describe("fullName")}
            onChange={set("fullName")}
            onBlur={blur("fullName")}
          />
        </FormField>

        <FormField label="Work email" htmlFor={`${id}-email`} error={show("email")} required>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            placeholder="priya@company.com"
            value={v.email}
            invalid={!!show("email")}
            aria-describedby={describe("email")}
            onChange={set("email")}
            onBlur={blur("email")}
          />
        </FormField>

        {match ? (
          <Alert
            tone="info"
            icon={<Users />}
            title={`${match.name} is already on the platform`}
            action={
              onJoinWorkspace ? (
                <Button
                  size="sm"
                  variant="primary"
                  type="button"
                  onClick={() => onJoinWorkspace(match, email)}
                >
                  Request to join
                </Button>
              ) : undefined
            }
          >
            {match.members.toLocaleString()} teammates with @{match.domain} emails use this
            workspace. Your account will be added to it.
          </Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company" htmlFor={`${id}-company`} error={show("company")} required>
              <Input
                id={`${id}-company`}
                autoComplete="organization"
                placeholder="Northwind Labs"
                value={v.company}
                invalid={!!show("company")}
                aria-describedby={describe("company")}
                onChange={set("company")}
                onBlur={blur("company")}
              />
            </FormField>
            <FormField
              label="Team size"
              htmlFor={`${id}-teamSize`}
              error={show("teamSize")}
              required
            >
              <Select
                id={`${id}-teamSize`}
                options={TEAM_SIZES}
                value={v.teamSize}
                placeholder="Select..."
                invalid={!!show("teamSize")}
                onValueChange={(val) => {
                  setV((s) => ({ ...s, teamSize: val }));
                  setTouched((t) => ({ ...t, teamSize: true }));
                }}
              />
            </FormField>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-password`} className="text-xs text-crm-soft">
            Password <span className="text-crm-subtle">*</span>
          </label>
          <PasswordInput
            id={`${id}-password`}
            autoComplete="new-password"
            showStrength
            value={v.password}
            invalid={!!show("password")}
            aria-describedby={`${id}-rules`}
            onChange={set("password")}
            onBlur={blur("password")}
          />
          <ul
            id={`${id}-rules`}
            className="mt-1 grid gap-1 sm:grid-cols-2"
            aria-label="Password requirements"
          >
            {rules.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  r.ok
                    ? "text-crm-success"
                    : show("password")
                      ? "text-crm-danger"
                      : "text-crm-subtle",
                )}
              >
                {r.ok ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                )}
                {r.label}
                <span className="sr-only">{r.ok ? "(met)" : "(not met)"}</span>
              </li>
            ))}
          </ul>
        </div>

        <FormField
          label="Confirm password"
          htmlFor={`${id}-confirm`}
          error={show("confirm")}
          required
        >
          <PasswordInput
            id={`${id}-confirm`}
            autoComplete="new-password"
            value={v.confirm}
            invalid={!!show("confirm")}
            aria-describedby={describe("confirm")}
            onChange={set("confirm")}
            onBlur={blur("confirm")}
          />
        </FormField>

        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-crm-soft">
            <Checkbox
              id={`${id}-terms`}
              className="mt-0.5"
              checked={terms}
              aria-invalid={!!show("terms") || undefined}
              aria-describedby={describe("terms")}
              onCheckedChange={(c) => {
                setTerms(c === true);
                setTouched((t) => ({ ...t, terms: true }));
              }}
            />
            <span>
              I agree to the{" "}
              <a href={termsHref} className="text-crm-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href={privacyHref} className="text-crm-primary hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          {show("terms") ? (
            <p id={`${id}-terms-msg`} role="alert" className="text-xs text-crm-danger">
              {show("terms")}
            </p>
          ) : null}
          <label className="flex cursor-pointer items-start gap-2 text-xs text-crm-soft">
            <Checkbox
              className="mt-0.5"
              checked={marketing}
              onCheckedChange={(c) => setMarketing(c === true)}
            />
            Send me product updates and best-practice guides (optional).
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full justify-center"
          loading={loading}
        >
          {match ? `Create account and join ${match.name}` : "Create account"}
        </Button>
      </form>

      {onSignIn ? (
        <p className="text-center text-xs text-crm-soft">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSignIn}
            className="rounded text-crm-primary hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/40 focus-visible:outline-none"
          >
            Sign in
          </button>
        </p>
      ) : null}
    </div>
  );
}
