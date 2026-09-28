import * as React from "react";
import { Lock, Paperclip, Send, Timer, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Tag } from "@/components/crm/tag";
import { Textarea } from "@/components/crm/textarea";
import { DescriptionList } from "@/components/crm/description-list";

export type TicketDetailPriority = "urgent" | "high" | "normal" | "low";
export type TicketDetailStatus = "new" | "open" | "pending" | "on-hold" | "solved";

export interface TicketMessage {
  id: string;
  author: string;
  /** customer = requester, agent = public reply, note = internal note. */
  kind: "customer" | "agent" | "note";
  body: string;
  /** ISO timestamp. */
  at: string;
  attachments?: { name: string; size: number }[];
}

export interface TicketRecord {
  id: string;
  number: string;
  subject: string;
  requester: { name: string; email: string; company?: string; plan?: string };
  priority: TicketDetailPriority;
  status: TicketDetailStatus;
  assignee?: string;
  channel: "email" | "chat" | "phone" | "web";
  tags?: string[];
  createdAt: string;
  messages: TicketMessage[];
}

export interface Macro {
  id: string;
  label: string;
  body: string;
  /** Optional status applied with the macro. */
  setStatus?: TicketDetailStatus;
}

export interface TicketDetailProps {
  ticket: TicketRecord;
  agents: string[];
  currentUser: string;
  macros?: Macro[];
  /** Hours per priority: [first response, resolution]. */
  sla?: Record<TicketDetailPriority, [number, number]>;
  /** Fixed clock; ticks every 30s when omitted. */
  now?: string;
  onChange?: (t: TicketRecord) => void;
  className?: string;
}

const defaultSla: Record<TicketDetailPriority, [number, number]> = {
  urgent: [1, 4],
  high: [4, 24],
  normal: [8, 72],
  low: [24, 168],
};

const bytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1_048_576
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1_048_576).toFixed(1)} MB`;

function dur(mins: number) {
  const m = Math.abs(Math.round(mins));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

/**
 * Support ticket workspace: threaded conversation (public replies vs. internal notes),
 * reply composer with macros and "send & set status", live first-response / resolution SLA
 * timers, and a properties sidebar for status, priority and assignee.
 */
export function TicketDetail({
  ticket: initial,
  agents,
  currentUser,
  macros = [],
  sla = defaultSla,
  now: fixedNow,
  onChange,
  className,
}: TicketDetailProps) {
  const [t, setT] = React.useState(initial);
  const [mode, setMode] = React.useState<"reply" | "note">("reply");
  const [draft, setDraft] = React.useState("");
  const [sendStatus, setSendStatus] = React.useState<TicketDetailStatus>("pending");
  const [tick, setTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (fixedNow) return;
    const id = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [fixedNow]);
  const now = fixedNow ? new Date(fixedNow).getTime() : tick;

  const update = (patch: Partial<TicketRecord>) => {
    const next = { ...t, ...patch };
    setT(next);
    onChange?.(next);
  };

  const created = new Date(t.createdAt).getTime();
  const [frH, resH] = sla[t.priority];
  const firstReply = t.messages.find((m) => m.kind === "agent");
  const frDue = created + frH * 3_600_000;
  const resDue = created + resH * 3_600_000;
  const frMet = firstReply ? new Date(firstReply.at).getTime() <= frDue : null;
  const paused = t.status === "pending" || t.status === "on-hold";

  const timers = [
    {
      label: "First response",
      state: firstReply ? (frMet ? "met" : "missed") : "running",
      minutes: (frDue - now) / 60_000,
    },
    {
      label: "Resolution",
      state: t.status === "solved" ? "met" : paused ? "paused" : "running",
      minutes: (resDue - now) / 60_000,
    },
  ] as const;

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const msg: TicketMessage = {
      id: `m-${Date.now()}`,
      author: currentUser,
      kind: mode === "reply" ? "agent" : "note",
      body,
      at: new Date(now).toISOString(),
    };
    update({
      messages: [...t.messages, msg],
      status: mode === "reply" ? sendStatus : t.status,
      assignee: t.assignee ?? currentUser,
    });
    setDraft("");
  };

  const sel =
    "h-8 w-full rounded-crm border border-crm-border bg-crm-raised px-2 text-sm text-crm-fg capitalize outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60";

  return (
    <article
      className={cn("grid min-w-0 gap-4 font-crm text-crm-fg lg:grid-cols-[1fr_280px]", className)}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <header>
          <p className="crm-eyebrow text-crm-subtle">
            {t.number} · via {t.channel}
          </p>
          <h1 className="mt-1 text-lg font-medium">{t.subject}</h1>
          {t.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {t.tags.map((tag) => (
                <Tag key={tag} size="sm">
                  {tag}
                </Tag>
              ))}
            </div>
          ) : null}
        </header>

        <ol aria-label="Conversation" className="flex flex-col gap-3">
          {t.messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-crm border p-3",
                m.kind === "note"
                  ? "border-tag-amber-border bg-tag-amber-bg/40"
                  : m.kind === "agent"
                    ? "border-crm-border bg-crm-card"
                    : "border-crm-border bg-crm-bg",
              )}
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-crm-soft">
                <Avatar name={m.author} size="sm" />
                <span className="font-medium text-crm-fg">{m.author}</span>
                {m.kind === "note" ? (
                  <span className="inline-flex items-center gap-1 text-tag-amber-text">
                    <Lock className="size-3" aria-hidden /> Internal note
                  </span>
                ) : m.kind === "customer" ? (
                  <span>Customer</span>
                ) : null}
                <time className="ml-auto" dateTime={m.at}>
                  {new Date(m.at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              {m.attachments?.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {m.attachments.map((a) => (
                    <li
                      key={a.name}
                      className="inline-flex items-center gap-1 rounded-crm border border-crm-border bg-crm-raised px-2 py-1 text-xs text-crm-soft"
                    >
                      <Paperclip className="size-3" aria-hidden /> {a.name}
                      <span className="text-crm-subtle">{bytes(a.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>

        {t.status !== "solved" ? (
          <form
            onSubmit={send}
            aria-label="Reply"
            className={cn(
              "flex flex-col gap-2 rounded-crm border p-3",
              mode === "note"
                ? "border-tag-amber-border bg-tag-amber-bg/30"
                : "border-crm-border bg-crm-card",
            )}
          >
            <div role="tablist" aria-label="Reply type" className="flex gap-1">
              {(["reply", "note"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={mode === k}
                  onClick={() => setMode(k)}
                  className={cn(
                    "h-6 cursor-pointer rounded-full px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    mode === k ? "bg-crm-muted text-crm-fg" : "text-crm-subtle hover:text-crm-fg",
                  )}
                >
                  {k === "reply"
                    ? `Public reply to ${t.requester.name.split(" ")[0]}`
                    : "Internal note"}
                </button>
              ))}
              {macros.length ? (
                <select
                  aria-label="Apply macro"
                  value=""
                  onChange={(e) => {
                    const m = macros.find((x) => x.id === e.target.value);
                    if (!m) return;
                    setDraft(
                      (d) =>
                        (d ? `${d}\n\n` : "") +
                        m.body.replace(/\{\{requester\}\}/g, t.requester.name.split(" ")[0] ?? ""),
                    );
                    if (m.setStatus) setSendStatus(m.setStatus);
                    setMode("reply");
                  }}
                  className="ml-auto h-6 rounded-crm border border-crm-border bg-crm-raised px-1.5 text-xs text-crm-soft outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  <option value="">⚡ Macros</option>
                  {macros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <label htmlFor={`reply-${t.id}`} className="sr-only">
              {mode === "reply" ? "Reply" : "Internal note"}
            </label>
            <Textarea
              id={`reply-${t.id}`}
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
              }}
              placeholder={
                mode === "reply"
                  ? "Write a reply… (Ctrl+Enter to send)"
                  : "Only teammates see notes"
              }
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-crm-subtle tabular-nums">
                {draft.length} chars
              </span>
              {mode === "reply" ? (
                <label className="flex items-center gap-1.5 text-xs text-crm-soft">
                  Send as
                  <select
                    value={sendStatus}
                    onChange={(e) => setSendStatus(e.target.value as TicketDetailStatus)}
                    className="h-7 rounded-crm border border-crm-border bg-crm-raised px-1.5 text-xs text-crm-fg capitalize outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="on-hold">On hold</option>
                    <option value="solved">Solved</option>
                  </select>
                </label>
              ) : null}
              <Button type="submit" size="sm" disabled={!draft.trim()}>
                {mode === "reply" ? (
                  <Send className="size-3" aria-hidden />
                ) : (
                  <Lock className="size-3" aria-hidden />
                )}
                {mode === "reply" ? "Send" : "Add note"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between rounded-crm border border-crm-border bg-crm-card p-3 text-sm text-crm-soft">
            Ticket solved.
            <Button size="sm" variant="secondary" onClick={() => update({ status: "open" })}>
              Reopen
            </Button>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <section
          aria-label="SLA"
          className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-3"
        >
          <h2 className="crm-eyebrow flex items-center gap-1.5 text-crm-subtle">
            <Timer className="size-3" aria-hidden /> SLA · {t.priority}
          </h2>
          {timers.map((x) => (
            <div key={x.label} className="flex items-center justify-between text-xs">
              <span className="text-crm-soft">{x.label}</span>
              <span
                aria-live="polite"
                className={cn(
                  "tabular-nums",
                  x.state === "met"
                    ? "text-crm-success"
                    : x.state === "missed"
                      ? "text-crm-danger"
                      : x.state === "paused"
                        ? "text-crm-subtle"
                        : x.minutes < 0
                          ? "text-crm-danger"
                          : x.minutes < 60
                            ? "text-crm-warning"
                            : "text-crm-fg",
                )}
              >
                {x.state === "met"
                  ? "Met"
                  : x.state === "missed"
                    ? "Missed"
                    : x.state === "paused"
                      ? "Paused"
                      : x.minutes < 0
                        ? `Breached ${dur(x.minutes)}`
                        : `${dur(x.minutes)} left`}
              </span>
            </div>
          ))}
        </section>

        <section
          aria-label="Properties"
          className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3"
        >
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Status
            <select
              className={sel}
              value={t.status}
              onChange={(e) => update({ status: e.target.value as TicketDetailStatus })}
            >
              {(["new", "open", "pending", "on-hold", "solved"] as const).map((s) => (
                <option key={s} value={s}>
                  {s.replace("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Priority
            <select
              className={sel}
              value={t.priority}
              onChange={(e) => update({ priority: e.target.value as TicketDetailPriority })}
            >
              {(["urgent", "high", "normal", "low"] as const).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Assignee
            <select
              className={sel}
              value={t.assignee ?? ""}
              onChange={(e) => update({ assignee: e.target.value || undefined })}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {t.assignee !== currentUser ? (
            <Button size="sm" variant="ghost" onClick={() => update({ assignee: currentUser })}>
              <Zap className="size-3" aria-hidden /> Take it
            </Button>
          ) : null}
        </section>

        <section
          aria-label="Requester"
          className="rounded-crm border border-crm-border bg-crm-card p-3"
        >
          <div className="mb-3 flex items-center gap-2">
            <Avatar name={t.requester.name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.requester.name}</p>
              <p className="truncate text-xs text-crm-subtle">{t.requester.email}</p>
            </div>
          </div>
          <DescriptionList
            layout="inline"
            items={[
              { label: "Company", value: t.requester.company },
              { label: "Plan", value: t.requester.plan },
              {
                label: "Messages",
                value: String(t.messages.filter((m) => m.kind === "customer").length),
              },
            ]}
          />
        </section>
      </aside>
    </article>
  );
}
