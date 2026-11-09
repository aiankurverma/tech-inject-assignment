import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowBigUp, CheckCircle2, Loader2, Send } from "lucide-react";
import { api, ApiError } from "@ti/client";
import { Layout } from "../components/Layout";
import { Breadcrumbs, btn, PageHeader } from "../components/ui";

type Status = "requested" | "building" | "in_review" | "live" | "rejected" | "duplicate";

interface RequestRow {
  id: string;
  title: string;
  description: string;
  useCase: string;
  status: Status;
  votes: number;
  componentSlug: string | null;
  creditName: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = {
  requested: "Requested",
  building: "Building",
  in_review: "In review",
  live: "Live",
  rejected: "Rejected",
  duplicate: "Already exists",
};

const statusClass = (status: Status) =>
  status === "live"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "building"
      ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
      : status === "in_review"
        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-border bg-muted text-muted-foreground";

const VOTER_KEY = "kitbase.demand.voter";
function voterToken() {
  try {
    const existing = localStorage.getItem(VOTER_KEY);
    if (existing) return existing;
    const token =
      globalThis.crypto?.randomUUID?.() ??
      `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VOTER_KEY, token);
    return token;
  } catch {
    return "anonymous";
  }
}

export function Requests() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [useCase, setUseCase] = useState("");
  const [creditOptIn, setCreditOptIn] = useState(false);
  const [notifyOptIn, setNotifyOptIn] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot: humans leave this empty
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [duplicateSlug, setDuplicateSlug] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ requests: RequestRow[] }>("/api/demand/requests")
      .then((r) => {
        setRows(r.requests);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice(null);
    setDuplicateSlug(null);
    try {
      const res = await api<{
        request: RequestRow;
        duplicate?: boolean;
        componentSlug?: string | null;
      }>("/api/demand/requests", {
        method: "POST",
        json: { title, description, useCase, creditOptIn, notifyOptIn, website },
      });
      setTitle("");
      setDescription("");
      setUseCase("");
      setCreditOptIn(false);
      setNotifyOptIn(false);
      if (res.duplicate && res.componentSlug) {
        setDuplicateSlug(res.componentSlug);
        setNotice("That component already exists. We linked it instead of creating a duplicate.");
      } else if (res.duplicate) {
        setNotice("Someone already requested this. We added your vote to the existing request.");
      } else {
        setNotice("Request received. Thank you — it is now on the public board.");
      }
      load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not submit the request.");
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async (id: string) => {
    try {
      const res = await api<{ votes: number }>(`/api/demand/requests/${id}/vote`, {
        method: "POST",
        json: { voterToken: voterToken() },
      });
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, votes: res.votes } : r)) ?? prev);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not record the vote.");
    }
  };

  return (
    <Layout wide>
      <Breadcrumbs items={[{ label: "Component requests" }]} />
      <PageHeader title="Request a component">
        Tell us what you are building and vote on what ships next. Requests move through Requested,
        Building, In review and Live. We only publish a page after quality checks and a human
        review, and we link an existing component instead of creating a duplicate.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Request board">
          <h2 className="mb-3 text-lg font-semibold">Public board</h2>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : !rows ? (
            <p className="text-sm text-muted-foreground">Loading requests...</p>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
              No requests yet. Be the first to ask.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{r.title}</h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(r.status)}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {r.description}
                      </p>
                      {r.useCase ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">Use case:</span>{" "}
                          {r.useCase}
                        </p>
                      ) : null}
                      {r.componentSlug ? (
                        <p className="mt-2 text-sm">
                          <Link
                            to={`/components/${r.componentSlug}`}
                            className="font-medium text-foreground underline-offset-2 hover:underline"
                          >
                            View the existing component
                          </Link>
                        </p>
                      ) : null}
                      {r.creditName ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Requested by {r.creditName}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void vote(r.id)}
                      className={`${btn.secondary} h-9 shrink-0 px-3`}
                      aria-label={`Upvote ${r.title}`}
                    >
                      <ArrowBigUp className="size-4" aria-hidden />
                      <span className="tabular-nums">{r.votes}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <h2 className="mb-3 text-lg font-semibold">Request a component</h2>
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border p-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Component name</span>
              <input
                required
                minLength={3}
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Deal pipeline board"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-foreground/30"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">What should it do?</span>
              <textarea
                required
                minLength={10}
                maxLength={600}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A kanban board with drag-and-drop deal stages..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-foreground/30"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Where will you use it?</span>
              <textarea
                maxLength={400}
                rows={2}
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="Inside our sales dashboard..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-foreground/30"
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={creditOptIn}
                onChange={(e) => setCreditOptIn(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              Credit me publicly when this ships (optional).
            </label>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={notifyOptIn}
                onChange={(e) => setNotifyOptIn(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              Email me when this ships. Sign in first so we can use your account email.
            </label>
            {/* Honeypot: hidden from people, tempting to bots. */}
            <label className="hidden" aria-hidden>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
            <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {submitting ? "Submitting..." : "Submit request"}
            </button>
            {notice ? (
              <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {notice}
                  {duplicateSlug ? (
                    <>
                      {" "}
                      <Link
                        to={`/components/${duplicateSlug}`}
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Open it
                      </Link>
                      .
                    </>
                  ) : null}
                </span>
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Do not include personal data. Requests are rate limited and checked for spam.
            </p>
          </form>
        </aside>
      </div>
    </Layout>
  );
}
