import * as React from "react";
import { Archive, ArrowLeft, Inbox, MailOpen, Paperclip, Reply, Send, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Checkbox } from "@/components/crm/checkbox";
import { EmailComposer, type EmailDraft } from "@/components/crm/email-composer";
import { SearchInput } from "@/components/crm/search-input";
import { Tag } from "@/components/crm/tag";

export type EmailFolder = "inbox" | "starred" | "sent" | "archived";

export interface EmailMessage {
  id: string;
  from: { name: string; email: string };
  /** ISO datetime. */
  at: string;
  body: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  folder: "inbox" | "sent" | "archived";
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
  /** Linked CRM record, e.g. "Deal · Acme renewal". */
  linkedRecord?: string;
  messages: EmailMessage[];
}

export interface EmailInboxProps {
  threads?: EmailThread[];
  defaultThreads?: EmailThread[];
  onThreadsChange?: (threads: EmailThread[]) => void;
  /** Mailbox owner — used as sender on replies. */
  me: { name: string; email: string };
  onReply?: (threadId: string, draft: EmailDraft) => void | Promise<void>;
  locale?: string;
  loading?: boolean;
  className?: string;
}

const FOLDERS: { id: EmailFolder; label: string; icon: React.ReactNode }[] = [
  { id: "inbox", label: "Inbox", icon: <Inbox className="size-3.5" aria-hidden /> },
  { id: "starred", label: "Starred", icon: <Star className="size-3.5" aria-hidden /> },
  { id: "sent", label: "Sent", icon: <Send className="size-3.5" aria-hidden /> },
  { id: "archived", label: "Archived", icon: <Archive className="size-3.5" aria-hidden /> },
];

const NO_MESSAGE: EmailMessage = { id: "", from: { name: "", email: "" }, at: "", body: "" };
const last = (t: EmailThread): EmailMessage => t.messages[t.messages.length - 1] ?? NO_MESSAGE;
const first = (t: EmailThread): EmailMessage => t.messages[0] ?? NO_MESSAGE;

/** Two-pane CRM email inbox: folders, search, unread/star, bulk archive, keyboard nav and inline reply. */
export function EmailInbox({
  threads: threadsProp,
  defaultThreads = [],
  onThreadsChange,
  me,
  onReply,
  locale = "en-US",
  loading,
  className,
}: EmailInboxProps) {
  const [inner, setInner] = React.useState(defaultThreads);
  const threads = threadsProp ?? inner;
  const [folder, setFolder] = React.useState<EmailFolder>("inbox");
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [replying, setReplying] = React.useState(false);

  const commit = (next: EmailThread[]) => {
    if (threadsProp === undefined) setInner(next);
    onThreadsChange?.(next);
  };
  const patch = (ids: string[], p: Partial<EmailThread>) =>
    commit(threads.map((t) => (ids.includes(t.id) ? { ...t, ...p } : t)));

  const q = query.trim().toLowerCase();
  const list = threads
    .filter((t) =>
      folder === "starred" ? t.starred && t.folder !== "archived" : t.folder === folder,
    )
    .filter(
      (t) =>
        !q ||
        t.subject.toLowerCase().includes(q) ||
        t.messages.some(
          (m) => m.from.name.toLowerCase().includes(q) || m.body.toLowerCase().includes(q),
        ),
    )
    .sort((a, b) => last(b).at.localeCompare(last(a).at));

  const open = threads.find((t) => t.id === openId) ?? null;
  const unread = (f: EmailFolder) =>
    threads.filter((t) => t.unread && (f === "starred" ? t.starred : t.folder === f)).length;

  const openThread = (t: EmailThread) => {
    setOpenId(t.id);
    setReplying(false);
    if (t.unread) patch([t.id], { unread: false });
  };

  const when = (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const i = list.findIndex((t) => t.id === openId);
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      const n = list[Math.min(list.length - 1, i + 1)];
      if (n) openThread(n);
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = list[Math.max(0, i - 1)];
      if (n) openThread(n);
    } else if (e.key === "e" && open) {
      patch([open.id], { folder: "archived" });
      setOpenId(null);
    } else if (e.key === "s" && open) {
      patch([open.id], { starred: !open.starred });
    }
  };

  const sel = [...checked];

  return (
    <section
      aria-label="Email inbox"
      className={cn(
        "grid h-[560px] grid-cols-1 overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised md:grid-cols-[160px_300px_1fr]",
        className,
      )}
    >
      <nav
        aria-label="Folders"
        className="hidden flex-col gap-0.5 border-r border-crm-border p-2 md:flex"
      >
        {FOLDERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-current={folder === f.id ? "page" : undefined}
            onClick={() => {
              setFolder(f.id);
              setOpenId(null);
              setChecked(new Set());
            }}
            className={cn(
              "flex items-center gap-2 rounded-crm px-2 py-1.5 text-sm text-crm-soft outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              folder === f.id && "bg-crm-muted text-crm-fg",
            )}
          >
            {f.icon}
            {f.label}
            {unread(f.id) ? (
              <span className="ml-auto text-xs tabular-nums">{unread(f.id)}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div
        className={cn("flex min-h-0 flex-col border-r border-crm-border", open && "hidden md:flex")}
      >
        <div className="flex flex-col gap-2 border-b border-crm-border p-2">
          <select
            aria-label="Folder"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value as EmailFolder);
              setOpenId(null);
            }}
            className="h-7 rounded-crm border border-crm-border bg-crm-bg px-2 text-xs md:hidden"
          >
            {FOLDERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <SearchInput size="sm" placeholder="Search mail" value={query} onValueChange={setQuery} />
          {sel.length ? (
            <div
              role="toolbar"
              aria-label="Bulk actions"
              className="flex items-center gap-2 text-xs"
            >
              <span className="tabular-nums">{sel.length} selected</span>
              <button
                type="button"
                className="ml-auto hover:underline"
                onClick={() => {
                  patch(sel, { unread: false });
                  setChecked(new Set());
                }}
              >
                Mark read
              </button>
              {folder !== "archived" ? (
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => {
                    patch(sel, { folder: "archived" });
                    setChecked(new Set());
                    if (openId && sel.includes(openId)) setOpenId(null);
                  }}
                >
                  Archive
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {loading ? (
          <div className="flex flex-col gap-2 p-2" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-crm bg-crm-muted" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="p-8 text-center text-sm text-crm-subtle">
            {q ? "No messages match your search." : "Nothing here."}
          </p>
        ) : (
          <ul
            role="listbox"
            aria-label="Threads. j/k to move, e to archive, s to star"
            tabIndex={0}
            onKeyDown={onListKey}
            aria-activedescendant={openId ? `thread-${openId}` : undefined}
            className="min-h-0 flex-1 divide-y divide-crm-border overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crm-ring/60"
          >
            {list.map((t) => {
              const m = last(t);
              return (
                <li
                  key={t.id}
                  id={`thread-${t.id}`}
                  role="option"
                  aria-selected={openId === t.id}
                  onClick={() => openThread(t)}
                  className={cn(
                    "flex cursor-pointer gap-2 px-2.5 py-2 hover:bg-crm-muted/40",
                    openId === t.id && "bg-crm-muted/70",
                  )}
                >
                  <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                    <Checkbox
                      aria-label={`Select ${t.subject}`}
                      checked={checked.has(t.id)}
                      onCheckedChange={(v) =>
                        setChecked((s) => {
                          const n = new Set(s);
                          if (v) n.add(t.id);
                          else n.delete(t.id);
                          return n;
                        })
                      }
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {t.unread ? (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-crm-primary"
                          aria-label="Unread"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "truncate text-sm",
                          t.unread ? "font-medium" : "text-crm-soft",
                        )}
                      >
                        {m.from.email === me.email ? "You" : m.from.name}
                      </span>
                      {t.messages.length > 1 ? (
                        <span className="text-xs text-crm-subtle">{t.messages.length}</span>
                      ) : null}
                      <span className="ml-auto shrink-0 text-xs text-crm-subtle tabular-nums">
                        {when(m.at)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        t.unread ? "text-crm-fg" : "text-crm-soft",
                      )}
                    >
                      {t.subject}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-crm-subtle">
                      <span className="truncate">{m.body.split("\n")[0]}</span>
                      {t.hasAttachment ? (
                        <Paperclip className="size-3 shrink-0" aria-label="Has attachment" />
                      ) : null}
                      {t.starred ? (
                        <Star
                          className="size-3 shrink-0 fill-tag-amber-text text-tag-amber-text"
                          aria-label="Starred"
                        />
                      ) : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={cn("min-h-0 flex-col overflow-y-auto", open ? "flex" : "hidden md:flex")}>
        {!open ? (
          <div className="m-auto flex flex-col items-center gap-2 text-center text-sm text-crm-subtle">
            <MailOpen className="size-6 text-crm-faint" aria-hidden />
            Select a conversation
          </div>
        ) : (
          <>
            <header className="flex items-start gap-2 border-b border-crm-border p-3">
              <button
                type="button"
                aria-label="Back to list"
                onClick={() => setOpenId(null)}
                className="rounded p-1 text-crm-soft hover:bg-crm-muted md:hidden"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-medium">{open.subject}</h3>
                {open.linkedRecord ? (
                  <Tag size="sm" color="purple" className="mt-1">
                    {open.linkedRecord}
                  </Tag>
                ) : null}
              </div>
              <button
                type="button"
                aria-pressed={!!open.starred}
                aria-label={open.starred ? "Unstar" : "Star"}
                onClick={() => patch([open.id], { starred: !open.starred })}
                className="rounded p-1.5 text-crm-soft hover:bg-crm-muted"
              >
                <Star
                  className={cn(
                    "size-4",
                    open.starred && "fill-tag-amber-text text-tag-amber-text",
                  )}
                />
              </button>
              <button
                type="button"
                aria-label={open.folder === "archived" ? "Move to inbox" : "Archive"}
                onClick={() => {
                  patch([open.id], { folder: open.folder === "archived" ? "inbox" : "archived" });
                  setOpenId(null);
                }}
                className="rounded p-1.5 text-crm-soft hover:bg-crm-muted"
              >
                <Archive className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Mark unread"
                onClick={() => {
                  patch([open.id], { unread: true });
                  setOpenId(null);
                }}
                className="rounded p-1.5 text-crm-soft hover:bg-crm-muted"
              >
                <MailOpen className="size-4" />
              </button>
            </header>
            <ol className="flex flex-col gap-3 p-3">
              {open.messages.map((m) => (
                <li key={m.id} className="rounded-crm border border-crm-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar name={m.from.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.from.name}</p>
                      <p className="truncate text-xs text-crm-subtle">{m.from.email}</p>
                    </div>
                    <time dateTime={m.at} className="text-xs text-crm-subtle">
                      {new Date(m.at).toLocaleString(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="text-sm whitespace-pre-line text-crm-soft">{m.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-auto p-3">
              {replying ? (
                <EmailComposer
                  from={me.email}
                  defaultValue={{
                    to: [
                      last(open).from.email === me.email
                        ? first(open).from.email
                        : last(open).from.email,
                    ],
                    subject: open.subject.startsWith("Re:") ? open.subject : `Re: ${open.subject}`,
                  }}
                  onDiscard={() => setReplying(false)}
                  onSend={async (draft) => {
                    await onReply?.(open.id, draft);
                    patch([open.id], {
                      messages: [
                        ...open.messages,
                        {
                          id: `m-${Date.now()}`,
                          from: me,
                          at: new Date().toISOString(),
                          body: draft.body,
                        },
                      ],
                    });
                    setReplying(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setReplying(true)}
                  className="flex w-full items-center gap-2 rounded-crm border border-crm-border px-3 py-2 text-sm text-crm-soft outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  <Reply className="size-3.5" aria-hidden /> Reply to{" "}
                  {last(open).from.email === me.email
                    ? first(open).from.name
                    : last(open).from.name}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
