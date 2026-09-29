import * as React from "react";
import { format } from "date-fns";
import { Building2, Mail, Tag, X } from "lucide-react";
import type { ResolvedBusinessHours } from "@/components/crm/pro-ticket-console/business-hours";
import { SlaTimer } from "@/components/crm/pro-ticket-console/sla-timer";
import type {
  Ticket,
  TicketPatch,
  TicketPriority,
  TicketStatus,
} from "@/components/crm/pro-ticket-console/types";

const STATUSES: TicketStatus[] = ["open", "pending", "on-hold", "solved"];
const PRIORITIES: TicketPriority[] = ["urgent", "high", "normal", "low"];

export interface TicketDetailsProps {
  ticket: Ticket | null;
  agents: string[];
  hours: ResolvedBusinessHours;
  sla: { dueAt: number | null; target: number; paused: boolean } | null;
  onPatch: (patch: TicketPatch) => void;
  now?: Date;
  readOnly?: boolean;
}

const fieldCls =
  "h-8 w-full rounded-crm border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus:ring-2 focus:ring-crm-ring disabled:opacity-50";

export function TicketDetails({
  ticket,
  agents,
  hours,
  sla,
  onPatch,
  now,
  readOnly,
}: TicketDetailsProps) {
  const [tag, setTag] = React.useState("");
  const id = React.useId();
  if (!ticket) return <div className="p-4 text-xs text-crm-muted-fg">No ticket selected.</div>;
  return (
    <aside aria-label="Ticket properties" className="h-full space-y-5 overflow-y-auto p-4 text-sm">
      <section>
        <p className="crm-eyebrow text-crm-muted-fg uppercase">Requester</p>
        <p className="mt-2 font-medium text-crm-fg">{ticket.requester.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-crm-soft">
          <Mail className="size-3" aria-hidden /> {ticket.requester.email}
        </p>
        {ticket.requester.company && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-crm-soft">
            <Building2 className="size-3" aria-hidden /> {ticket.requester.company}
            {ticket.requester.plan && (
              <span className="rounded-full bg-crm-muted px-1.5 text-[10px] text-crm-chip">
                {ticket.requester.plan}
              </span>
            )}
          </p>
        )}
      </section>
      {sla && (
        <section>
          <p className="crm-eyebrow text-crm-muted-fg uppercase">Next response SLA</p>
          <div className="mt-2 flex items-center gap-2">
            <SlaTimer
              dueAt={sla.dueAt}
              targetMinutes={sla.target}
              hours={hours}
              paused={sla.paused}
              now={now}
            />
          </div>
          {sla.dueAt !== null && (
            <p className="mt-1.5 text-[11px] text-crm-muted-fg">
              Due {format(new Date(sla.dueAt), "EEE MMM d, HH:mm")} · {sla.target} business min
            </p>
          )}
        </section>
      )}
      <section className="grid gap-3">
        <label className="grid gap-1 text-xs text-crm-muted-fg" htmlFor={`${id}-status`}>
          Status
          <select
            id={`${id}-status`}
            className={fieldCls}
            disabled={readOnly}
            value={ticket.status}
            onChange={(e) => onPatch({ status: e.target.value as TicketStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-crm-muted-fg" htmlFor={`${id}-prio`}>
          Priority
          <select
            id={`${id}-prio`}
            className={fieldCls}
            disabled={readOnly}
            value={ticket.priority}
            onChange={(e) => onPatch({ priority: e.target.value as TicketPriority })}
          >
            {PRIORITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-crm-muted-fg" htmlFor={`${id}-assignee`}>
          Assignee
          <select
            id={`${id}-assignee`}
            className={fieldCls}
            disabled={readOnly}
            value={ticket.assignee ?? ""}
            onChange={(e) => onPatch({ assignee: e.target.value || null })}
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section>
        <p className="crm-eyebrow text-crm-muted-fg uppercase">Tags</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ticket.tags.map((t) => (
            <li
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-crm-muted px-2 py-0.5 text-[11px] text-crm-chip"
            >
              <Tag className="size-2.5" aria-hidden />
              {t}
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove tag ${t}`}
                  onClick={() => onPatch({ removeTags: [t] })}
                  className="text-crm-muted-fg hover:text-crm-fg"
                >
                  <X className="size-2.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <form
            className="mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = tag.trim().toLowerCase();
              if (v) onPatch({ addTags: [v] });
              setTag("");
            }}
          >
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              aria-label="Add tag"
              placeholder="Add tag + Enter"
              className={fieldCls}
            />
          </form>
        )}
      </section>
      <section className="text-[11px] text-crm-muted-fg">
        Created {format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm")}
        <br />
        Updated {format(new Date(ticket.updatedAt), "MMM d, yyyy HH:mm")}
      </section>
    </aside>
  );
}
