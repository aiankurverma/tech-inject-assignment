import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface TagInputProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  /** Maximum number of tags; the field stops accepting input once reached. */
  max?: number;
  /** Allow the same tag twice (case-insensitive check). */
  allowDuplicates?: boolean;
  /** Return false (or a string reason) to reject a tag. */
  validate?: (tag: string) => boolean | string;
  /** Characters that commit the current text as a tag (Enter always does). */
  delimiters?: string[];
  /** Colour for each tag; a function lets you colour by value. */
  tagColor?: TagColor | ((tag: string) => TagColor);
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

/** Free-form token field. Enter/comma/Tab adds, Backspace on empty removes the last tag, pasted lists are split, each tag has a remove button. */
export function TagInput({
  value: valueProp,
  defaultValue = [],
  onChange,
  placeholder = "Add tag…",
  max,
  allowDuplicates,
  validate,
  delimiters = [",", ";"],
  tagColor = "neutral",
  disabled,
  invalid,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  className,
}: TagInputProps) {
  const [inner, setInner] = React.useState<string[]>(defaultValue);
  const tags = valueProp ?? inner;
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const full = max != null && tags.length >= max;

  const set = (next: string[]) => {
    if (valueProp === undefined) setInner(next);
    onChange?.(next);
  };

  const add = (raw: string[]) => {
    const next = [...tags];
    let reason: string | null = null;
    for (const r of raw) {
      const t = r.trim();
      if (!t) continue;
      if (max != null && next.length >= max) {
        reason = `Up to ${max} tags`;
        break;
      }
      if (!allowDuplicates && next.some((x) => x.toLowerCase() === t.toLowerCase())) {
        reason = `"${t}" already added`;
        continue;
      }
      const ok = validate ? validate(t) : true;
      if (ok !== true) {
        reason = typeof ok === "string" ? ok : `"${t}" is not allowed`;
        continue;
      }
      next.push(t);
    }
    setError(reason);
    if (next.length !== tags.length) {
      set(next);
      setAnnounce(`Added ${next.slice(tags.length).join(", ")}`);
    }
  };

  const remove = (index: number) => {
    const removed = tags[index];
    set(tags.filter((_, i) => i !== index));
    setAnnounce(`Removed ${removed}`);
    inputRef.current?.focus();
  };

  const colorFor = (t: string) => (typeof tagColor === "function" ? tagColor(t) : tagColor);
  const splitter = new RegExp(`[${delimiters.map((d) => `\\${d}`).join("")}\\n]`);

  return (
    <div className={cn("flex w-full flex-col gap-1 font-crm", className)}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-crm border border-crm-input/60 bg-crm-raised px-2 py-1.5",
          "transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
          "focus-within:border-crm-ring focus-within:ring-2 focus-within:ring-crm-ring/40",
          (invalid || error) && "border-crm-danger ring-crm-danger/20",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
        )}
      >
        <ul aria-label="Selected tags" className="contents">
          {tags.map((t, i) => (
            <li key={`${t}-${i}`} className="contents">
              <Tag color={colorFor(t)} className="gap-0.5 pr-0.5 text-[13px]">
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(i);
                  }}
                  className="grid size-4 cursor-pointer place-items-center rounded-full opacity-70 outline-none hover:bg-black/20 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-2.5"
                >
                  <X />
                </button>
              </Tag>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          id={fieldId}
          disabled={disabled || full}
          aria-label={ariaLabel}
          aria-describedby={cn(describedBy, error && `${fieldId}-err`) || undefined}
          aria-invalid={invalid || !!error || undefined}
          placeholder={full ? "" : tags.length ? "" : placeholder}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setError(null);
            if (splitter.test(v)) {
              const parts = v.split(splitter);
              setText(parts.pop() ?? "");
              add(parts);
            } else setText(v);
          }}
          onPaste={(e) => {
            const data = e.clipboardData.getData("text");
            if (splitter.test(data)) {
              e.preventDefault();
              add(data.split(splitter));
            }
          }}
          onKeyDown={(e) => {
            if (
              (e.key === "Enter" || (e.key === "Tab" && text.trim())) &&
              !e.nativeEvent.isComposing
            ) {
              if (text.trim()) {
                e.preventDefault();
                add([text]);
                setText("");
              } else if (e.key === "Enter") e.preventDefault();
            } else if (e.key === "Backspace" && !text && tags.length) {
              e.preventDefault();
              remove(tags.length - 1);
            } else if (e.key === "Escape") {
              setText("");
              setError(null);
            }
          }}
          onBlur={() => {
            if (text.trim()) {
              add([text]);
              setText("");
            }
          }}
          className="h-6 min-w-[80px] flex-1 bg-transparent px-1 text-sm text-crm-fg outline-none placeholder:text-crm-subtle disabled:cursor-not-allowed"
        />
      </div>
      <div className="flex justify-between text-[11px]">
        <span id={`${fieldId}-err`} role={error ? "alert" : undefined} className="text-crm-danger">
          {error}
        </span>
        {max != null ? (
          <span className="text-crm-subtle tabular-nums">
            {tags.length}/{max}
          </span>
        ) : null}
      </div>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
