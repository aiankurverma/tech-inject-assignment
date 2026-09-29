import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiffSide } from "@/components/crm/pro-diff-viewer/diff-model";

export interface DiffComment {
  id: string;
  side: DiffSide;
  /** 1-based line number on `side`. */
  line: number;
  author: { name: string; avatarUrl?: string };
  body: string;
  createdAt: Date | string | number;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function CommentThread({ comments }: { comments: DiffComment[] }) {
  return (
    <ul className="space-y-2 border-y border-crm-border bg-crm-card px-4 py-3 font-crm">
      {comments.map((c) => (
        <li key={c.id} className="flex gap-2.5">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-crm-muted text-[10px] font-medium text-crm-soft"
          >
            {initials(c.author.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-crm-muted-fg">
              <span className="font-medium text-crm-fg">{c.author.name}</span>{" "}
              <time dateTime={new Date(c.createdAt).toISOString()}>
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
              </time>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-crm-soft">{c.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface CommentComposerProps {
  side: DiffSide;
  line: number;
  onSubmit: (body: string) => Promise<void> | void;
  onCancel: () => void;
}

export function CommentComposer({ side, line, onSubmit, onCancel }: CommentComposerProps) {
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => ref.current?.focus(), []);

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(body.trim());
      setBody("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not post comment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-y border-crm-border bg-crm-card px-4 py-3 font-crm">
      <label className="sr-only" htmlFor={`composer-${side}-${line}`}>
        Comment on {side} line {line}
      </label>
      <textarea
        id={`composer-${side}-${line}`}
        ref={ref}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
        }}
        placeholder={`Comment on line ${line}... (Ctrl+Enter to post)`}
        className="w-full resize-none rounded-crm border border-crm-input bg-crm-bg px-3 py-2 text-sm text-crm-fg placeholder:text-crm-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
      />
      {err && (
        <p role="alert" className="mt-1 text-xs text-crm-danger">
          {err}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-crm px-3 py-1.5 text-xs text-crm-soft hover:bg-crm-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!body.trim() || busy}
          onClick={() => void submit()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-crm bg-crm-primary px-3 py-1.5 text-xs font-medium text-crm-primary-fg",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
          Comment
        </button>
      </div>
    </div>
  );
}
