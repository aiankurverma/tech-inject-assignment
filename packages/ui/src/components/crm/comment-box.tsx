import * as React from "react";
import { AtSign, Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export interface Mentionable {
  id: string;
  name: string;
  avatar?: string;
}

export interface CommentBoxProps {
  /** Current user, shown on the left. */
  author: { name: string; avatar?: string };
  onSubmit: (text: string, mentions: Mentionable[]) => void | Promise<void>;
  /** People offered after typing "@". */
  mentionables?: Mentionable[];
  onAttach?: () => void;
  placeholder?: string;
  submitLabel?: string;
  className?: string;
}

/**
 * Note/comment composer with @mention suggestions. Cmd/Ctrl+Enter sends; in the mention list
 * ArrowUp/ArrowDown move, Enter/Tab insert, Escape closes.
 */
export function CommentBox({
  author,
  onSubmit,
  mentionables = [],
  onAttach,
  placeholder = "Write a note… use @ to mention",
  submitLabel = "Comment",
  className,
}: CommentBoxProps) {
  const [text, setText] = React.useState("");
  const [query, setQuery] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const listId = React.useId();

  const matches =
    query === null
      ? []
      : mentionables.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  const updateQuery = (value: string, caret: number) => {
    const m = /(?:^|\s)@(\w*)$/.exec(value.slice(0, caret));
    setQuery(m ? (m[1] ?? "") : null);
    setActive(0);
  };

  const insert = (m: Mentionable) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@(\w*)$/, `@${m.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    const mentions = mentionables.filter((m) => value.includes(`@${m.name}`));
    setBusy(true);
    try {
      await onSubmit(value, mentions);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setActive((a) => (a + d + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(matches[active]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const open = matches.length > 0;
  return (
    <div className={cn("flex gap-3 font-crm", className)}>
      <Avatar name={author.name} src={author.avatar} size="md" />
      <div className="relative min-w-0 flex-1 rounded-crm border border-crm-input/60 bg-crm-raised transition-[border-color,box-shadow] duration-150 focus-within:border-crm-ring focus-within:ring-2 focus-within:ring-crm-ring/40">
        <textarea
          ref={ref}
          rows={2}
          value={text}
          placeholder={placeholder}
          aria-label="Comment"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            updateQuery(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setQuery(null), 120)}
          className="block max-h-40 min-h-[60px] w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-crm-fg outline-none placeholder:text-crm-subtle"
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Mention someone"
            className="absolute top-full left-2 z-50 mt-1 w-56 rounded-xl border border-crm-border bg-crm-popover p-1 shadow-crm-overlay"
          >
            {matches.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-crm-fg",
                  i === active && "bg-crm-muted",
                )}
              >
                <Avatar name={m.name} src={m.avatar} size="xs" />
                {m.name}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex gap-0.5">
            <button
              type="button"
              aria-label="Mention someone"
              onClick={() => {
                const next = `${text}${text && !text.endsWith(" ") ? " " : ""}@`;
                setText(next);
                setQuery("");
                ref.current?.focus();
              }}
              className="grid size-7 cursor-pointer place-items-center rounded-full text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <AtSign className="size-3.5" />
            </button>
            {onAttach ? (
              <button
                type="button"
                aria-label="Attach file"
                onClick={onAttach}
                className="grid size-7 cursor-pointer place-items-center rounded-full text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                <Paperclip className="size-3.5" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || busy}
            aria-busy={busy || undefined}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg shadow-crm-primary outline-none hover:bg-[#5237ff] focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="size-3" />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
