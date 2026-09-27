import { useState, type FormEvent } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { api } from "@ti/client";
import { ThemeToggle } from "./theme";
import { errorMessage } from "./types";
import { Button, inputClass } from "./ui";

export function Login({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      await api("/api/admin/login", {
        method: "POST",
        json: { username: f.get("username"), password: f.get("password") },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Login failed"));
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.06)_1px,transparent_0)] dark:[background-image:radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.07)_1px,transparent_0)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md">
            K
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Sign in to Kitbase
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin console for the component catalogue
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-background p-6 shadow-sm"
          aria-describedby={error ? "login-error" : undefined}
        >
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              name="username"
              required
              autoComplete="username"
              autoFocus
              aria-invalid={error ? true : undefined}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              className={inputClass}
            />
          </div>
          {error ? (
            <p
              id="login-error"
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden
              />
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
          <Lock className="size-3" aria-hidden />
          Restricted to administrators.
        </p>
      </div>
    </div>
  );
}
