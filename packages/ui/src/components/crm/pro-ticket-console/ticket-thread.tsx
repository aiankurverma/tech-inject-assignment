import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Eye, Lock, MessageSquare, PenLine, RotateCw, Send } from "lucide-react";
import { Button } from "@/components/crm/button";
import type { Ticket, TicketMacro, TicketMessage } from "@/components/crm/pro-ticket-console/types";
import { cn } from "@/lib/utils";

export interface TicketThreadProps {
  ticket: Ticket | null;
  currentUser: string;
  loadThread?: (ticket: Ticket) => Promise<TicketMessage[]>;
  onReply?: (ticketId: string, body: string, internal: boolean) => void | Promise<void>;
  macros: TicketMacro[];
  onApplyMacro: (macro: TicketMacro) => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const threadKey = (id: string) => ["pro-ticket-console", "thread", id] as const;

export function TicketThread({
  ticket,
  currentUser,
  loadThread,
  onReply,
  macros,
  onApplyMacro,
  composerRef,
}: TicketThreadProps) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: threadKey(ticket?.id ?? "none"),
    queryFn: () => (ticket && loadThread ? loadThread(ticket) : Promise.resolve([])),
    enabled: !!ticket,
    staleTime: 30_000,
  });
  const [draft, setDraft] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setDraft("");
    setInternal(false);
  }, [ticket?.id]);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [query.data]);

  if (!ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-crm-muted-fg">
        <MessageSquare className="size-6" aria-hidden />
        Select a ticket, or press <kbd className="rounded bg-crm-muted px-1">j</kbd> to start.
      </div>
    );
  }

  const others = (ticket.viewers ?? []).filter((v) => v !== currentUser);
  const replying = (ticket.replying ?? []).filter((v) => v !== currentUser);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    const msg: TicketMessage = {
      id: `local-${Date.now()}`,
      author: currentUser,
      role: internal ? "internal" : "agent",
      body,
      at: new Date().toISOString(),
    };
    const key = threadKey(ticket.id);
    const prev = client.getQueryData<TicketMessage[]>(key);
    client.setQueryData<TicketMessage[]>(key, [...(prev ?? []), msg]);
    setDraft("");
    setSending(true);
    try {
      await onReply?.(ticket.id, body, internal);
    } catch {
      client.setQueryData(key, prev);
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const insertMacro = (m: TicketMacro) => {
    if (m.reply) {
      const first = ticket.requester.name.split(" ")[0] ?? "";
      setDraft((d) => (d ? `${d}\n\n` : "") + m.reply!.replace(/\{\{name\}\}/g, first));
    }
    onApplyMacro(m);
    composerRef.current?.focus();
  };

  return (
    <section aria-label={`Ticket ${ticket.id}`} className="flex h-full min-w-0 flex-col">
      <header className="border-b border-crm-border px-4 py-3">
        <p className="text-xs text-crm-muted-fg">#{ticket.id}</p>
        <h2 className="mt-1 text-sm font-medium text-crm-fg">{ticket.subject}</h2>
      </header>
      {(replying.length > 0 || others.length > 0) && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 border-b border-crm-border px-4 py-2 text-xs",
            replying.length
              ? "bg-crm-danger/10 text-crm-danger"
              : "bg-crm-warning/10 text-crm-warning",
          )}
        >
          {replying.length ? (
            <PenLine className="size-3.5" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
          {replying.length
            ? `${replying.join(", ")} ${replying.length > 1 ? "are" : "is"} replying right now. Coordinate before you send.`
            : `${others.join(", ")} ${others.length > 1 ? "are" : "is"} also viewing this ticket.`}
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {query.isPending ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-crm bg-crm-muted/60" />
          ))
        ) : query.isError ? (
          <div className="flex flex-col items-start gap-2 rounded-crm border border-crm-danger/40 bg-crm-danger/10 p-3 text-sm text-crm-danger">
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="size-4" aria-hidden />
              Could not load the conversation.
            </span>
            <Button size="sm" variant="danger" onClick={() => query.refetch()}>
              <RotateCw className="size-3" /> Retry
            </Button>
          </div>
        ) : query.data.length === 0 ? (
          <p className="text-sm text-crm-muted-fg">No messages yet.</p>
        ) : (
          query.data.map((m) => (
            <article
              key={m.id}
              className={cn(
                "rounded-crm border p-3 text-sm",
                m.role === "customer" && "border-crm-border bg-crm-card",
                m.role === "agent" && "ml-6 border-crm-primary/30 bg-crm-primary/10",
                m.role === "internal" && "ml-6 border-crm-warning/30 bg-crm-warning/10",
              )}
            >
              <header className="mb-1.5 flex items-center gap-2 text-xs">
                <span className="font-medium text-crm-fg">{m.author}</span>
                {m.role === "internal" && (
                  <span className="inline-flex items-center gap-0.5 text-crm-warning">
                    <Lock className="size-3" aria-hidden /> Internal note
                  </span>
                )}
                <time className="ml-auto text-crm-muted-fg" dateTime={m.at}>
                  {format(new Date(m.at), "MMM d, HH:mm")}
                </time>
              </header>
              <p className="whitespace-pre-wrap text-crm-soft">{m.body}</p>
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form
        className="border-t border-crm-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <div
            role="radiogroup"
            aria-label="Reply type"
            className="flex rounded-full bg-crm-muted p-0.5"
          >
            {[
              { v: false, l: "Public reply" },
              { v: true, l: "Internal note" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={internal === o.v}
                onClick={() => setInternal(o.v)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs",
                  internal === o.v
                    ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                    : "text-crm-muted-fg",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-crm-muted-fg">
            Macro
            <select
              value=""
              onChange={(e) => {
                const m = macros.find((x) => x.id === e.target.value);
                if (m) insertMacro(m);
              }}
              className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg"
            >
              <option value="">Apply…</option>
              {macros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          aria-label={internal ? "Internal note" : "Reply to customer"}
          placeholder={internal ? "Visible to agents only…" : `Reply to ${ticket.requester.name}…`}
          className={cn(
            "w-full resize-none rounded-crm border bg-crm-input/30 p-2.5 text-sm text-crm-fg outline-none placeholder:text-crm-muted-fg focus:ring-2 focus:ring-crm-ring",
            internal ? "border-crm-warning/40" : "border-crm-border",
          )}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-crm-muted-fg">Ctrl/Cmd + Enter to send</span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={sending}
            disabled={!draft.trim()}
          >
            <Send className="size-3" /> {internal ? "Add note" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}
