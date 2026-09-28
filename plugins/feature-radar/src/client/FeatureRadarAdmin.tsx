import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Hammer,
  Loader2,
  Radar,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  deleteFeatureRequest,
  FeatureApiError,
  generateDraft,
  getInsights,
  listFeatureRequests,
  patchFeatureRequest,
} from "./api";
import type { FeatureRequestRow, Insights } from "./api";

type FeatureStatus = FeatureRequestRow["status"];

interface BuildPrompt {
  id: string;
  etaDays: number;
}

/*
 * This plugin must stay self-contained (it cannot import the admin app), so the
 * few primitives below mirror the admin design system's classes (ui.tsx).
 */
const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950";

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
const btnVariant: Record<BtnVariant, string> = {
  primary:
    "bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-200",
  secondary:
    "border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-xs hover:bg-neutral-50 dark:hover:bg-neutral-800",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  ghost:
    "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-50",
};

function Btn({
  variant = "secondary",
  icon: Icon,
  loading = false,
  iconOnly = false,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & {
  variant?: BtnVariant;
  icon?: LucideIcon;
  loading?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
        iconOnly ? "w-8" : "px-3",
        focusRing,
        btnVariant[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-3.5" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

const STATUS: Record<FeatureStatus, { label: string; badge: string; dot: string }> = {
  new: {
    label: "New",
    badge:
      "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-200 dark:ring-sky-500/25",
    dot: "bg-sky-500",
  },
  valid: {
    label: "Valid",
    badge:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-500/25",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    badge:
      "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 ring-neutral-200 dark:ring-neutral-700",
    dot: "bg-neutral-400 dark:bg-neutral-500",
  },
  building: {
    label: "Building",
    badge:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-amber-200 dark:ring-amber-500/25",
    dot: "bg-amber-500",
  },
};

function StatusBadge({ status }: { status: FeatureStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        s.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

function BuildState({ row }: { row: FeatureRequestRow }) {
  let content: ReactNode = null;
  if (row.buildStatus === "running") {
    content = (
      <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Generating draft…
      </span>
    );
  } else if (row.buildStatus === "done") {
    content = (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" aria-hidden />
        Draft ready
        {row.draftSlug != null && (
          <a
            href={`/admin/components/${row.draftSlug}`}
            className={cn(
              "ml-1 inline-flex items-center gap-1 rounded font-medium text-neutral-900 dark:text-neutral-50 underline decoration-neutral-300 dark:decoration-neutral-600 underline-offset-2 hover:decoration-neutral-900 dark:hover:decoration-neutral-50",
              focusRing,
            )}
          >
            Open draft
            <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </span>
    );
  } else if (row.buildStatus === "failed") {
    content = (
      <span className="inline-flex items-start gap-1.5 text-red-700 dark:text-red-400">
        <XCircle className="mt-px size-3.5 shrink-0" aria-hidden />
        <span className="break-words">AI draft failed: {row.buildError ?? "unknown error"}</span>
      </span>
    );
  }
  return (
    <div className="mt-1.5 text-xs" aria-live="polite">
      {content}
    </div>
  );
}

function ConfirmDelete({
  term,
  loading,
  onConfirm,
  onCancel,
}: {
  term: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loadingRef.current) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      // Keep keyboard focus inside the dialog.
      const items = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [],
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-neutral-950/40 dark:bg-black/60 backdrop-blur-[2px]"
        onClick={() => !loading && onCancel()}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fr-delete-title"
        aria-describedby="fr-delete-desc"
        className="relative w-full max-w-md rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 p-5 shadow-xl"
      >
        <div className="flex gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20">
            <AlertTriangle className="size-5 text-red-600 dark:text-red-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2
              id="fr-delete-title"
              className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
            >
              Delete feature request?
            </h2>
            <p
              id="fr-delete-desc"
              className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400"
            >
              <span className="font-mono text-neutral-900 dark:text-neutral-50">{term}</span> and
              its search history will be removed. If users search for it again it will reappear as a
              new request.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Btn ref={cancelRef} onClick={onCancel} disabled={loading} className="h-9 text-sm">
            Cancel
          </Btn>
          <Btn variant="danger" onClick={onConfirm} loading={loading} className="h-9 text-sm">
            Delete request
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** Ranked clusters of similar searches with a one-click "Mark building". */
function InsightsView({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getInsights());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markBuilding(id: string) {
    setBusy(id);
    setError(null);
    try {
      await patchFeatureRequest(id, { status: "building", etaDays: 7 });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (error != null) {
    return (
      <div role="alert" className="px-5 py-8 text-center text-sm text-red-700 dark:text-red-300">
        {error}
        <div>
          <Btn icon={RefreshCw} onClick={() => void load()} className="mt-3">
            Try again
          </Btn>
        </div>
      </div>
    );
  }
  if (data == null) {
    return (
      <div role="status" className="px-5 py-8 text-sm text-neutral-500 dark:text-zinc-400">
        Loading insights…
      </div>
    );
  }
  if (data.clusters.length === 0) {
    return (
      <p className="px-5 py-12 text-center text-sm text-neutral-500 dark:text-zinc-400">
        No searches to learn from yet.
      </p>
    );
  }
  const max = Math.max(data.threshold, ...data.clusters.map((c) => c.demandScore));
  return (
    <ol className="divide-y divide-neutral-100 dark:divide-white/5">
      {data.clusters.map((c, i) => (
        <li key={c.canonicalId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:px-5">
          <span className="w-6 shrink-0 text-xs text-neutral-400 tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-medium text-neutral-900 dark:text-neutral-50">
                {c.canonicalTerm}
              </span>
              <StatusBadge status={c.status} />
              {c.suggestion === "suggest-build" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-200 dark:ring-violet-500/25">
                  <Sparkles className="size-3" aria-hidden />
                  Suggest build
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div
                role="meter"
                aria-label={`Demand score for ${c.canonicalTerm}`}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={c.demandScore}
                className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    c.demandScore >= data.threshold ? "bg-violet-500" : "bg-neutral-400",
                  )}
                  style={{ width: `${Math.round((c.demandScore / max) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-neutral-600 dark:text-neutral-400 tabular-nums">
                {c.demandScore.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-zinc-400">
              {c.totalCount} {c.totalCount === 1 ? "search" : "searches"} · last{" "}
              {formatDate(c.lastSearchedAt)}
            </p>
            {c.members.length > 1 && (
              <ul className="flex flex-wrap gap-1.5">
                {c.members.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-400"
                  >
                    {m.term} <span className="tabular-nums">×{m.searchCount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {c.status !== "building" && (
            <Btn
              icon={Hammer}
              loading={busy === c.canonicalId}
              onClick={() => void markBuilding(c.canonicalId)}
              aria-label={`Mark "${c.canonicalTerm}" as building`}
              className="self-start"
            >
              Mark building
            </Btn>
          )}
        </li>
      ))}
    </ol>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const th = "px-4 py-2.5 font-medium first:pl-5 last:pr-5";
const td = "px-4 py-3 align-middle first:pl-5 last:pr-5";
/** Shrinks a column to its content so the search term column takes the spare width. */
const fit = "w-px whitespace-nowrap";

/**
 * Admin panel for reviewing and acting on feature requests.
 * Drop into the admin UI; fetches from /api/admin/features.
 */
export function FeatureRadarAdmin() {
  const [rows, setRows] = useState<FeatureRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [buildPrompt, setBuildPrompt] = useState<BuildPrompt | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FeatureRequestRow | null>(null);
  const [view, setView] = useState<"requests" | "insights">("requests");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setError(null);
    try {
      setRows(await listFeatureRequests());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load feature requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll quietly every 3s while any AI draft build is running.
  const anyRunning = rows.some((r) => r.buildStatus === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const t = window.setInterval(() => {
      listFeatureRequests()
        .then(setRows)
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(t);
  }, [anyRunning]);

  async function generate(id: string) {
    setBusy(id);
    setError(null);
    try {
      await generateDraft(id);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, buildStatus: "running", buildError: null, draftSlug: null } : r,
        ),
      );
    } catch (e) {
      if (e instanceof FeatureApiError && e.status === 503) {
        setError("AI builder not configured (set ANTHROPIC_API_KEY)");
      } else {
        setError(e instanceof Error ? e.message : "Could not start the AI draft.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, status: FeatureStatus, etaDays?: number) {
    setBusy(id);
    setError(null);
    try {
      const updated = await patchFeatureRequest(id, { status, etaDays });
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
      setBuildPrompt(null);
    }
  }

  async function confirmDelete() {
    if (pendingDelete == null) return;
    const id = pendingDelete.id;
    setBusy(id);
    setError(null);
    try {
      await deleteFeatureRequest(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setPendingDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      setPendingDelete(null);
    } finally {
      setBusy(null);
    }
  }

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  function renderActions(r: FeatureRequestRow, layout: "row" | "stack") {
    const isBusy = busy === r.id;
    const isPrompting = buildPrompt?.id === r.id;
    const canTriage = r.status !== "building";
    return (
      <div
        className={cn("flex items-center gap-1.5", layout === "row" ? "justify-end" : "flex-wrap")}
      >
        {canTriage && isPrompting ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void act(r.id, "building", buildPrompt.etaDays);
            }}
          >
            <label
              htmlFor={`eta-${layout}-${r.id}`}
              className="text-xs whitespace-nowrap text-neutral-500 dark:text-zinc-400"
            >
              ETA (days)
            </label>
            <input
              id={`eta-${layout}-${r.id}`}
              type="number"
              min={1}
              max={90}
              autoFocus
              value={buildPrompt.etaDays}
              onChange={(e) =>
                setBuildPrompt({
                  id: r.id,
                  etaDays: Math.min(90, Math.max(1, parseInt(e.target.value, 10) || 7)),
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") setBuildPrompt(null);
              }}
              className={cn(
                "h-8 w-16 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 px-2 text-xs tabular-nums shadow-xs",
                focusRing,
              )}
            />
            <Btn
              type="submit"
              variant="primary"
              loading={isBusy}
              aria-label={`Confirm building "${r.term}"`}
            >
              Start
            </Btn>
            <Btn
              variant="ghost"
              iconOnly
              icon={X}
              onClick={() => setBuildPrompt(null)}
              aria-label="Cancel"
              title="Cancel"
            />
          </form>
        ) : canTriage ? (
          <>
            {r.status !== "valid" && (
              <Btn
                icon={CheckCircle2}
                disabled={isBusy}
                onClick={() => void act(r.id, "valid")}
                aria-label={`Mark "${r.term}" as valid`}
              >
                Valid
              </Btn>
            )}
            {r.status !== "rejected" && (
              <Btn
                icon={XCircle}
                disabled={isBusy}
                onClick={() => void act(r.id, "rejected")}
                aria-label={`Reject "${r.term}"`}
              >
                Reject
              </Btn>
            )}
            <Btn
              icon={Hammer}
              disabled={isBusy}
              onClick={() => setBuildPrompt({ id: r.id, etaDays: 7 })}
              aria-label={`Start building "${r.term}"`}
            >
              Build
            </Btn>
          </>
        ) : (
          <>
            {/* AI draft builder (never publishes; admin reviews the draft) */}
            <Btn
              icon={Sparkles}
              loading={isBusy || r.buildStatus === "running"}
              onClick={() => void generate(r.id)}
              aria-label={`Generate an AI draft component for "${r.term}"`}
            >
              {r.buildStatus === "running"
                ? "Generating…"
                : r.buildStatus === "done" || r.buildStatus === "failed"
                  ? "Regenerate"
                  : "Generate with AI"}
            </Btn>
            <Btn
              disabled={isBusy}
              onClick={() => void act(r.id, "valid")}
              aria-label={`Stop building "${r.term}" and mark valid`}
            >
              Stop
            </Btn>
          </>
        )}
        <Btn
          variant="ghost"
          iconOnly
          icon={Trash2}
          disabled={isBusy}
          onClick={() => setPendingDelete(r)}
          aria-label={`Delete "${r.term}"`}
          title={`Delete "${r.term}"`}
          className="hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
        />
      </div>
    );
  }

  let body: ReactNode;
  if (loading && rows.length === 0) {
    body = (
      <div
        role="status"
        aria-label="Loading"
        className="divide-y divide-neutral-100 dark:divide-white/5"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="h-3.5 w-1/4 animate-pulse rounded-md bg-neutral-200/70 dark:bg-white/10" />
            <div className="h-3.5 w-10 animate-pulse rounded-md bg-neutral-200/70 dark:bg-white/10" />
            <div className="h-5 w-16 animate-pulse rounded-md bg-neutral-200/70 dark:bg-white/10" />
            <div className="ml-auto h-7 w-40 animate-pulse rounded-md bg-neutral-200/70 dark:bg-white/10" />
          </div>
        ))}
        <span className="sr-only">Loading feature requests…</span>
      </div>
    );
  } else if (loadError != null) {
    body = (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 ring-1 ring-red-200 dark:ring-red-500/25">
          <AlertTriangle className="size-5 text-red-600 dark:text-red-400" aria-hidden />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
          Could not load feature requests
        </p>
        <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-zinc-400">{loadError}</p>
        <Btn icon={RefreshCw} onClick={() => void load()} className="mt-4">
          Try again
        </Btn>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-xs">
          <Radar className="size-5 text-neutral-500 dark:text-zinc-400" aria-hidden />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
          No feature requests yet
        </p>
        <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-zinc-400">
          When someone searches the catalogue for a component that doesn&apos;t exist, it shows up
          here for review.
        </p>
      </div>
    );
  } else {
    body = (
      <>
        <ul className="divide-y divide-neutral-100 dark:divide-white/5 sm:hidden">
          {rows.map((r) => (
            <li key={r.id} className="space-y-3 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-medium break-words text-neutral-900 dark:text-neutral-50">
                    {r.term}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-zinc-400">
                    {r.searchCount} {r.searchCount === 1 ? "search" : "searches"} · last{" "}
                    {formatDate(r.lastSearchedAt)}
                    {r.eta != null && <> · ETA {formatDate(r.eta)}</>}
                  </p>
                  {r.status === "building" && <BuildState row={r} />}
                </div>
                <StatusBadge status={r.status} />
              </div>
              {renderActions(r, "stack")}
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-neutral-900/50 text-xs text-neutral-500 dark:text-zinc-400">
              <tr>
                <th scope="col" className={th}>
                  Search term
                </th>
                <th scope="col" className={cn(th, fit, "text-right")}>
                  Searches
                </th>
                <th scope="col" className={cn(th, fit)}>
                  Status
                </th>
                <th scope="col" className={cn(th, fit)}>
                  ETA
                </th>
                <th scope="col" className={cn(th, fit)}>
                  Last searched
                </th>
                <th scope="col" className={cn(th, fit, "text-right")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="transition-colors hover:bg-neutral-50/60 dark:hover:bg-neutral-900/60"
                >
                  <td className={td}>
                    <span className="font-mono text-[13px] font-medium text-neutral-900 dark:text-neutral-50">
                      {r.term}
                    </span>
                    {r.status === "building" && <BuildState row={r} />}
                  </td>
                  <td
                    className={cn(
                      td,
                      "text-right text-neutral-700 dark:text-neutral-300 tabular-nums",
                    )}
                  >
                    {r.searchCount}
                  </td>
                  <td className={td}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={cn(td, "whitespace-nowrap text-neutral-500 dark:text-zinc-400")}>
                    {r.eta != null ? formatDate(r.eta) : "—"}
                  </td>
                  <td className={cn(td, "whitespace-nowrap text-neutral-500 dark:text-zinc-400")}>
                    {formatDate(r.lastSearchedAt)}
                  </td>
                  <td className={td}>{renderActions(r, "row")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="fr-heading">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 dark:border-white/10 px-4 py-3 sm:items-center sm:px-5">
        <div className="min-w-0">
          <h2
            id="fr-heading"
            className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50"
          >
            Requests
            {!loading && loadError == null && (
              <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">
                {rows.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-zinc-400">
            Triage searches with no match, then build the ones worth shipping.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            role="tablist"
            aria-label="Feature radar view"
            className="inline-flex rounded-lg border border-neutral-200 dark:border-white/10 p-0.5"
          >
            {(["requests", "insights"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-medium capitalize transition-colors",
                  focusRing,
                  view === v
                    ? "bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Btn
            icon={RefreshCw}
            loading={loading}
            onClick={() => void load()}
            aria-label="Refresh requests"
            className="max-sm:w-8 max-sm:px-0"
          >
            <span className="hidden sm:inline">Refresh</span>
          </Btn>
        </div>
      </div>

      {error != null && (
        <div
          role="alert"
          className="mx-4 mt-4 flex gap-3 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200 sm:mx-5"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className={cn(
              "rounded p-0.5 text-red-500 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
              focusRing,
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {view === "insights" ? (
        <InsightsView key={String(loading)} onChanged={() => void load()} />
      ) : (
        body
      )}

      {pendingDelete != null && (
        <ConfirmDelete
          term={pendingDelete.term}
          loading={busy === pendingDelete.id}
          onConfirm={() => void confirmDelete()}
          onCancel={cancelDelete}
        />
      )}
    </section>
  );
}
