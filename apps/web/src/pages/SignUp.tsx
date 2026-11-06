import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Layout } from "../components/Layout";
import { useSession } from "../context/session";
import { alertClass, btn, inputClass } from "../components/ui";

export function SignUp() {
  const { signUp } = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await signUp(
        String(form.get("name")),
        String(form.get("email")),
        String(form.get("password")),
      );
      navigate(from.startsWith("/") ? from : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout wide>
      <div className="mx-auto mt-10 max-w-sm sm:mt-20">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground">
            K
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Free to join. Every published component is available without a paid plan.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-background p-6 shadow-xs"
        >
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-foreground">Name</span>
            <input
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Ada Lovelace"
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-foreground">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-foreground">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </label>
          {error ? (
            <p role="alert" className={alertClass}>
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/sign-in"
            state={{ from }}
            className="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
          >
            Sign in
          </Link>
        </p>
      </div>
    </Layout>
  );
}
