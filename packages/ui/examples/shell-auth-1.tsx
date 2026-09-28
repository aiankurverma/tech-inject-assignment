import { useState, type FormEvent } from "react";
import { Hexagon, KeyRound } from "lucide-react";
import { ShellAuth } from "@/components/crm/shell-auth";
import { FormField, Input } from "@/components/crm/input";
import { PasswordInput } from "@/components/crm/password-input";
import { Button } from "@/components/crm/button";
import { Alert } from "@/components/crm/alert";
import { Divider } from "@/components/crm/divider";
import { Select } from "@/components/crm/select";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export default function Example() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [region, setRegion] = useState("us");
  const [done, setDone] = useState(false);

  const emailError = touched && !emailOk(email) ? "Enter a valid work email." : undefined;
  const pwError = touched && password.length < 8 ? "At least 8 characters." : undefined;
  const ssoDomain = email.endsWith("@northwind.com");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!emailOk(email) || (!ssoDomain && password.length < 8)) return;
    setLoading(true);
    setError(undefined);
    setTimeout(() => {
      setLoading(false);
      if (password === "wrongpass1")
        setError("Email or password is incorrect. 2 attempts left before a 15-minute lock.");
      else setDone(true);
    }, 800);
  };

  return (
    <div className="h-[680px] overflow-hidden rounded-crm border border-crm-border">
      <ShellAuth
        brand={{ name: "Acme CRM", logo: <Hexagon /> }}
        title="Sign in to your workspace"
        subtitle="Use your work email. SSO users are redirected automatically."
        topRight={
          <Select
            aria-label="Data region"
            value={region}
            onValueChange={setRegion}
            className="h-8 w-32 text-xs"
            options={[
              { value: "us", label: "US region" },
              { value: "eu", label: "EU region" },
              { value: "in", label: "India region" },
            ]}
          />
        }
        footer={
          <>
            New to Acme?{" "}
            <a href="#signup" className="text-crm-fg underline-offset-2 hover:underline">
              Start a 14-day trial
            </a>
          </>
        }
        legalLinks={[
          { label: "Terms", href: "#terms" },
          { label: "Privacy", href: "#privacy" },
          { label: "Status", href: "#status" },
        ]}
        panel={{
          headline: "The CRM your reps actually keep up to date.",
          testimonials: [
            {
              quote: "We cut forecast prep from two days to forty minutes in the first quarter.",
              name: "Dana Whitfield",
              role: "VP Sales, Northwind",
            },
            {
              quote: "Pipeline hygiene went from a Friday chore to something that just happens.",
              name: "Luca Bianchi",
              role: "RevOps Lead, Contoso",
            },
          ],
          stats: [
            { value: "4,200+", label: "Sales teams" },
            { value: "99.98%", label: "Uptime (12 mo)" },
            { value: "SOC 2", label: "Type II" },
          ],
        }}
      >
        {done ? (
          <Alert tone="success" title="Signed in">
            Redirecting to your {region.toUpperCase()} workspace…
          </Alert>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            {error ? (
              <Alert tone="danger" title="Couldn't sign in">
                {error}
              </Alert>
            ) : null}
            <FormField label="Work email" htmlFor="auth-email" error={emailError}>
              <Input
                id="auth-email"
                type="email"
                autoComplete="username"
                value={email}
                invalid={!!emailError}
                aria-describedby="auth-email-msg"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </FormField>
            {ssoDomain ? (
              <Alert
                tone="info"
                title="Northwind uses single sign-on"
                icon={<KeyRound className="size-4" />}
              >
                Continue to sign in with Okta.
              </Alert>
            ) : (
              <FormField label="Password" htmlFor="auth-pw" error={pwError}>
                <PasswordInput
                  id="auth-pw"
                  autoComplete="current-password"
                  value={password}
                  invalid={!!pwError}
                  aria-describedby="auth-pw-msg"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>
            )}
            <Button type="submit" variant="primary" size="lg" loading={loading}>
              {ssoDomain ? "Continue with SSO" : "Sign in"}
            </Button>
            <Divider label="or" />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="lg">
                Google
              </Button>
              <Button type="button" size="lg">
                Microsoft
              </Button>
            </div>
          </form>
        )}
      </ShellAuth>
    </div>
  );
}
