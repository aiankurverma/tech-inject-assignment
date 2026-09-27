import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound, LogIn, TriangleAlert } from "lucide-react";
import { api, CodeBlock } from "@ti/client";
import { Layout } from "../Layout";
import { useSession } from "../session";
import { alertClass, btn, EmptyState, inputClass, PageHeader, PlanBadge, Skeleton } from "../ui";

interface Token {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

export function Account() {
  const { me, loadingMe } = useSession();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Token[]>("/api/tokens")
      .then(setTokens)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  if (loadingMe)
    return (
      <Layout>
        <div className="max-w-2xl space-y-4" role="status" aria-label="Loading account">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-8 h-40 w-full rounded-xl" />
        </div>
      </Layout>
    );
  if (!me) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <EmptyState
            icon={<LogIn className="size-5" />}
            title="Sign in to manage your account"
            action={
              <Link to="/sign-in" state={{ from: "/account" }} className={btn.primary}>
                Sign in
              </Link>
            }
          >
            Access tokens and plan details are available after you sign in.
          </EmptyState>
        </div>
      </Layout>
    );
  }

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name"));
    setError(null);
    try {
      const res = await api<{ token: string }>("/api/tokens", { method: "POST", json: { name } });
      setCreated(res.token);
      load();
      e.currentTarget?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create token");
    }
  };
  const onRevoke = async (id: string) => {
    await api(`/api/tokens/${id}`, { method: "DELETE" }).catch((e: Error) => setError(e.message));
    load();
  };

  return (
    <Layout>
      <div className="max-w-2xl">
        <PageHeader title="Account">
          <span className="flex flex-wrap items-center gap-2 text-base">
            {me.email} <PlanBadge plan={me.plan} />
          </span>
        </PageHeader>
        {me.plan === "free" ? (
          <p className="-mt-6 mb-10 rounded-lg border border-border bg-subtle px-4 py-3 text-sm text-muted-foreground">
            Premium components need a Premium plan. Ask the library admin to upgrade you.
          </p>
        ) : null}

        <section className="rounded-xl border border-border">
          <div className="border-b border-border p-5">
            <h2 className="text-base font-semibold text-foreground">Access tokens</h2>
            <div className="doc-prose mt-1">
              <p className="text-sm! leading-6! text-muted-foreground!">
                Used by the installer and AI agents via the <code>KITBASE_TOKEN</code> environment
                variable. A token gives the same access as your account right now; if your plan
                changes, the token follows.
              </p>
            </div>
            <form onSubmit={onCreate} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="token-name">
                Token name
              </label>
              <input
                id="token-name"
                name="name"
                required
                maxLength={60}
                placeholder="Token name, e.g. laptop"
                className={`${inputClass} sm:flex-1`}
              />
              <button type="submit" className={btn.primary}>
                Create token
              </button>
            </form>
            {error ? (
              <p role="alert" className={`${alertClass} mt-3 flex items-center gap-2`}>
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}
            {created ? (
              <div className="mt-4 space-y-3 rounded-lg border border-primary p-4">
                <p className="text-sm font-medium text-foreground">
                  Copy this token now. It will not be shown again.
                </p>
                <CodeBlock label="token" code={created} />
              </div>
            ) : null}
          </div>

          {tokens === null ? (
            <div className="space-y-3 p-5" role="status" aria-label="Loading tokens">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <KeyRound className="size-5 text-muted-foreground/70" aria-hidden />
              <p className="mt-2 text-sm text-muted-foreground">No tokens yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <span className="min-w-0 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{t.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {t.prefix}...
                      </code>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Created {new Date(t.createdAt).toLocaleDateString()}
                      {t.lastUsedAt
                        ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}`
                        : " · never used"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void onRevoke(t.id)}
                    className={`${btn.secondary} h-8 shrink-0 px-3 hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300`}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
