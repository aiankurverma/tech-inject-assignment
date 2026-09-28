import * as React from "react";
import { ArrowDown, ArrowUp, Download, Mail, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Checkbox } from "@/components/crm/checkbox";
import { Pagination } from "@/components/crm/pagination";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type LifecycleStage =
  "subscriber" | "lead" | "mql" | "sql" | "opportunity" | "customer" | "churned";

export interface ContactRow {
  id: string;
  name: string;
  email: string;
  title?: string;
  company?: string;
  avatar?: string;
  stage: LifecycleStage;
  owner?: string;
  /** 0..100 lead score. */
  score?: number;
  /** ISO datetime of last activity. */
  lastActivity?: string;
  tags?: string[];
}

export interface ContactListProps {
  contacts: ContactRow[];
  pageSize?: number;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onOpen?: (id: string) => void;
  onBulkAction?: (action: "email" | "assign" | "export" | "delete", ids: string[]) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  asOf?: string;
  className?: string;
}

const stageMeta: Record<LifecycleStage, { label: string; color: TagColor }> = {
  subscriber: { label: "Subscriber", color: "neutral" },
  lead: { label: "Lead", color: "blue" },
  mql: { label: "MQL", color: "purple" },
  sql: { label: "SQL", color: "teal" },
  opportunity: { label: "Opportunity", color: "amber" },
  customer: { label: "Customer", color: "green" },
  churned: { label: "Churned", color: "red" },
};

type SortKey = "name" | "company" | "score" | "lastActivity";

function ago(iso: string | undefined, now: number) {
  if (!iso) return "Never";
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  const d = Math.round(m / 1440);
  return d < 30 ? `${d}d ago` : `${Math.round(d / 30)}mo ago`;
}

/**
 * Contacts record list: search across name/email/company, lifecycle tabs with counts,
 * owner filter, sortable columns, shift-click range selection, bulk action bar,
 * pagination and loading / empty / error states.
 */
export function ContactList({
  contacts,
  pageSize = 10,
  selected,
  defaultSelected = [],
  onSelectedChange,
  onOpen,
  onBulkAction,
  loading,
  error,
  onRetry,
  asOf,
  className,
}: ContactListProps) {
  const now = asOf ? Date.parse(asOf) : Date.now();
  const [innerSel, setInnerSel] = React.useState<string[]>(defaultSelected);
  const sel = new Set(selected ?? innerSel);
  const [q, setQ] = React.useState("");
  const [stage, setStage] = React.useState<"all" | LifecycleStage>("all");
  const [owner, setOwner] = React.useState("all");
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "lastActivity",
    desc: true,
  });
  const [page, setPage] = React.useState(1);
  const lastClicked = React.useRef<number | null>(null);

  const setSel = (ids: Set<string>) => {
    const arr = [...ids];
    if (selected === undefined) setInnerSel(arr);
    onSelectedChange?.(arr);
  };

  const owners = Array.from(
    new Set(contacts.map((c) => c.owner).filter((o): o is string => !!o)),
  ).sort();
  const needle = q.trim().toLowerCase();
  const searched = contacts.filter(
    (c) =>
      (owner === "all" || (owner === "none" ? !c.owner : c.owner === owner)) &&
      (!needle ||
        [c.name, c.email, c.company, c.title, ...(c.tags ?? [])].some((v) =>
          v?.toLowerCase().includes(needle),
        )),
  );
  const stageCounts = searched.reduce<Record<string, number>>((a, c) => {
    a[c.stage] = (a[c.stage] ?? 0) + 1;
    return a;
  }, {});
  const filtered = searched
    .filter((c) => stage === "all" || c.stage === stage)
    .sort((a, b) => {
      const k = sort.key;
      const d =
        k === "score"
          ? (a.score ?? -1) - (b.score ?? -1)
          : k === "lastActivity"
            ? Date.parse(a.lastActivity ?? "1970-01-01") -
              Date.parse(b.lastActivity ?? "1970-01-01")
            : (a[k] ?? "").localeCompare(b[k] ?? "");
      return sort.desc ? -d : d;
    });

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => sel.has(id));
  const someOnPage = pageIds.some((id) => sel.has(id));

  React.useEffect(() => setPage(1), [q, stage, owner]);

  const toggleRow = (idx: number, shift: boolean) => {
    const id = rows[idx]?.id;
    if (!id) return;
    const next = new Set(sel);
    const on = !sel.has(id);
    if (shift && lastClicked.current !== null) {
      const [a, b] = [Math.min(lastClicked.current, idx), Math.max(lastClicked.current, idx)];
      rows.slice(a, b + 1).forEach((r) => (on ? next.add(r.id) : next.delete(r.id)));
    } else if (on) next.add(id);
    else next.delete(id);
    lastClicked.current = idx;
    setSel(next);
  };

  const sortBtn = (key: SortKey, label: string, right = false) => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}
      className={cn(
        "crm-caption h-[38px] px-3 font-normal text-crm-subtle",
        right ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({
            key,
            desc: s.key === key ? !s.desc : key !== "name" && key !== "company",
          }))
        }
        className="inline-flex items-center gap-1 rounded-sm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
      >
        {label}
        {sort.key === key ? (
          sort.desc ? (
            <ArrowDown className="size-3" aria-hidden />
          ) : (
            <ArrowUp className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  const bulk: {
    key: "email" | "assign" | "export" | "delete";
    label: string;
    icon: React.ReactNode;
    danger?: boolean;
  }[] = [
    { key: "email", label: "Email", icon: <Mail /> },
    { key: "assign", label: "Assign", icon: <UserPlus /> },
    { key: "export", label: "Export CSV", icon: <Download /> },
    { key: "delete", label: "Delete", icon: <Trash2 />, danger: true },
  ];

  return (
    <section
      aria-label="Contacts"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-crm-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            size="sm"
            placeholder="Search name, email, company, tag"
            value={q}
            onValueChange={setQ}
            className="min-w-0 flex-1 sm:max-w-72"
          />
          <label className="flex items-center gap-1.5 text-xs text-crm-subtle">
            Owner
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="h-7 rounded-crm border border-crm-border bg-crm-input px-1.5 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
            >
              <option value="all">Anyone</option>
              <option value="none">Unassigned</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <span className="ml-auto text-xs text-crm-subtle tabular-nums">
            {filtered.length.toLocaleString("en-US")} of {contacts.length.toLocaleString("en-US")}
          </span>
        </div>
        <div className="overflow-x-auto">
          <SegmentedControl
            label="Lifecycle stage"
            size="sm"
            value={stage}
            onValueChange={(v) => setStage(v as typeof stage)}
            options={[
              { value: "all", label: "All", count: searched.length },
              ...(Object.keys(stageMeta) as LifecycleStage[])
                .filter((s) => stageCounts[s])
                .map((s) => ({ value: s, label: stageMeta[s].label, count: stageCounts[s] })),
            ]}
          />
        </div>
      </div>

      {sel.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-muted/50 px-3 py-2"
          role="toolbar"
          aria-label="Bulk actions"
        >
          <span className="text-xs font-medium tabular-nums">{sel.size} selected</span>
          {sel.size < filtered.length ? (
            <button
              type="button"
              onClick={() => setSel(new Set(filtered.map((c) => c.id)))}
              className="text-xs text-crm-primary hover:underline"
            >
              Select all {filtered.length}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setSel(new Set())}
            className="text-xs text-crm-subtle hover:underline"
          >
            Clear
          </button>
          <span className="ml-auto flex flex-wrap gap-1">
            {bulk.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => onBulkAction?.(b.key, [...sel])}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-crm border border-crm-border px-2 text-xs hover:bg-crm-card focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none [&_svg]:size-3.5",
                  b.danger && "text-crm-danger",
                )}
              >
                {b.icon}
                {b.label}
              </button>
            ))}
          </span>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-sm text-crm-danger">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-8 rounded-crm border border-crm-border px-3 text-xs hover:bg-crm-muted"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm" aria-busy={loading || undefined}>
            <thead>
              <tr className="border-b border-crm-border">
                <th scope="col" className="w-10 px-3">
                  <Checkbox
                    aria-label="Select page"
                    checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                    onCheckedChange={() => {
                      const next = new Set(sel);
                      pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
                      setSel(next);
                    }}
                  />
                </th>
                {sortBtn("name", "Name")}
                {sortBtn("company", "Company")}
                <th scope="col" className="crm-caption px-3 text-left font-normal text-crm-subtle">
                  Stage
                </th>
                <th scope="col" className="crm-caption px-3 text-left font-normal text-crm-subtle">
                  Owner
                </th>
                {sortBtn("score", "Score", true)}
                {sortBtn("lastActivity", "Last activity", true)}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: Math.min(pageSize, 6) }, (_, i) => (
                    <tr key={i} className="border-b border-crm-border">
                      <td colSpan={7} className="h-[42px] px-3">
                        <span className="block h-4 animate-pulse rounded bg-crm-muted" />
                      </td>
                    </tr>
                  ))
                : rows.map((c, i) => (
                    <tr
                      key={c.id}
                      aria-selected={sel.has(c.id)}
                      className="border-b border-crm-border last:border-0 hover:bg-crm-muted/40 aria-selected:bg-crm-muted/60"
                    >
                      <td className="px-3">
                        <Checkbox
                          aria-label={`Select ${c.name}`}
                          checked={sel.has(c.id)}
                          onClick={(e) => {
                            e.preventDefault();
                            toggleRow(i, e.shiftKey);
                          }}
                        />
                      </td>
                      <td className="h-[46px] px-3">
                        <button
                          type="button"
                          onClick={() => onOpen?.(c.id)}
                          className="flex items-center gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                        >
                          <Avatar name={c.name} src={c.avatar} size="md" />
                          <span className="min-w-0">
                            <span className="block font-medium hover:underline">{c.name}</span>
                            <span className="block text-xs text-crm-subtle">{c.email}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3">
                        <span className="block">{c.company ?? "—"}</span>
                        {c.title ? (
                          <span className="block text-xs text-crm-subtle">{c.title}</span>
                        ) : null}
                      </td>
                      <td className="px-3">
                        <Tag color={stageMeta[c.stage].color} size="sm">
                          {stageMeta[c.stage].label}
                        </Tag>
                      </td>
                      <td className="px-3 text-crm-soft">
                        {c.owner ?? <span className="text-crm-warning">Unassigned</span>}
                      </td>
                      <td className="px-3 text-right tabular-nums">
                        {c.score === undefined ? (
                          "—"
                        ) : (
                          <span
                            className={cn(
                              c.score >= 70
                                ? "text-crm-success"
                                : c.score < 30
                                  ? "text-crm-subtle"
                                  : "",
                            )}
                          >
                            {c.score}
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 text-right text-xs tabular-nums",
                          c.lastActivity && now - Date.parse(c.lastActivity) > 30 * 86_400_000
                            ? "text-crm-warning"
                            : "text-crm-soft",
                        )}
                        title={c.lastActivity}
                      >
                        {ago(c.lastActivity, now)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <p className="text-sm text-crm-subtle">
                {contacts.length
                  ? "No contacts match these filters."
                  : "No contacts yet. Import a CSV or connect your inbox."}
              </p>
              {contacts.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setStage("all");
                    setOwner("all");
                  }}
                  className="text-xs text-crm-primary hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {pageCount > 1 && !error ? (
        <div className="border-t border-crm-border px-3 py-2">
          <Pagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
            total={filtered.length}
            pageSize={pageSize}
          />
        </div>
      ) : null}
    </section>
  );
}
