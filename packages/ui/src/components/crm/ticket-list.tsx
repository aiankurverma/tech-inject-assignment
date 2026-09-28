import * as React from "react";
import { AlertTriangle, LifeBuoy, MessageSquare, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/crm/data-table";
import { Checkbox } from "@/components/crm/checkbox";
import { Avatar } from "@/components/crm/avatar";
import { Tag } from "@/components/crm/tag";
import { Button } from "@/components/crm/button";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { EmptyState, Skeleton } from "@/components/crm/feedback";

export type TicketPriority = "urgent" | "high" | "normal" | "low";
export type TicketStatus = "new" | "open" | "pending" | "on-hold" | "solved";

export interface TicketRow {
  id: string;
  /** Human reference, e.g. "#4821". */
  number: string;
  subject: string;
  requester: string;
  company?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee?: string;
  channel: "email" | "chat" | "phone" | "web";
  /** ISO timestamps. */
  createdAt: string;
  firstRespondedAt?: string;
  updatedAt: string;
  replies: number;
}

/** Hours allowed per priority for first response and full resolution. */
export type SlaPolicy = Record<TicketPriority, { firstResponse: number; resolution: number }>;

export const defaultSlaPolicy: SlaPolicy = {
  urgent: { firstResponse: 1, resolution: 4 },
  high: { firstResponse: 4, resolution: 24 },
  normal: { firstResponse: 8, resolution: 72 },
  low: { firstResponse: 24, resolution: 168 },
};

/** Remaining minutes on the active SLA target (negative = breached); null when paused or solved. */
export function ticketSla(t: TicketRow, now: Date, policy: SlaPolicy = defaultSlaPolicy) {
  if (t.status === "solved" || t.status === "pending" || t.status === "on-hold") return null;
  const created = new Date(t.createdAt).getTime();
  const p = policy[t.priority];
  const kind = t.firstRespondedAt ? "resolution" : "first response";
  const due = created + (t.firstRespondedAt ? p.resolution : p.firstResponse) * 3_600_000;
  return { kind, minutes: (due - now.getTime()) / 60_000 };
}

export function formatDuration(mins: number) {
  const m = Math.abs(Math.round(mins));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

const prioColor = { urgent: "red", high: "orange", normal: "blue", low: "neutral" } as const;
const prioRank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const statusColor = {
  new: "purple",
  open: "blue",
  pending: "amber",
  "on-hold": "neutral",
  solved: "green",
} as const;

type Queue = "unassigned" | "mine" | "breaching" | "all";

export interface TicketListProps {
  tickets: TicketRow[];
  currentUser: string;
  policy?: SlaPolicy;
  /** Fixed clock; ticks every 30s when omitted. */
  now?: string;
  onOpenTicket?: (t: TicketRow) => void;
  /** Bulk update handler; the list itself is controlled by `tickets`. */
  onBulkUpdate?: (
    ids: string[],
    patch: Partial<Pick<TicketRow, "assignee" | "status" | "priority">>,
  ) => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

/**
 * Support queue: queues (unassigned / mine / breaching / all), live SLA countdowns per priority policy,
 * sort by urgency, search, selection with bulk assign / solve / re-prioritise.
 */
export function TicketList({
  tickets,
  currentUser,
  policy = defaultSlaPolicy,
  now: fixedNow,
  onOpenTicket,
  onBulkUpdate,
  loading,
  error,
  className,
}: TicketListProps) {
  const [tick, setTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (fixedNow) return;
    const t = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [fixedNow]);
  const now = fixedNow ? new Date(fixedNow) : new Date(tick);
  const [queue, setQueue] = React.useState<Queue>("all");
  const [query, setQuery] = React.useState("");
  const [showSolved, setShowSolved] = React.useState(false);
  const [sel, setSel] = React.useState<string[]>([]);

  const withSla = tickets.map((t) => ({ t, sla: ticketSla(t, now, policy) }));
  const match = (q: Queue, x: (typeof withSla)[number]) =>
    q === "unassigned"
      ? !x.t.assignee
      : q === "mine"
        ? x.t.assignee === currentUser
        : q === "breaching"
          ? !!x.sla && x.sla.minutes < 60
          : true;
  const base = withSla.filter((x) => showSolved || x.t.status !== "solved");
  const needle = query.trim().toLowerCase();
  const rows = base
    .filter((x) => match(queue, x))
    .filter(
      (x) =>
        !needle ||
        x.t.subject.toLowerCase().includes(needle) ||
        x.t.requester.toLowerCase().includes(needle) ||
        x.t.number.toLowerCase().includes(needle) ||
        (x.t.company ?? "").toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      const as = a.sla?.minutes ?? Infinity;
      const bs = b.sla?.minutes ?? Infinity;
      if (as !== bs) return as - bs;
      return prioRank[a.t.priority] - prioRank[b.t.priority];
    });
  const count = (q: Queue) => base.filter((x) => match(q, x)).length;
  const allChecked = rows.length > 0 && rows.every((x) => sel.includes(x.t.id));

  const bulk = (patch: Partial<Pick<TicketRow, "assignee" | "status" | "priority">>) => {
    onBulkUpdate?.(sel, patch);
    setSel([]);
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Queue"
          size="sm"
          value={queue}
          onValueChange={(v) => {
            setQueue(v as Queue);
            setSel([]);
          }}
          options={[
            { value: "all", label: "All", count: count("all") },
            { value: "unassigned", label: "Unassigned", count: count("unassigned") },
            { value: "mine", label: "Mine", count: count("mine") },
            { value: "breaching", label: "At risk", count: count("breaching") },
          ]}
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-crm-soft">
          <Checkbox checked={showSolved} onCheckedChange={(v) => setShowSolved(v === true)} />
          Show solved
        </label>
        <SearchInput
          size="sm"
          value={query}
          onValueChange={setQuery}
          placeholder="Search #, subject, requester"
          aria-label="Search tickets"
          className="w-full sm:ml-auto sm:w-64"
        />
      </div>

      {sel.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-card px-3 py-2 text-xs">
          <span>{sel.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => bulk({ assignee: currentUser })}>
              Assign to me
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulk({ priority: "urgent" })}>
              Escalate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulk({ status: "pending" })}>
              Pending
            </Button>
            <Button size="sm" onClick={() => bulk({ status: "solved" })}>
              Solve
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Couldn't load tickets"
          description={error}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={<LifeBuoy />}
          title={queue === "breaching" ? "Nothing at risk" : "Queue is clear"}
          description="No tickets match this queue and search."
        />
      ) : (
        <Table aria-label="Tickets">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">
                <Checkbox
                  aria-label="Select all tickets"
                  checked={allChecked}
                  onCheckedChange={() => setSel(allChecked ? [] : rows.map((x) => x.t.id))}
                />
              </TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead aria-sort="ascending">SLA</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ t, sla }) => {
              const checked = sel.includes(t.id);
              return (
                <TableRow key={t.id} selected={checked}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ticket ${t.number}`}
                      checked={checked}
                      onCheckedChange={() =>
                        setSel(checked ? sel.filter((x) => x !== t.id) : [...sel, t.id])
                      }
                    />
                  </TableCell>
                  <TableCell className="max-w-[360px]">
                    <button
                      type="button"
                      onClick={() => onOpenTicket?.(t)}
                      className="flex w-full cursor-pointer flex-col text-left outline-none focus-visible:underline"
                    >
                      <span className={cn("truncate", t.status === "new" && "font-medium")}>
                        <span className="mr-1.5 text-crm-subtle tabular-nums">{t.number}</span>
                        {t.subject}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-crm-subtle">
                        <MessageSquare className="size-3" aria-hidden /> {t.replies} · {t.channel}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col">
                      <span>{t.requester}</span>
                      {t.company ? (
                        <span className="text-xs text-crm-subtle">{t.company}</span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Tag size="sm" color={prioColor[t.priority]} className="capitalize">
                      {t.priority}
                    </Tag>
                  </TableCell>
                  <TableCell>
                    <Tag size="sm" color={statusColor[t.status]} className="capitalize">
                      {t.status.replace("-", " ")}
                    </Tag>
                  </TableCell>
                  <TableCell>
                    {sla ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs tabular-nums",
                          sla.minutes < 0
                            ? "text-crm-danger"
                            : sla.minutes < 60
                              ? "text-crm-warning"
                              : "text-crm-soft",
                        )}
                        title={`${sla.kind} target`}
                      >
                        <Timer className="size-3" aria-hidden />
                        {sla.minutes < 0
                          ? `Breached ${formatDuration(sla.minutes)} ago`
                          : `${formatDuration(sla.minutes)} left`}
                        <span className="sr-only"> ({sla.kind})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-crm-subtle">Paused</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.assignee ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={t.assignee} size="xs" />
                        {t.assignee}
                      </span>
                    ) : (
                      <span className="text-crm-subtle">Unassigned</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
