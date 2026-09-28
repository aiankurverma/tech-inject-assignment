import * as React from "react";
import { AlertTriangle, Inbox, Mail, Phone, Timer, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Tag } from "@/components/crm/tag";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { Kbd } from "@/components/crm/kbd";

export type LeadStatus = "new" | "contacted" | "qualified" | "disqualified";

export interface InboxLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  title?: string;
  source: "Website" | "Webinar" | "Referral" | "Paid ads" | "Outbound" | "Event";
  /** 0–100 lead score. */
  score: number;
  /** ISO timestamp the lead arrived. */
  receivedAt: string;
  status: LeadStatus;
  assignee?: string;
  /** First message / form answer. */
  message?: string;
}

export interface LeadInboxProps {
  leads?: InboxLead[];
  defaultLeads?: InboxLead[];
  onLeadsChange?: (leads: InboxLead[]) => void;
  /** Current rep, used by "Assign to me" and the "Mine" view. */
  currentUser: string;
  /** Speed-to-lead target in minutes for first contact. */
  slaMinutes?: number;
  /** Fixed clock (for SSR / demos). Ticks every 30s when omitted. */
  now?: string;
  onOpenLead?: (lead: InboxLead) => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

type View = "unassigned" | "mine" | "all";

function useNow(fixed?: string) {
  const [now, setNow] = React.useState(() => (fixed ? new Date(fixed) : new Date()));
  React.useEffect(() => {
    if (fixed) return;
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, [fixed]);
  return fixed ? new Date(fixed) : now;
}

function ago(mins: number) {
  if (mins < 1) return "now";
  if (mins < 60) return `${Math.floor(mins)}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

const scoreColor = (s: number) => (s >= 75 ? "green" : s >= 45 ? "amber" : "neutral");

/**
 * Speed-to-lead triage inbox: views (unassigned / mine / all), SLA countdown per new lead,
 * j/k keyboard navigation, bulk assign / contacted / disqualify, and a preview pane.
 */
export function LeadInbox({
  leads,
  defaultLeads = [],
  onLeadsChange,
  currentUser,
  slaMinutes = 15,
  now: fixedNow,
  onOpenLead,
  loading,
  error,
  className,
}: LeadInboxProps) {
  const [inner, setInner] = React.useState(defaultLeads);
  const all = leads ?? inner;
  const commit = (next: InboxLead[]) => {
    if (!leads) setInner(next);
    onLeadsChange?.(next);
  };
  const now = useNow(fixedNow);
  const [view, setView] = React.useState<View>("unassigned");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string[]>([]);
  const listRef = React.useRef<HTMLUListElement>(null);

  const minsOld = (l: InboxLead) => (now.getTime() - new Date(l.receivedAt).getTime()) / 60_000;
  const open = all.filter((l) => l.status !== "disqualified" && l.status !== "qualified");
  const inView = (l: InboxLead, v: View) =>
    v === "unassigned" ? !l.assignee : v === "mine" ? l.assignee === currentUser : true;
  const rows = open
    .filter((l) => inView(l, view))
    .sort((a, b) => {
      // Breaching / new leads first, then by score.
      const an = a.status === "new" ? 0 : 1;
      const bn = b.status === "new" ? 0 : 1;
      if (an !== bn) return an - bn;
      return b.score - a.score || +new Date(a.receivedAt) - +new Date(b.receivedAt);
    });
  const breaching = open.filter((l) => l.status === "new" && minsOld(l) > slaMinutes).length;
  const active = rows.find((l) => l.id === activeId) ?? rows[0] ?? null;

  const patch = (ids: string[], p: Partial<InboxLead>) => {
    commit(all.map((l) => (ids.includes(l.id) ? { ...l, ...p } : l)));
    setSel([]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!rows.length || !active) return;
    const i = rows.findIndex((l) => l.id === active.id);
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setActiveId(rows[Math.min(rows.length - 1, i + 1)]?.id ?? active.id);
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setActiveId(rows[Math.max(0, i - 1)]?.id ?? active.id);
    } else if (e.key === "x") {
      e.preventDefault();
      setSel((s) => (s.includes(active.id) ? s.filter((x) => x !== active.id) : [...s, active.id]));
    } else if (e.key === "Enter") {
      onOpenLead?.(active);
    }
  };

  React.useEffect(() => {
    if (!active) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active.id)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const count = (v: View) => open.filter((l) => inView(l, v)).length;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Lead view"
          size="sm"
          value={view}
          onValueChange={(v) => {
            setView(v as View);
            setSel([]);
            setActiveId(null);
          }}
          options={[
            { value: "unassigned", label: "Unassigned", count: count("unassigned") },
            { value: "mine", label: "Mine", count: count("mine") },
            { value: "all", label: "All open", count: count("all") },
          ]}
        />
        {breaching ? (
          <span className="inline-flex items-center gap-1 text-xs text-crm-danger" role="status">
            <Timer className="size-3.5" aria-hidden /> {breaching} past {slaMinutes}m SLA
          </span>
        ) : null}
        <span className="ml-auto hidden items-center gap-1 text-xs text-crm-subtle md:inline-flex">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd> move · <Kbd>x</Kbd> select · <Kbd>Enter</Kbd> open
        </span>
      </div>

      {sel.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-card px-3 py-2 text-xs">
          <span>{sel.length} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => patch(sel, { assignee: currentUser })}
            >
              Assign to me
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => patch(sel, { status: "contacted" })}
            >
              Mark contacted
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => patch(sel, { status: "disqualified" })}
            >
              Disqualify
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Inbox unavailable"
          description={error}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={<Inbox />}
          title="Inbox zero"
          description={
            view === "unassigned" ? "Every lead has an owner." : "No open leads in this view."
          }
        />
      ) : (
        <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul
            ref={listRef}
            role="listbox"
            aria-label="Leads"
            aria-activedescendant={active ? `lead-${active.id}` : undefined}
            tabIndex={0}
            onKeyDown={onKey}
            className="max-h-[480px] overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset md:border-r md:border-crm-border"
          >
            {rows.map((l) => {
              const mins = minsOld(l);
              const left = slaMinutes - mins;
              const isActive = active?.id === l.id;
              const checked = sel.includes(l.id);
              return (
                <li
                  key={l.id}
                  id={`lead-${l.id}`}
                  data-id={l.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => setActiveId(l.id)}
                  onDoubleClick={() => onOpenLead?.(l)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 border-b border-crm-border px-3 py-2.5 transition-colors duration-150",
                    isActive ? "bg-crm-card" : "hover:bg-crm-card/60",
                  )}
                >
                  <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                    <Checkbox
                      tabIndex={-1}
                      aria-label={`Select ${l.name}`}
                      checked={checked}
                      onCheckedChange={() =>
                        setSel((s) => (checked ? s.filter((x) => x !== l.id) : [...s, l.id]))
                      }
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", l.status === "new" && "font-medium")}>
                        {l.name}
                      </span>
                      {l.status === "new" ? (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-crm-primary"
                          aria-label="New"
                        />
                      ) : null}
                      <span className="ml-auto shrink-0 text-xs text-crm-subtle tabular-nums">
                        {ago(mins)}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-crm-soft">
                      {l.company} · {l.source}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <Tag size="sm" color={scoreColor(l.score)}>
                        {l.score}
                      </Tag>
                      {l.status === "new" ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs tabular-nums",
                            left < 0
                              ? "text-crm-danger"
                              : left < slaMinutes / 3
                                ? "text-crm-warning"
                                : "text-crm-subtle",
                          )}
                        >
                          <Timer className="size-3" aria-hidden />
                          {left < 0
                            ? `SLA breached ${ago(-left)}`
                            : `${Math.ceil(left)}m to respond`}
                        </span>
                      ) : (
                        <span className="text-xs text-crm-subtle capitalize">{l.status}</span>
                      )}
                      {l.assignee ? (
                        <span className="ml-auto">
                          <Avatar name={l.assignee} size="xs" />
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {active ? (
            <section
              aria-label={`Lead preview: ${active.name}`}
              className="flex flex-col gap-3 p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar name={active.name} size="md" />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium">{active.name}</h2>
                  <p className="truncate text-xs text-crm-soft">
                    {[active.title, active.company].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Tag color={scoreColor(active.score)} className="ml-auto">
                  Score {active.score}
                </Tag>
              </div>
              <ul className="flex flex-col gap-1 text-xs text-crm-soft">
                <li className="flex items-center gap-2">
                  <Mail className="size-3.5" aria-hidden />
                  <a className="hover:text-crm-fg" href={`mailto:${active.email}`}>
                    {active.email}
                  </a>
                </li>
                {active.phone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="size-3.5" aria-hidden /> {active.phone}
                  </li>
                ) : null}
              </ul>
              {active.message ? (
                <blockquote className="rounded-crm border border-crm-input/60 bg-crm-raised px-3 py-2 text-sm text-crm-fg">
                  {active.message}
                </blockquote>
              ) : null}
              <p className="text-xs text-crm-subtle">
                Received{" "}
                {new Date(active.receivedAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                via {active.source}
                {active.assignee ? ` · owned by ${active.assignee}` : " · unassigned"}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {active.assignee !== currentUser ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => patch([active.id], { assignee: currentUser })}
                  >
                    <UserPlus className="size-3.5" aria-hidden /> Assign to me
                  </Button>
                ) : null}
                {active.status === "new" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => patch([active.id], { status: "contacted" })}
                  >
                    Mark contacted
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => patch([active.id], { status: "qualified" })}>
                  Qualify
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => patch([active.id], { status: "disqualified" })}
                >
                  Disqualify
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
