import * as React from "react";
import { Paperclip, Send, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/components/crm/button";
import { Textarea } from "@/components/crm/textarea";
import { cn } from "@/lib/utils";

export interface EmailDraft {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  /** Size in bytes. */
  size?: number;
}

export interface EmailComposerProps {
  /** Sender shown in the From row. */
  from?: string;
  defaultValue?: Partial<EmailDraft>;
  /** Called with the draft. Return a promise to show a sending state. */
  onSend: (draft: EmailDraft) => void | Promise<void>;
  onDiscard?: () => void;
  /** Fires on every edit, e.g. to autosave. */
  onChange?: (draft: EmailDraft) => void;
  attachments?: EmailAttachment[];
  onAttach?: () => void;
  onRemoveAttachment?: (id: string) => void;
  /** Extra footer controls (templates, scheduling...). */
  toolbar?: React.ReactNode;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatSize(bytes?: number) {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function RecipientField({
  label,
  values,
  onChange,
  autoFocus,
  trailing,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  autoFocus?: boolean;
  trailing?: React.ReactNode;
}) {
  const [text, setText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const commit = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    onChange([...values, ...parts.filter((p) => !values.includes(p))]);
    setText("");
  };
  return (
    <div className="flex min-h-10 items-start gap-2 border-b border-crm-border px-4 py-1.5">
      <label htmlFor={id} className="w-12 shrink-0 pt-1.5 text-xs text-crm-subtle">
        {label}
      </label>
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v) => {
          const bad = !EMAIL_RE.test(v);
          return (
            <span
              key={v}
              className={cn(
                "inline-flex h-6 max-w-full items-center gap-1 rounded-full border pr-1 pl-2 text-xs",
                bad
                  ? "border-crm-danger/40 bg-crm-danger/10 text-crm-danger"
                  : "border-crm-input/60 bg-crm-raised text-crm-fg",
              )}
            >
              <span className="truncate">{v}</span>
              {bad ? <span className="sr-only">(invalid address)</span> : null}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
              >
                <X />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="email"
          autoFocus={autoFocus}
          value={text}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;]\s*$/.test(v)) commit(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              commit(text);
            } else if (e.key === "Backspace" && !text && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => commit(text)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (/[\s,;]/.test(t.trim())) {
              e.preventDefault();
              commit(text + t);
            }
          }}
          className="h-7 min-w-32 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle [color-scheme:dark]"
        />
      </div>
      {trailing}
    </div>
  );
}

/**
 * Email composer with To/CC/BCC recipient chips (Enter, comma or paste to add; Backspace removes),
 * subject, auto-growing body and attachments. Ctrl/⌘+Enter sends.
 */
export function EmailComposer({
  from,
  defaultValue,
  onSend,
  onDiscard,
  onChange,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  toolbar,
  className,
}: EmailComposerProps) {
  const [draft, setDraft] = React.useState<EmailDraft>({
    to: defaultValue?.to ?? [],
    cc: defaultValue?.cc ?? [],
    bcc: defaultValue?.bcc ?? [],
    subject: defaultValue?.subject ?? "",
    body: defaultValue?.body ?? "",
  });
  const [showCc, setShowCc] = React.useState(!!draft.cc.length);
  const [showBcc, setShowBcc] = React.useState(!!draft.bcc.length);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const errorId = React.useId();
  const subjectId = React.useId();

  const set = <K extends keyof EmailDraft>(key: K, v: EmailDraft[K]) => {
    const next = { ...draft, [key]: v };
    setDraft(next);
    setError(undefined);
    onChange?.(next);
  };

  const all = [...draft.to, ...draft.cc, ...draft.bcc];
  const invalid = all.filter((a) => !EMAIL_RE.test(a));
  const canSend = draft.to.length > 0 && !invalid.length && !sending;

  const send = async () => {
    if (!draft.to.length) return setError("Add at least one recipient.");
    if (invalid.length) return setError(`Fix invalid address: ${invalid.join(", ")}`);
    try {
      setSending(true);
      await onSend(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send email.");
    } finally {
      setSending(false);
    }
  };

  const toggle = (on: boolean, label: string, show: () => void) =>
    on ? null : (
      <button
        type="button"
        onClick={show}
        className="cursor-pointer rounded-md px-1.5 pt-1.5 text-xs text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
      >
        {label}
      </button>
    );

  return (
    <form
      aria-label="Compose email"
      aria-busy={sending || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void send();
        }
      }}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      {from ? (
        <div className="flex h-10 items-center gap-2 border-b border-crm-border px-4">
          <span className="w-12 shrink-0 text-xs text-crm-subtle">From</span>
          <span className="truncate text-sm text-crm-soft">{from}</span>
        </div>
      ) : null}
      <RecipientField
        label="To"
        values={draft.to}
        onChange={(v) => set("to", v)}
        trailing={
          <span className="flex shrink-0">
            {toggle(showCc, "Cc", () => setShowCc(true))}
            {toggle(showBcc, "Bcc", () => setShowBcc(true))}
          </span>
        }
      />
      {showCc ? (
        <RecipientField label="Cc" values={draft.cc} onChange={(v) => set("cc", v)} />
      ) : null}
      {showBcc ? (
        <RecipientField label="Bcc" values={draft.bcc} onChange={(v) => set("bcc", v)} />
      ) : null}
      <div className="flex h-10 items-center gap-2 border-b border-crm-border px-4">
        <label htmlFor={subjectId} className="w-12 shrink-0 text-xs text-crm-subtle">
          Subject
        </label>
        <input
          id={subjectId}
          value={draft.subject}
          onChange={(e) => set("subject", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) e.preventDefault();
          }}
          placeholder="Subject"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium text-crm-fg outline-none placeholder:font-normal placeholder:text-crm-subtle"
        />
      </div>
      <div className="p-2">
        <Textarea
          aria-label="Message"
          value={draft.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder="Write your message..."
          autoResize
          rows={6}
          maxRows={20}
          className="border-transparent bg-transparent hover:border-transparent focus-visible:border-transparent focus-visible:ring-0"
        />
      </div>
      {attachments.length ? (
        <ul aria-label="Attachments" className="flex flex-wrap gap-1.5 px-4 pb-3">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-crm-raised pr-1 pl-2 text-xs shadow-crm-raised"
            >
              <Paperclip className="size-3 text-crm-subtle" aria-hidden />
              <span className="max-w-40 truncate">{a.name}</span>
              {a.size !== undefined ? (
                <span className="text-crm-subtle">{formatSize(a.size)}</span>
              ) : null}
              {onRemoveAttachment ? (
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => onRemoveAttachment(a.id)}
                  className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
                >
                  <X />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="px-4 pb-2 text-xs text-crm-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2 border-t border-crm-border px-3 py-2.5">
        <Button
          type="submit"
          variant="primary"
          loading={sending}
          aria-describedby={error ? errorId : undefined}
          aria-disabled={!canSend || undefined}
        >
          {sending ? null : <Send aria-hidden />}
          {sending ? "Sending" : "Send"}
        </Button>
        {onAttach ? (
          <IconButton label="Attach files" onClick={onAttach}>
            <Paperclip />
          </IconButton>
        ) : null}
        {toolbar}
        <span className="ml-auto hidden text-xs text-crm-faint sm:inline">
          Ctrl + Enter to send
        </span>
        {onDiscard ? (
          <IconButton label="Discard draft" onClick={onDiscard} className="hover:text-crm-danger">
            <Trash2 />
          </IconButton>
        ) : null}
      </div>
    </form>
  );
}
