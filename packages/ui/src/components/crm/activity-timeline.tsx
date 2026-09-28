import * as React from "react";
import { Calendar, CheckCircle2, FileText, Mail, MessageSquare, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export type ActivityType = "email" | "call" | "meeting" | "note" | "task" | "comment";

export interface Activity {
  id: string;
  type: ActivityType;
  /** Who did it. */
  actor: { name: string; avatar?: string };
  /** Sentence after the actor, e.g. "logged a call with Rachel". */
  text: React.ReactNode;
  /** Optional preview (email body, note excerpt). */
  detail?: React.ReactNode;
  time: string;
}

const typeMeta: Record<ActivityType, { icon: React.ReactNode; cls: string; label: string }> = {
  email: { icon: <Mail />, cls: "bg-tag-blue-bg text-tag-blue-text", label: "Email" },
  call: { icon: <Phone />, cls: "bg-tag-green-bg text-tag-green-text", label: "Call" },
  meeting: { icon: <Calendar />, cls: "bg-tag-purple-bg text-tag-purple-text", label: "Meeting" },
  note: { icon: <FileText />, cls: "bg-tag-amber-bg text-tag-amber-text", label: "Note" },
  task: { icon: <CheckCircle2 />, cls: "bg-tag-teal-bg text-tag-teal-text", label: "Task" },
  comment: {
    icon: <MessageSquare />,
    cls: "bg-tag-neutral-bg text-tag-neutral-text",
    label: "Comment",
  },
};

export interface ActivityTimelineProps {
  items: Activity[];
  /** Group headings, e.g. { "Today": [...ids] }. Omit for a flat list. */
  groups?: { label: string; ids: string[] }[];
  className?: string;
}

/** Vertical feed of emails, calls, meetings and notes on a record, with typed icons and a connector line. */
export function ActivityTimeline({ items, groups, className }: ActivityTimelineProps) {
  const sections = groups
    ? groups.map((g) => ({ label: g.label, items: items.filter((i) => g.ids.includes(i.id)) }))
    : [{ label: "", items }];
  return (
    <div className={cn("flex flex-col gap-5 font-crm", className)}>
      {sections.map((s, si) => (
        <section key={s.label || si} aria-label={s.label || "Activity"}>
          {s.label ? <h4 className="crm-eyebrow mb-3 text-crm-subtle">{s.label}</h4> : null}
          <ol className="flex flex-col">
            {s.items.map((a, i) => {
              const meta = typeMeta[a.type];
              const last = i === s.items.length - 1;
              return (
                <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {!last ? (
                    <span
                      aria-hidden
                      className="absolute top-8 bottom-1 left-[13px] w-px bg-crm-border"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-3.5",
                      meta.cls,
                    )}
                    title={meta.label}
                  >
                    {meta.icon}
                    <span className="sr-only">{meta.label}</span>
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-crm-soft">
                      <Avatar name={a.actor.name} src={a.actor.avatar} size="xs" />
                      <span className="font-medium text-crm-fg">{a.actor.name}</span>
                      {a.text}
                    </p>
                    {a.detail ? (
                      <div className="mt-2 rounded-crm border border-crm-input/60 bg-crm-raised px-3 py-2 text-sm text-crm-fg">
                        {a.detail}
                      </div>
                    ) : null}
                    <time className="mt-1.5 block text-xs text-crm-subtle">{a.time}</time>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
