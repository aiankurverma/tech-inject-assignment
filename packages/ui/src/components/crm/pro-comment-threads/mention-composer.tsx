import * as React from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { cn } from "@/lib/utils";
import type { CommentUser } from "@/components/crm/pro-comment-threads/types";
import { Avatar } from "@/components/crm/pro-comment-threads/avatar";

export interface MentionComposerProps {
  users: CommentUser[];
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onSubmit: (body: string, mentions: string[]) => void;
  onCancel?: () => void;
  className?: string;
}

const MAX_SUGGESTIONS = 8;

/** Finds an "@query" token that ends at the caret. */
function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const upto = text.slice(0, caret);
  const m = /(^|\s)@([\p{L}\p{N}._-]{0,32})$/u.exec(upto);
  if (!m) return null;
  return { start: caret - m[2]!.length - 1, query: m[2]!.toLowerCase() };
}

/**
 * Plain textarea with an accessible @mention combobox (floating-ui positioning,
 * ARIA combobox + listbox with aria-activedescendant). Enter picks a mention,
 * Ctrl/Cmd+Enter submits, Escape closes the picker, then cancels.
 */
export function MentionComposer({
  users,
  placeholder = "Reply… use @ to mention",
  submitLabel = "Reply",
  autoFocus,
  disabled,
  onSubmit,
  onCancel,
  className,
}: MentionComposerProps) {
  const [text, setText] = React.useState("");
  const [picked, setPicked] = React.useState<Map<string, CommentUser>>(() => new Map());
  const [trigger, setTrigger] = React.useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = React.useState(0);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const listId = React.useId();

  const { refs, floatingStyles } = useFloating({
    open: !!trigger,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.minWidth = `${Math.min(rects.reference.width, 280)}px`;
        },
      }),
    ],
  });

  const suggestions = React.useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query;
    const out: CommentUser[] = [];
    for (const u of users) {
      if (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().startsWith(q)) out.push(u);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
  }, [trigger, users]);

  const open = !!trigger && suggestions.length > 0;

  const sync = (value: string, caret: number) => {
    setText(value);
    const t = mentionQueryAt(value, caret);
    setTrigger(t);
    setActive(0);
  };

  const pick = (u: CommentUser) => {
    const el = ref.current;
    if (!el || !trigger) return;
    const caret = el.selectionStart ?? text.length;
    const insert = `@${u.name} `;
    const next = text.slice(0, trigger.start) + insert + text.slice(caret);
    setText(next);
    setPicked((m) => new Map(m).set(u.id, u));
    setTrigger(null);
    const pos = trigger.start + insert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const submit = () => {
    const body = text.trim();
    if (!body || disabled) return;
    // Only keep mentions whose "@Name" survived later edits.
    const mentions = [...picked.values()]
      .filter((u) => body.includes(`@${u.name}`))
      .map((u) => u.id);
    onSubmit(body, mentions);
    setText("");
    setPicked(new Map());
    setTrigger(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[active]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setTrigger(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)} onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={(n) => {
          ref.current = n;
          refs.setReference(n);
        }}
        value={text}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={2}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={placeholder}
        onChange={(e) => sync(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setTrigger(null), 120)}
        className="w-full resize-none rounded-crm border border-crm-input bg-crm-bg px-2.5 py-2 text-sm text-crm-fg placeholder:text-crm-subtle focus:border-crm-ring focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-crm-subtle">Ctrl + Enter to send</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-crm px-2.5 py-1 text-xs text-crm-soft hover:bg-crm-muted"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="rounded-crm bg-crm-primary px-3 py-1 text-xs font-medium text-crm-primary-fg hover:opacity-90 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
      {open && (
        <FloatingPortal>
          <ul
            ref={refs.setFloating}
            id={listId}
            role="listbox"
            aria-label="Mention a teammate"
            style={floatingStyles}
            className="z-50 max-h-64 overflow-auto rounded-crm border border-crm-border bg-crm-popover p-1 text-sm text-crm-fg shadow-crm-raised"
          >
            {suggestions.map((u, i) => (
              <li
                key={u.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(u);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-crm px-2 py-1.5",
                  i === active && "bg-crm-muted",
                )}
              >
                <Avatar user={u} size={20} />
                <span className="truncate">{u.name}</span>
                {u.title && (
                  <span className="ml-auto truncate text-xs text-crm-subtle">{u.title}</span>
                )}
              </li>
            ))}
          </ul>
        </FloatingPortal>
      )}
    </div>
  );
}
