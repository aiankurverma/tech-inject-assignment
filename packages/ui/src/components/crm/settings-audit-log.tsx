import * as React from "react";
import { ChevronRight, Download, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { FilterSelect } from "@/components/crm/filter-select";
import { Pagination } from "@/components/crm/pagination";
import { SearchInput } from "@/components/crm/search-input";
import { Tag, type TagColor } from "@/components/crm/tag";

export type AuditCategory = "auth" | "record" | "settings" | "billing" | "data";
export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface AuditEvent {
  id: string;
  /** ISO timestamp. */
  at: string;
  actor: { name: string; email: string } | null;
  /** Machine action name, e.g. "user.login_failed", "deal.stage_changed". */
  action: string;
  /** Human summary, e.g. "Changed stage on Acme renewal". */
  summary: string;
  category: AuditCategory;
  severity: AuditSeverity;
  target?: string;
  ip?: string;
  location?: string;
  userAgent?: string;
  changes?: AuditChange[];
}

export interface SettingsAuditLogProps {
  events: AuditEvent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pageSize?: number;
  /** Reference "now" for relative ranges; defaults to the current time. */
  now?: Date;
  /** Days of history retained by the plan, shown in the header. */
  retentionDays?: number;
  className?: string;
}

const CATEGORY: Record<AuditCategory, { label: string; color: TagColor }> = {
  auth: { label: "Sign-in", color: "blue" },
  record: { label: "Records", color: "purple" },
  settings: { label: "Settings", color: "teal" },
  billing: { label: "Billing", color: "moss" },
  data: { label: "Data", color: "orange" },
};
const SEVERITY: Record<AuditSeverity, TagColor> = {
  info: "neutral",
  warning: "amber",
  critical: "red",
};
const RANGES = {
  "Last 24 hours": 1,
  "Last 7 days": 7,
  "Last 30 days": 30,
  "All time": Infinity,
} as const;
type RangeLabel = keyof typeof RANGES;

const dtf = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const csvCell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Security/audit trail: search, category/actor/severity/date filters, expandable before/after diffs, CSV export, pagination. */
export function SettingsAuditLog({
  events,
  loading,
  error,
  onRetry,
  pageSize = 10,
  now,
  retentionDays = 90,
  className,
}: SettingsAuditLogProps) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("All");
  const [actor, setActor] = React.useState("Anyone");
  const [severity, setSeverity] = React.useState("Any");
  const [range, setRange] = React.useState<RangeLabel>("Last 7 days");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  const actors = React.useMemo(
    () => [
      "Anyone",
      "System",
      ...Array.from(new Set(events.flatMap((e) => (e.actor ? [e.actor.name] : [])))).sort(),
    ],
    [events],
  );

  const filtered = React.useMemo(() => {
    const ref = (now ?? new Date()).getTime();
    const days = RANGES[range];
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (days !== Infinity && ref - new Date(e.at).getTime() > days * 86_400_000) return false;
        if (category !== "All" && CATEGORY[e.category].label !== category) return false;
        if (severity !== "Any" && e.severity !== severity.toLowerCase()) return false;
        if (actor === "System" && e.actor) return false;
        if (actor !== "Anyone" && actor !== "System" && e.actor?.name !== actor) return false;
        if (!q) return true;
        return [e.summary, e.action, e.target, e.ip, e.actor?.name, e.actor?.email]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [events, query, category, actor, severity, range, now]);

  React.useEffect(() => setPage(1), [query, category, actor, severity, range]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const critical = filtered.filter((e) => e.severity === "critical").length;

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exportCsv = () => {
    const head = [
      "Time (UTC)",
      "Actor",
      "Email",
      "Action",
      "Summary",
      "Category",
      "Severity",
      "Target",
      "IP",
      "Location",
      "Changes",
    ];
    const body = filtered.map((e) => [
      e.at,
      e.actor?.name ?? "System",
      e.actor?.email ?? "",
      e.action,
      e.summary,
      e.category,
      e.severity,
      e.target ?? "",
      e.ip ?? "",
      e.location ?? "",
      (e.changes ?? []).map((c) => `${c.field}: ${c.before ?? "∅"} → ${c.after ?? "∅"}`).join("; "),
    ]);
    const text = [head, ...body].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("All");
    setActor("Anyone");
    setSeverity("Any");
    setRange("All time");
  };

  return (
    <section
      aria-label="Audit log"
      className={cn(
        "flex w-full flex-col gap-4 rounded-xl border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised sm:p-5",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-crm-fg">Audit log</h2>
          <p className="text-xs text-crm-soft">
            Every sign-in, permission, export and record change. Retained for {retentionDays} days.
          </p>
        </div>
        <Button size="sm" disabled={!filtered.length || loading} onClick={exportCsv}>
          <Download />
          Export {filtered.length ? filtered.length.toLocaleString() : ""} CSV
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          aria-label="Search audit log"
          placeholder="Search user, action, IP, record..."
          className="w-full sm:w-72"
          value={query}
          onValueChange={setQuery}
        />
        <FilterSelect
          label="Range"
          options={Object.keys(RANGES)}
          value={range}
          onValueChange={(v) => setRange(v as RangeLabel)}
        />
        <FilterSelect
          label="Type"
          options={["All", ...Object.values(CATEGORY).map((c) => c.label)]}
          value={category}
          onValueChange={setCategory}
        />
        <FilterSelect label="Actor" options={actors} value={actor} onValueChange={setActor} />
        <FilterSelect
          label="Severity"
          options={["Any", "Info", "Warning", "Critical"]}
          value={severity}
          onValueChange={setSeverity}
        />
      </div>

      {critical > 0 && !loading ? (
        <Alert
          tone="danger"
          icon={<ShieldAlert />}
          title={`${critical} critical event${critical === 1 ? "" : "s"} in this view`}
        >
          Review failed sign-ins, permission escalations and bulk exports below.
        </Alert>
      ) : null}

      {error ? (
        <Alert
          tone="danger"
          title="Couldn't load the audit log"
          action={
            onRetry ? (
              <Button size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      ) : loading ? (
        <ul aria-busy className="flex flex-col gap-2" aria-label="Loading events">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-11 animate-pulse rounded-crm bg-crm-raised" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-crm-border p-10 text-center">
          <p className="text-sm text-crm-fg">No events match these filters</p>
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-crm-border rounded-xl border border-crm-border">
          {rows.map((e) => {
            const isOpen = open.has(e.id);
            const expandable = !!(e.changes?.length || e.userAgent || e.ip);
            return (
              <li key={e.id} className={cn(e.severity === "critical" && "bg-crm-danger/5")}>
                <button
                  type="button"
                  aria-expanded={expandable ? isOpen : undefined}
                  aria-controls={expandable ? `audit-${e.id}` : undefined}
                  disabled={!expandable}
                  onClick={() => toggle(e.id)}
                  className="grid w-full grid-cols-[16px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-3 py-3 text-left focus-visible:bg-crm-raised focus-visible:outline-none enabled:hover:bg-crm-raised sm:grid-cols-[16px_120px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <ChevronRight
                    className={cn(
                      "mt-0.5 size-4 text-crm-subtle transition-transform sm:mt-0",
                      isOpen && "rotate-90",
                      !expandable && "opacity-0",
                    )}
                    aria-hidden
                  />
                  <time
                    dateTime={e.at}
                    className="text-xs text-crm-soft tabular-nums sm:order-none"
                  >
                    {dtf.format(new Date(e.at))}
                  </time>
                  <span className="col-start-2 min-w-0 sm:col-start-auto">
                    <span className="block truncate text-sm text-crm-fg">{e.summary}</span>
                    <span className="block truncate text-xs text-crm-subtle">
                      {e.actor ? `${e.actor.name} · ${e.actor.email}` : "System"} ·{" "}
                      <code className="font-mono">{e.action}</code>
                    </span>
                  </span>
                  <span className="col-start-2 flex gap-1.5 sm:col-start-auto">
                    <Tag size="sm" color={CATEGORY[e.category].color}>
                      {CATEGORY[e.category].label}
                    </Tag>
                    {e.severity !== "info" ? (
                      <Tag size="sm" color={SEVERITY[e.severity]}>
                        {e.severity === "critical" ? "Critical" : "Warning"}
                      </Tag>
                    ) : null}
                  </span>
                </button>
                {expandable && isOpen ? (
                  <div id={`audit-${e.id}`} className="flex flex-col gap-3 px-3 pb-4 pl-10">
                    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                      {e.target ? (
                        <>
                          <dt className="text-crm-subtle">Target</dt>
                          <dd className="text-crm-fg">{e.target}</dd>
                        </>
                      ) : null}
                      {e.ip ? (
                        <>
                          <dt className="text-crm-subtle">IP address</dt>
                          <dd className="font-mono text-crm-fg">
                            {e.ip}
                            {e.location ? (
                              <span className="font-crm text-crm-soft"> · {e.location}</span>
                            ) : null}
                          </dd>
                        </>
                      ) : null}
                      {e.userAgent ? (
                        <>
                          <dt className="text-crm-subtle">Device</dt>
                          <dd className="break-all text-crm-soft">{e.userAgent}</dd>
                        </>
                      ) : null}
                      <dt className="text-crm-subtle">Exact time</dt>
                      <dd className="font-mono text-crm-soft">{e.at}</dd>
                    </dl>
                    {e.changes?.length ? (
                      <table className="w-full text-left text-xs">
                        <caption className="sr-only">Field changes</caption>
                        <thead className="text-crm-subtle">
                          <tr>
                            <th scope="col" className="py-1 pr-3 font-medium">
                              Field
                            </th>
                            <th scope="col" className="py-1 pr-3 font-medium">
                              Before
                            </th>
                            <th scope="col" className="py-1 font-medium">
                              After
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.changes.map((c) => (
                            <tr key={c.field} className="align-top">
                              <td className="py-1 pr-3 text-crm-soft">{c.field}</td>
                              <td className="py-1 pr-3">
                                <span className="rounded bg-crm-danger/10 px-1 text-crm-danger line-through">
                                  {c.before ?? "empty"}
                                </span>
                              </td>
                              <td className="py-1">
                                <span className="rounded bg-crm-success/10 px-1 text-crm-success">
                                  {c.after ?? "empty"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && filtered.length > pageSize ? (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          total={filtered.length}
          pageSize={pageSize}
        />
      ) : null}
    </section>
  );
}
