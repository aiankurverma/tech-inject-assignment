import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]{2,}$/;
export const isEmail = (s: string) => EMAIL_RE.test(s.trim());

export interface RecipientInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Email token field: Enter, comma, semicolon or paste split addresses; Backspace removes the last. */
export function RecipientInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: RecipientInputProps) {
  const [text, setText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const id = React.useId();

  const commit = (raw: string) => {
    const parts = raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().replace(/^<|>$/g, ""))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setText("");
  };

  const invalid = value.filter((v) => !isEmail(v));

  return (
    <div className="flex items-start gap-2 border-b border-crm-border px-4 py-2">
      <label htmlFor={id} className="pt-1 text-sm text-crm-muted-fg">
        {label}
      </label>
      <div
        className="flex min-h-7 flex-1 flex-wrap items-center gap-1"
        onClick={() => inputRef.current?.focus()}
      >
        <ul className="contents" aria-label={`${label} recipients`}>
          {value.map((email) => {
            const bad = !isEmail(email);
            return (
              <li
                key={email}
                className={cn(
                  "flex items-center gap-1 rounded-[5px] border py-0.5 pr-0.5 pl-1.5 text-xs",
                  bad
                    ? "border-tag-red-border bg-tag-red-bg text-tag-red-text"
                    : "border-crm-border bg-crm-raised text-crm-fg",
                )}
              >
                <span>{email}</span>
                {bad && <span className="sr-only">(invalid address)</span>}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((v) => v !== email))}
                  aria-label={`Remove ${email}`}
                  className="rounded p-0.5 text-crm-muted-fg hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
        <input
          ref={inputRef}
          id={id}
          value={text}
          disabled={disabled}
          type="email"
          multiple
          autoComplete="off"
          aria-invalid={invalid.length > 0 || undefined}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;]/.test(v)) commit(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") {
              if (text.trim()) {
                e.preventDefault();
                commit(text);
              }
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(text)}
          onPaste={(e) => {
            e.preventDefault();
            commit(text + e.clipboardData.getData("text"));
          }}
          className="h-7 min-w-[8rem] flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-faint"
        />
      </div>
    </div>
  );
}
