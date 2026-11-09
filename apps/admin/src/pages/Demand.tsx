import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ClipboardCheck,
  FileDown,
  FileText,
  Gauge,
  Inbox,
  Loader2,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
  X,
} from "lucide-react";
import { api } from "@ti/client";
import { useLoad } from "../hooks/useLoad";
import { errorMessage, relativeTime } from "../types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
  Table,
  Td,
  Th,
  THead,
  cn,
  focusRing,
  inputClass,
  useFocusTrap,
  useToast,
} from "../components/ui";

/* ------------------------------------------------------------------ types */

type Decision = "pending" | "build" | "improve" | "ignore";
type Tab = "opportunities" | "requests" | "signals" | "quality" | "notifications" | "audit";

interface Settings {
  killSwitch: boolean;
  autoBuild: boolean;
  autoPublish: boolean;
  buildThreshold: number;
  voteThreshold: number;
  maxPublishPerDay: number;
  publishedDay: string;
  publishedToday: number;
}

interface Overview {
  settings: Settings;
  signals: number;
  opportunities: { _id: string; n: number }[];
  requests: number;
  qualityPassed: number;
  pendingNotifications: number;
  publishedComponents: number;
}

interface Evidence {
  searches: number;
  upvotes: number;
  impressions: number;
  clicks: number;
  zeroResultRate: number;
}

interface Opportunity {
  _id: string;
  canonicalQuery: string;
  memberQueries: string[];
  demandScore: number;
  evidence: Evidence;
  decision: Decision;
  reasons: string[];
  status: string;
  draftSlug?: string | null;
  qualityReportId?: string | null;
  buildStatus?: string | null;
  buildError?: string | null;
  rejectionReason?: string | null;
  updatedAt: string;
}

interface Check {
  id: string;
  label: string;
  status: "pass" | "fail" | "manual";
  detail: string;
}

interface Report {
  _id: string;
  draftSlug: string;
  checks: Check[];
  passed: boolean;
  createdAt: string;
}

interface RequestRow {
  id: string;
  title: string;
  description: string;
  useCase: string;
  status: string;
  votes: number;
  componentSlug: string | null;
  creditName: string | null;
  createdAt: string;
}

interface SignalRow {
  _id: string;
  query: string;
  source: string;
  count: number;
  upvotes: number;
  impressions: number;
  clicks: number;
  zeroResultCount: number;
  status: string;
  lastSeen: string;
  matchedComponentSlug?: string | null;
}

interface NotificationRow {
  _id: string;
  email: string;
  componentSlug: string;
  status: "pending" | "sent" | "skipped";
  createdAt: string;
}

interface AuditRow {
  _id: string;
  action: string;
  actor: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

interface PageData {
  overview: Overview;
  opportunities: Opportunity[];
  reports: Report[];
}

/* --------------------------------------------------------------- helpers */

const statusVariant = (status: string) => {
  if (["published", "live", "pass", "approved_to_publish"].includes(status))
    return "success" as const;
  if (["rejected", "fail", "ignore"].includes(status)) return "danger" as const;
  if (["review", "in_review", "building", "drafting", "manual", "reviewing"].includes(status))
    return "warning" as const;
  if (["approved", "build"].includes(status)) return "info" as const;
  return "neutral" as const;
};

const decisionLabel: Record<Decision, string> = {
  pending: "Pending",
  build: "Build",
  improve: "Improve",
  ignore: "Ignore",
};

const sourceLabel: Record<string, string> = {
  site_search: "On-site search",
  request_board: "Request board",
  search_console_import: "Search Console",
  manual: "Manual",
};

const reportFor = (opp: Opportunity, reports: Report[]) =>
  opp.qualityReportId ? (reports.find((r) => r._id === opp.qualityReportId) ?? null) : null;

/* --------------------------------------------------------------- settings */

function SettingsCard({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(settings), [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/demand/settings", { method: "PATCH", json: draft });
      toast.success("Demand settings saved");
      onSaved();
    } catch (e) {
      toast.error("Could not save settings", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: "killSwitch" | "autoBuild" | "autoPublish") => (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {key === "killSwitch"
            ? "Kill switch"
            : key === "autoBuild"
              ? "Auto-build"
              : "Auto-publish"}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {key === "killSwitch"
            ? "Stops drafting and publishing immediately."
            : key === "autoBuild"
              ? "Queue an AI draft when an opportunity passes the threshold."
              : "Publish approved drafts without a second click. Keep this off unless you are watching."}
        </span>
      </span>
      <input
        type="checkbox"
        checked={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
        className="size-4 shrink-0 accent-primary"
        aria-label={key}
      />
    </label>
  );

  return (
    <Card>
      <CardHeader
        title="Safety settings"
        description="Every publish still needs a passing quality report. These switches bound how much can happen unattended."
        actions={
          <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>
            Save settings
          </Button>
        }
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {toggle("killSwitch")}
        {toggle("autoBuild")}
        {toggle("autoPublish")}
        <label className="rounded-lg border border-border px-3 py-2.5">
          <span className="block text-xs font-medium text-muted-foreground">Build threshold</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={draft.buildThreshold}
            onChange={(e) => setDraft({ ...draft, buildThreshold: Number(e.target.value) || 1 })}
            className={cn(inputClass, "mt-1")}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Searches (plus 2× upvotes) before an opportunity is worth building.
          </span>
        </label>
        <label className="rounded-lg border border-border px-3 py-2.5">
          <span className="block text-xs font-medium text-muted-foreground">Vote threshold</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={draft.voteThreshold}
            onChange={(e) => setDraft({ ...draft, voteThreshold: Number(e.target.value) || 1 })}
            className={cn(inputClass, "mt-1")}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Board upvotes that also qualify a request.
          </span>
        </label>
        <label className="rounded-lg border border-border px-3 py-2.5">
          <span className="block text-xs font-medium text-muted-foreground">
            Max publishes / day
          </span>
          <input
            type="number"
            min={1}
            max={100}
            value={draft.maxPublishPerDay}
            onChange={(e) => setDraft({ ...draft, maxPublishPerDay: Number(e.target.value) || 1 })}
            className={cn(inputClass, "mt-1")}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Today: {settings.publishedToday} published. Hard cap for the batch.
          </span>
        </label>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------- reject form */

function RejectDialog({
  opportunity,
  onClose,
  onDone,
}: {
  opportunity: Opportunity;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useFocusTrap(true, ref, onClose);

  const submit = async () => {
    if (reason.trim().length < 3) return;
    setBusy(true);
    try {
      await api(`/api/admin/demand/opportunities/${opportunity._id}/reject`, {
        method: "POST",
        json: { reason: reason.trim() },
      });
      toast.success("Opportunity rejected", "The reason is kept as feedback for future drafts.");
      onDone();
    } catch (e) {
      toast.error("Could not reject", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Reject ${opportunity.canonicalQuery}`}
        className="relative w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold text-foreground">Reject this idea</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rejecting “{opportunity.canonicalQuery}” keeps it out of future scans. The reason is
          stored in the weekly report.
        </p>
        <label className="mt-4 block text-sm font-medium text-foreground">
          Reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={400}
            className={cn(inputClass, "mt-1 h-auto py-2")}
            placeholder="Too similar to the pipeline board, or not a CRM component."
            data-autofocus
          />
        </label>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={() => void submit()}
          >
            Reject opportunity
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- report modal */

function ReportDialog({
  markdown,
  file,
  onClose,
}: {
  markdown: string;
  file: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(true, ref, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Weekly demand report"
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Weekly demand report</h2>
            <p className="truncate text-xs text-muted-foreground">{file}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close report">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto p-5 text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
          {markdown}
        </pre>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- quality panel */

function QualityPanel({
  report,
  onConfirm,
  busy,
}: {
  report: Report;
  onConfirm: (checks: string[]) => Promise<void>;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const manual = report.checks.filter((c) => c.status === "manual");
  return (
    <div className="mt-3 rounded-lg border border-border bg-subtle/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          Quality gate · {report.passed ? "passed" : "not passed"}
        </p>
        <span className="text-[11px] text-muted-foreground">{relativeTime(report.createdAt)}</span>
      </div>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {report.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-xs">
            <Badge variant={statusVariant(c.status)} className="shrink-0 px-1.5 py-0 text-[10px]">
              {c.status}
            </Badge>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{c.label}</span>
              <span className="block text-muted-foreground">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {manual.length ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            Manual checks block publishing until confirmed
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {manual.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id),
                    )
                  }
                  className="size-3.5 accent-amber-600"
                />
                {c.label}
              </label>
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            loading={busy}
            disabled={!selected.length}
            onClick={() => void onConfirm(selected)}
          >
            Confirm selected checks
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------- opportunity card */

function OpportunityCard({
  opp,
  report,
  busy,
  onAction,
  onReject,
}: {
  opp: Opportunity;
  report: Report | null;
  busy: boolean;
  onAction: (fn: () => Promise<unknown>, message: string) => void;
  onReject: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmingChecks, setConfirmingChecks] = useState(false);
  const published = opp.status === "published";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{opp.canonicalQuery}</h3>
            <Badge variant={statusVariant(opp.decision)}>{decisionLabel[opp.decision]}</Badge>
            <Badge variant={statusVariant(opp.status)} dot>
              {opp.status.replace(/_/g, " ")}
            </Badge>
            {opp.draftSlug ? (
              <Link
                to={`/components/${opp.draftSlug}`}
                className={cn(
                  "inline-flex items-center gap-1 text-xs text-sky-700 hover:underline dark:text-sky-400",
                  focusRing,
                )}
              >
                {opp.draftSlug}
                <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Score{" "}
            <span className="font-medium tabular-nums text-foreground">{opp.demandScore}</span> ·{" "}
            {opp.evidence.searches} searches · {opp.evidence.upvotes} upvotes ·{" "}
            {opp.evidence.impressions} impressions · {opp.evidence.clicks} clicks
            {opp.evidence.zeroResultRate > 0
              ? ` · ${Math.round(opp.evidence.zeroResultRate * 100)}% zero-result`
              : ""}
          </p>
          {opp.memberQueries.length > 1 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Clustered queries: {opp.memberQueries.join(", ")}
            </p>
          ) : null}
        </div>
        <span className="text-[11px] text-muted-foreground">{relativeTime(opp.updatedAt)}</span>
      </div>

      {opp.reasons.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {opp.reasons.slice(0, 4).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      ) : null}
      {opp.buildError ? (
        <Alert variant="danger" className="mt-3" title="AI draft failed">
          {opp.buildError}
        </Alert>
      ) : null}
      {opp.rejectionReason ? (
        <Alert variant="warning" className="mt-3" title="Rejected">
          {opp.rejectionReason}
        </Alert>
      ) : null}

      {report ? (
        <QualityPanel
          report={report}
          busy={confirmingChecks}
          onConfirm={async (checks) => {
            setConfirmingChecks(true);
            try {
              await api(`/api/admin/demand/quality/${report._id}/confirm`, {
                method: "POST",
                json: { checks },
              });
              onAction(async () => undefined, "Manual checks confirmed");
            } finally {
              setConfirmingChecks(false);
            }
          }}
        />
      ) : null}

      {!published ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant={opp.decision === "build" ? "primary" : "secondary"}
            disabled={busy}
            icon={ThumbsUp}
            onClick={() =>
              onAction(
                () =>
                  api(`/api/admin/demand/opportunities/${opp._id}`, {
                    method: "PATCH",
                    json: { decision: "build" },
                  }),
                "Marked for build",
              )
            }
          >
            Build
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            icon={Gauge}
            onClick={() =>
              onAction(
                () =>
                  api(`/api/admin/demand/opportunities/${opp._id}`, {
                    method: "PATCH",
                    json: { decision: "improve" },
                  }),
                "Marked to improve the existing page",
              )
            }
          >
            Improve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            icon={Sparkles}
            onClick={() =>
              onAction(
                () => api(`/api/admin/demand/opportunities/${opp._id}/draft`, { method: "POST" }),
                "AI draft queued",
              )
            }
          >
            Draft with AI
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !opp.draftSlug}
            icon={ClipboardCheck}
            onClick={() =>
              onAction(
                () => api(`/api/admin/demand/opportunities/${opp._id}/quality`, { method: "POST" }),
                "Quality gate finished",
              )
            }
          >
            Run quality gate
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !report?.passed}
            icon={Check}
            onClick={() =>
              onAction(
                () => api(`/api/admin/demand/opportunities/${opp._id}/approve`, { method: "POST" }),
                "Approved to publish",
              )
            }
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="success"
            disabled={busy || opp.status !== "approved_to_publish"}
            icon={Rocket}
            onClick={() => setConfirming(true)}
          >
            Publish
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} icon={ThumbsDown} onClick={onReject}>
            Reject
          </Button>
          {busy ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-emerald-700 dark:text-emerald-400">
          Live at{" "}
          <Link to={`/components/${opp.draftSlug ?? ""}`} className="underline">
            /components/{opp.draftSlug}
          </Link>
          . Requesters who opted in have a pending notification record; no email is sent
          automatically.
        </p>
      )}

      {confirming ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
            Publish “{opp.canonicalQuery}” to the public catalogue?
          </p>
          <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-200/80">
            This adds a public page, sitemap entry and registry item. It cannot be undone from here.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="success"
              loading={busy}
              onClick={() => {
                setConfirming(false);
                onAction(
                  () =>
                    api(`/api/admin/demand/opportunities/${opp._id}/publish`, { method: "POST" }),
                  "Published to the public catalogue",
                );
              }}
            >
              Publish now
            </Button>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------- tabs */

function RequestsTab() {
  const { data, error, loading, reload } = useLoad(() =>
    api<RequestRow[]>("/api/admin/demand/requests"),
  );
  if (error)
    return (
      <Card>
        <ErrorState message={error} onRetry={() => void reload()} />
      </Card>
    );
  if (loading && !data)
    return (
      <Card className="p-4">
        <Skeleton className="h-40" />
      </Card>
    );
  const rows = data ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Request board" description="Public requests, votes and status." />
      {rows.length ? (
        <Table label="Public requests">
          <THead>
            <tr>
              <Th>Request</Th>
              <Th>Status</Th>
              <Th>Votes</Th>
              <Th>Credit</Th>
              <Th>Created</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {r.description}
                  </p>
                  {r.componentSlug ? (
                    <Link
                      to={`/components/${r.componentSlug}`}
                      className="mt-1 inline-block text-xs text-sky-700 hover:underline dark:text-sky-400"
                    >
                      /components/{r.componentSlug}
                    </Link>
                  ) : null}
                </Td>
                <Td>
                  <Badge variant={statusVariant(r.status)} dot>
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                </Td>
                <Td className="tabular-nums">{r.votes}</Td>
                <Td className="text-xs text-muted-foreground">{r.creditName ?? "—"}</Td>
                <Td className="text-xs text-muted-foreground">{relativeTime(r.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No requests yet"
          description="Requests from the public board appear here."
        />
      )}
    </Card>
  );
}

function SignalsTab() {
  const { data, error, loading, reload } = useLoad(() =>
    api<SignalRow[]>("/api/admin/demand/signals"),
  );
  if (error)
    return (
      <Card>
        <ErrorState message={error} onRetry={() => void reload()} />
      </Card>
    );
  if (loading && !data)
    return (
      <Card className="p-4">
        <Skeleton className="h-40" />
      </Card>
    );
  const rows = data ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Demand signals"
        description="Anonymous queries, impressions and votes. No visitor identity is stored."
      />
      {rows.length ? (
        <Table label="Demand signals">
          <THead>
            <tr>
              <Th>Query</Th>
              <Th>Source</Th>
              <Th>Counts</Th>
              <Th>Status</Th>
              <Th>Last seen</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-border/60">
            {rows.map((s) => (
              <tr key={s._id}>
                <Td>
                  <p className="font-medium text-foreground">{s.query}</p>
                  {s.matchedComponentSlug ? (
                    <Link
                      to={`/components/${s.matchedComponentSlug}`}
                      className="text-xs text-sky-700 hover:underline dark:text-sky-400"
                    >
                      matched /components/{s.matchedComponentSlug}
                    </Link>
                  ) : null}
                </Td>
                <Td className="text-xs text-muted-foreground">
                  {sourceLabel[s.source] ?? s.source}
                </Td>
                <Td className="text-xs text-muted-foreground">
                  {s.count} searches · {s.upvotes} votes · {s.impressions} impressions ·{" "}
                  {s.zeroResultCount} zero-result
                </Td>
                <Td>
                  <Badge variant={statusVariant(s.status)} dot>
                    {s.status}
                  </Badge>
                </Td>
                <Td className="text-xs text-muted-foreground">{relativeTime(s.lastSeen)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          icon={Search}
          title="No signals yet"
          description="On-site searches, board votes and GSC imports appear here."
        />
      )}
    </Card>
  );
}

function QualityTab({ onChanged }: { onChanged: () => void }) {
  const { data, error, loading, reload } = useLoad(() =>
    api<Report[]>("/api/admin/demand/quality"),
  );
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (error)
    return (
      <Card>
        <ErrorState message={error} onRetry={() => void reload()} />
      </Card>
    );
  if (loading && !data)
    return (
      <Card className="p-4">
        <Skeleton className="h-40" />
      </Card>
    );
  const rows = data ?? [];
  return (
    <div className="flex flex-col gap-3">
      {rows.length ? (
        rows.map((r) => (
          <Card key={r._id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{r.draftSlug}</p>
                <p className="text-xs text-muted-foreground">{relativeTime(r.createdAt)}</p>
              </div>
              <Badge variant={r.passed ? "success" : "warning"} dot>
                {r.passed ? "passed" : "not passed"}
              </Badge>
            </div>
            <QualityPanel
              report={r}
              busy={busy === r._id}
              onConfirm={async (checks) => {
                setBusy(r._id);
                try {
                  await api(`/api/admin/demand/quality/${r._id}/confirm`, {
                    method: "POST",
                    json: { checks },
                  });
                  toast.success("Manual checks confirmed");
                  await reload();
                  onChanged();
                } catch (e) {
                  toast.error("Could not confirm checks", errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            />
          </Card>
        ))
      ) : (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No quality reports yet"
            description="Run the gate on a draft opportunity."
          />
        </Card>
      )}
    </div>
  );
}

function NotificationsTab({ onChanged }: { onChanged: () => void }) {
  const { data, error, loading, reload } = useLoad(() =>
    api<NotificationRow[]>("/api/admin/demand/notifications"),
  );
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (error)
    return (
      <Card>
        <ErrorState message={error} onRetry={() => void reload()} />
      </Card>
    );
  if (loading && !data)
    return (
      <Card className="p-4">
        <Skeleton className="h-40" />
      </Card>
    );
  const rows = data ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Ship notifications"
        description="Recorded for requesters who opted in. Nothing is emailed until you approve and send it outside this queue."
      />
      {rows.length ? (
        <Table label="Notifications">
          <THead>
            <tr>
              <Th>Email</Th>
              <Th>Component</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-border/60">
            {rows.map((n) => (
              <tr key={n._id}>
                <Td className="text-xs text-muted-foreground">{n.email}</Td>
                <Td className="text-xs">
                  <Link
                    to={`/components/${n.componentSlug}`}
                    className="text-sky-700 hover:underline dark:text-sky-400"
                  >
                    /components/{n.componentSlug}
                  </Link>
                </Td>
                <Td>
                  <Badge variant={n.status === "sent" ? "success" : "warning"} dot>
                    {n.status}
                  </Badge>
                </Td>
                <Td className="text-xs text-muted-foreground">{relativeTime(n.createdAt)}</Td>
                <Td className="text-right">
                  {n.status === "pending" ? (
                    <Button
                      size="sm"
                      loading={busy === n._id}
                      onClick={async () => {
                        setBusy(n._id);
                        try {
                          await api(`/api/admin/demand/notifications/${n._id}/sent`, {
                            method: "POST",
                          });
                          toast.success("Marked as sent");
                          await reload();
                          onChanged();
                        } catch (e) {
                          toast.error("Could not update", errorMessage(e));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      Mark sent
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No notifications"
          description="Opt-in requesters appear here after a component ships."
        />
      )}
    </Card>
  );
}

function AuditTab() {
  const { data, error, loading, reload } = useLoad(() =>
    api<AuditRow[]>("/api/admin/demand/audit"),
  );
  if (error)
    return (
      <Card>
        <ErrorState message={error} onRetry={() => void reload()} />
      </Card>
    );
  if (loading && !data)
    return (
      <Card className="p-4">
        <Skeleton className="h-40" />
      </Card>
    );
  const rows = data ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Audit log" description="Who changed what in the demand pipeline." />
      {rows.length ? (
        <Table label="Audit log">
          <THead>
            <tr>
              <Th>Action</Th>
              <Th>Actor</Th>
              <Th>Target</Th>
              <Th>Detail</Th>
              <Th>When</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-border/60">
            {rows.map((a) => (
              <tr key={a._id}>
                <Td className="font-medium text-foreground">{a.action}</Td>
                <Td className="text-xs text-muted-foreground">{a.actor}</Td>
                <Td className="max-w-56 truncate text-xs text-muted-foreground">{a.target}</Td>
                <Td className="max-w-72 truncate text-xs text-muted-foreground">
                  {JSON.stringify(a.detail)}
                </Td>
                <Td className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={FileText} title="No audit entries yet" />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- page */

export function Demand() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("opportunities");
  const [refresh, setRefresh] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Opportunity | null>(null);
  const [report, setReport] = useState<{ markdown: string; file: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    const [overview, opportunities, reports] = await Promise.all([
      api<Overview>("/api/admin/demand/overview"),
      api<Opportunity[]>("/api/admin/demand/opportunities"),
      api<Report[]>("/api/admin/demand/quality"),
    ]);
    return { overview, opportunities, reports } satisfies PageData;
  }, String(refresh));

  const refreshAll = () => setRefresh((n) => n + 1);

  const scan = async () => {
    setScanning(true);
    try {
      const r = await api<{ scanned: number }>("/api/admin/demand/scan", { method: "POST" });
      toast.success("Demand scanned", `${r.scanned} clustered opportunities updated.`);
      refreshAll();
    } catch (e) {
      toast.error("Could not scan demand", errorMessage(e));
    } finally {
      setScanning(false);
    }
  };

  const generateReport = async () => {
    setReporting(true);
    try {
      const r = await api<{ file: string; markdown: string }>("/api/admin/demand/report", {
        method: "POST",
      });
      setReport(r);
      toast.success("Weekly report generated", r.file);
      refreshAll();
    } catch (e) {
      toast.error("Could not generate report", errorMessage(e));
    } finally {
      setReporting(false);
    }
  };

  const importCsv = async () => {
    setImporting(true);
    try {
      const r = await api<{ imported: number }>("/api/admin/demand/import/gsc", {
        method: "POST",
        json: { csv },
      });
      toast.success("Search Console CSV imported", `${r.imported} queries updated.`);
      setCsv("");
      refreshAll();
    } catch (e) {
      toast.error("Could not import CSV", errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  const action = (opp: Opportunity, fn: () => Promise<unknown>, message: string) => {
    setBusyId(opp._id);
    void fn()
      .then(() => {
        toast.success(message);
        refreshAll();
      })
      .catch((e) => toast.error("Action failed", errorMessage(e)))
      .finally(() => setBusyId(null));
  };

  const counts =
    data?.overview.opportunities.reduce(
      (acc, o) => ({ ...acc, [o._id]: o.n }),
      {} as Record<string, number>,
    ) ?? {};

  return (
    <>
      <PageHeader
        title="Demand pipeline"
        description="Turn anonymous searches and public requests into reviewed, quality-gated components. Nothing publishes without a human approval and a passing quality report."
        actions={
          <>
            <Button
              variant="secondary"
              loading={scanning}
              icon={RefreshCw}
              onClick={() => void scan()}
            >
              Scan demand
            </Button>
            <Button
              variant="secondary"
              loading={reporting}
              icon={FileDown}
              onClick={() => void generateReport()}
            >
              Weekly report
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void reload()} />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Signals", data?.overview.signals],
              ["Opportunities", data?.overview.opportunities.reduce((n, o) => n + o.n, 0)],
              ["Requests", data?.overview.requests],
              ["Quality passed", data?.overview.qualityPassed],
              ["Pending email", data?.overview.pendingNotifications],
              ["Published", data?.overview.publishedComponents],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                {value === undefined ? (
                  <Skeleton className="mt-1.5 h-6 w-12" />
                ) : (
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                    {value}
                  </p>
                )}
              </Card>
            ))}
          </div>

          {data ? (
            <>
              <SettingsCard settings={data.overview.settings} onSaved={refreshAll} />
              <Card>
                <CardHeader
                  title="Search Console import"
                  description="Paste the Queries CSV export. Only query, clicks and impressions are stored."
                />
                <div className="p-4">
                  <textarea
                    value={csv}
                    onChange={(e) => setCsv(e.target.value)}
                    rows={4}
                    className={cn(inputClass, "h-auto font-mono text-xs")}
                    placeholder={'Top queries,Clicks,Impressions\n"contact table",12,340'}
                    aria-label="Search Console CSV"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Upload}
                      loading={importing}
                      disabled={csv.trim().length < 10}
                      onClick={() => void importCsv()}
                    >
                      Import CSV
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page-level GSC data is not imported yet; use the weekly report for follow-ups.
                    </span>
                  </div>
                </div>
              </Card>
            </>
          ) : null}

          <Segmented
            label="Demand view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "opportunities", label: "Opportunities", count: data?.opportunities.length },
              { value: "requests", label: "Requests", count: data?.overview.requests },
              { value: "signals", label: "Signals", count: data?.overview.signals },
              { value: "quality", label: "Quality" },
              {
                value: "notifications",
                label: "Email",
                count: data?.overview.pendingNotifications,
              },
              { value: "audit", label: "Audit" },
            ]}
          />

          {tab === "opportunities" ? (
            loading && !data ? (
              <Card className="p-4">
                <Skeleton className="h-40" />
              </Card>
            ) : data?.opportunities.length ? (
              <div className="flex flex-col gap-3">
                {data.opportunities.map((opp) => (
                  <OpportunityCard
                    key={opp._id}
                    opp={opp}
                    report={reportFor(opp, data.reports)}
                    busy={busyId === opp._id}
                    onAction={(fn, message) => action(opp, fn, message)}
                    onReject={() => setRejecting(opp)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={Search}
                  title="No opportunities yet"
                  description="Search the catalogue, collect requests, import GSC data, then scan."
                  action={
                    <Button variant="primary" loading={scanning} onClick={() => void scan()}>
                      Scan demand
                    </Button>
                  }
                />
              </Card>
            )
          ) : tab === "requests" ? (
            <RequestsTab />
          ) : tab === "signals" ? (
            <SignalsTab />
          ) : tab === "quality" ? (
            <QualityTab onChanged={refreshAll} />
          ) : tab === "notifications" ? (
            <NotificationsTab onChanged={refreshAll} />
          ) : (
            <AuditTab />
          )}

          {data ? (
            <p className="text-xs text-muted-foreground">
              {counts.build ?? 0} build · {counts.improve ?? 0} improve · {counts.ignore ?? 0}{" "}
              ignore · {counts.open ?? 0} open.{" "}
              <Link
                to="/feature-radar"
                className={cn("inline-flex items-center gap-1 underline", focusRing)}
              >
                Feature radar <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </p>
          ) : null}
        </div>
      )}

      {rejecting ? (
        <RejectDialog
          opportunity={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            refreshAll();
          }}
        />
      ) : null}
      {report ? (
        <ReportDialog
          markdown={report.markdown}
          file={report.file}
          onClose={() => setReport(null)}
        />
      ) : null}
    </>
  );
}
