import * as React from "react";
import { ChevronsDownUp, ChevronsUpDown, CornerUpLeft, Forward, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export interface EmailParticipant {
  name: string;
  email: string;
  avatar?: string;
}

export interface EmailMessage {
  id: string;
  from: EmailParticipant;
  to: EmailParticipant[];
  cc?: EmailParticipant[];
  sentAt: Date | string;
  /** Plain-text body. Lines starting with ">" are treated as quoted history. */
  body: string;
  attachments?: { name: string; size?: string }[];
  unread?: boolean;
  /** Sent by the CRM user (right-aligned accent). */
  outbound?: boolean;
}

export interface EmailThreadProps {
  subject: string;
  messages: EmailMessage[];
  /** Collapse older messages into a "N older messages" bar when there are more than this. */
  collapseAfter?: number;
  onReply?: (m: EmailMessage) => void;
  onForward?: (m: EmailMessage) => void;
  locale?: string;
  className?: string;
}

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

function splitQuoted(body: string) {
  const lines = body.split("\n");
  const idx = lines.findIndex(
    (l, i) =>
      l.startsWith(">") || (/^On .+wrote:$/.test(l.trim()) && !!lines[i + 1]?.startsWith(">")),
  );
  if (idx === -1) return { main: body.trimEnd(), quoted: "" };
  return { main: lines.slice(0, idx).join("\n").trimEnd(), quoted: lines.slice(idx).join("\n") };
}

/**
 * Conversation view for an email thread: read messages collapse to one-line previews, unread and
 * latest stay open, long runs fold into "N older messages", quoted history hides behind a toggle,
 * with expand/collapse all and per-message reply/forward.
 */
export function EmailThread({
  subject,
  messages,
  collapseAfter = 3,
  onReply,
  onForward,
  locale,
  className,
}: EmailThreadProps) {
  const sorted = React.useMemo(
    () => [...messages].sort((a, b) => toDate(a.sentAt).getTime() - toDate(b.sentAt).getTime()),
    [messages],
  );
  const lastId = sorted[sorted.length - 1]?.id;
  const [open, setOpen] = React.useState<Set<string>>(
    () => new Set(sorted.filter((m) => m.unread || m.id === lastId).map((m) => m.id)),
  );
  const [showQuoted, setShowQuoted] = React.useState<Set<string>>(() => new Set());
  const [foldOpen, setFoldOpen] = React.useState(false);
  const fmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };
  const allOpen = sorted.every((m) => open.has(m.id));
  const participants = Array.from(new Map(sorted.map((m) => [m.from.email, m.from])).values());

  // Fold the middle: keep the first and the last (collapseAfter - 1) visible.
  const fold = !foldOpen && sorted.length > collapseAfter + 1;
  const hidden = fold
    ? sorted.slice(1, sorted.length - (collapseAfter - 1)).filter((m) => !m.unread)
    : [];
  const hiddenIds = new Set(hidden.map((m) => m.id));

  if (sorted.length === 0)
    return (
      <p className={cn("py-8 text-center font-crm text-sm text-crm-muted-fg", className)}>
        No messages in this thread.
      </p>
    );

  return (
    <article
      className={cn("rounded-crm border border-crm-border bg-crm-card font-crm", className)}
      aria-label={subject}
    >
      <header className="flex items-start justify-between gap-3 border-b border-crm-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-crm-fg">{subject}</h2>
          <p className="mt-1 truncate text-xs text-crm-muted-fg">
            {sorted.length} messages · {participants.map((p) => p.name.split(" ")[0]).join(", ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(allOpen ? new Set(lastId ? [lastId] : []) : new Set(sorted.map((m) => m.id)));
            setFoldOpen(!allOpen);
          }}
          className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-xs text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5"
        >
          {allOpen ? <ChevronsDownUp aria-hidden /> : <ChevronsUpDown aria-hidden />}
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </header>
      <ol className="divide-y divide-crm-border">
        {sorted.map((m, i) => {
          if (hiddenIds.has(m.id)) {
            return hidden[0]?.id === m.id ? (
              <li key="fold">
                <button
                  type="button"
                  onClick={() => setFoldOpen(true)}
                  className="w-full cursor-pointer py-1.5 text-center text-xs text-crm-soft outline-none hover:bg-crm-muted/50 focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset"
                >
                  {hidden.length} older {hidden.length === 1 ? "message" : "messages"}
                </button>
              </li>
            ) : null;
          }
          const isOpen = open.has(m.id);
          const { main, quoted } = splitQuoted(m.body);
          const preview = main.replace(/\s+/g, " ").slice(0, 140);
          const bodyId = `email-${m.id}-body`;
          return (
            <li key={m.id} className={cn(m.outbound && "bg-crm-primary/[0.04]")}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => setOpen((s) => toggle(s, m.id))}
                className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-left outline-none hover:bg-crm-muted/40 focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset"
              >
                <Avatar name={m.from.name} src={m.from.avatar} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn("truncate text-sm text-crm-fg", m.unread && "font-semibold")}
                    >
                      {m.from.name}
                      {m.unread ? (
                        <span
                          className="ml-1.5 inline-block size-1.5 rounded-full bg-crm-primary align-middle"
                          aria-label="Unread"
                        />
                      ) : null}
                    </span>
                    <time
                      dateTime={toDate(m.sentAt).toISOString()}
                      className="shrink-0 text-[11px] text-crm-muted-fg tabular-nums"
                    >
                      {fmt.format(toDate(m.sentAt))}
                    </time>
                  </span>
                  {isOpen ? (
                    <span className="block truncate text-[11px] text-crm-muted-fg">
                      to {m.to.map((p) => p.name).join(", ")}
                      {m.cc?.length ? ` · cc ${m.cc.map((p) => p.name).join(", ")}` : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 truncate text-xs text-crm-muted-fg">
                      {m.attachments?.length ? (
                        <Paperclip className="size-3 shrink-0" aria-label="Has attachments" />
                      ) : null}
                      <span className="truncate">{preview}</span>
                    </span>
                  )}
                </span>
              </button>
              {isOpen ? (
                <div id={bodyId} className="px-4 pb-3 pl-[58px]">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-crm-chip">
                    {main}
                  </p>
                  {quoted ? (
                    <>
                      <button
                        type="button"
                        aria-expanded={showQuoted.has(m.id)}
                        onClick={() => setShowQuoted((s) => toggle(s, m.id))}
                        aria-label={showQuoted.has(m.id) ? "Hide quoted text" : "Show quoted text"}
                        className="mt-2 h-4 cursor-pointer rounded bg-crm-muted px-1.5 text-[11px] leading-none text-crm-soft hover:text-crm-fg"
                      >
                        •••
                      </button>
                      {showQuoted.has(m.id) ? (
                        <pre className="mt-2 border-l-2 border-crm-border pl-2 font-crm text-xs whitespace-pre-wrap text-crm-muted-fg">
                          {quoted}
                        </pre>
                      ) : null}
                    </>
                  ) : null}
                  {m.attachments?.length ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {m.attachments.map((a) => (
                        <li
                          key={a.name}
                          className="flex items-center gap-1 rounded-full border border-crm-border bg-crm-raised px-2 py-0.5 text-[11px] text-crm-chip"
                        >
                          <Paperclip className="size-3" aria-hidden />
                          {a.name}
                          {a.size ? <span className="text-crm-muted-fg">{a.size}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {(onReply || onForward) && (i === sorted.length - 1 || isOpen) ? (
                    <div className="mt-3 flex gap-1.5">
                      {onReply ? (
                        <button
                          type="button"
                          onClick={() => onReply(m)}
                          className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-crm-raised px-2.5 text-xs text-crm-fg shadow-crm-raised hover:bg-crm-muted [&_svg]:size-3.5"
                        >
                          <CornerUpLeft aria-hidden /> Reply
                        </button>
                      ) : null}
                      {onForward ? (
                        <button
                          type="button"
                          onClick={() => onForward(m)}
                          className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-crm-raised px-2.5 text-xs text-crm-fg shadow-crm-raised hover:bg-crm-muted [&_svg]:size-3.5"
                        >
                          <Forward aria-hidden /> Forward
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
