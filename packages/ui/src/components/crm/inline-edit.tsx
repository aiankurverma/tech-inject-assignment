import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/crm/input";
import { cn } from "@/lib/utils";

export interface InlineEditOption {
  value: string;
  label: string;
}

export interface InlineEditProps {
  value: string;
  /** Called with the new value. Return a promise to show a saving state; throw/reject to keep editing. */
  onSave: (value: string) => void | Promise<void>;
  /** Accessible name of the field, e.g. "Deal amount". */
  label: string;
  type?: "text" | "number" | "email" | "url" | "textarea" | "select";
  /** Options for type="select". */
  options?: InlineEditOption[];
  placeholder?: string;
  /** Return an error message to block saving. */
  validate?: (value: string) => string | undefined;
  /** Custom read-only rendering of the value. */
  renderValue?: (value: string) => React.ReactNode;
  /** blur: save on blur (default). cancel: discard on blur. */
  onBlurAction?: "save" | "cancel";
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Click-to-edit field. Enter (or Ctrl+Enter in textarea) saves, Escape cancels,
 * blur saves by default. Shows saving and validation-error states.
 */
export function InlineEdit({
  value,
  onSave,
  label,
  type = "text",
  options = [],
  placeholder = "Empty",
  validate,
  renderValue,
  onBlurAction = "save",
  disabled,
  size = "md",
  className,
}: InlineEditProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);
  const fieldRef = React.useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const displayRef = React.useRef<HTMLButtonElement>(null);
  const errorId = React.useId();

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  React.useEffect(() => {
    if (!editing) return;
    const el = fieldRef.current;
    el?.focus();
    if (el && "select" in el && type !== "select") el.select();
  }, [editing, type]);

  const close = () => {
    setEditing(false);
    setError(undefined);
    requestAnimationFrame(() => displayRef.current?.focus());
  };
  const cancel = () => {
    setDraft(value);
    close();
  };
  const commit = async () => {
    if (saving) return;
    if (draft === value) return close();
    const msg = validate?.(draft);
    if (msg) {
      setError(msg);
      return;
    }
    try {
      setSaving(true);
      await onSave(draft);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === "Enter" && (type !== "textarea" || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void commit();
    }
  };
  const onBlur = (e: React.FocusEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (onBlurAction === "cancel") cancel();
    else void commit();
  };

  const shown =
    type === "select" ? (options.find((o) => o.value === value)?.label ?? value) : value;
  const h = size === "sm" ? "h-7 text-xs" : "h-8 text-sm";

  if (!editing) {
    return (
      <button
        ref={displayRef}
        type="button"
        disabled={disabled}
        aria-label={`${label}: ${shown || "empty"}. Edit`}
        onClick={() => setEditing(true)}
        className={cn(
          "group -mx-2 flex w-[calc(100%+1rem)] cursor-text items-center gap-2 rounded-lg px-2 text-left font-crm text-crm-fg",
          "outline-none transition-colors duration-150 ease-crm hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60",
          "disabled:cursor-default disabled:hover:bg-transparent",
          type === "textarea" ? "min-h-8 py-1.5 text-sm whitespace-pre-wrap" : h,
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1",
            type !== "textarea" && "truncate",
            !shown && "text-crm-faint",
          )}
        >
          {shown ? (renderValue ? renderValue(value) : shown) : placeholder}
        </span>
        {disabled ? null : (
          <Pencil
            className="size-3 shrink-0 text-crm-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          />
        )}
      </button>
    );
  }

  const common = {
    "aria-label": label,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    disabled: saving,
    onKeyDown,
  } as const;
  const fieldCls =
    "w-full rounded-crm border border-crm-ring bg-crm-raised px-2 font-crm text-crm-fg outline-none ring-2 ring-crm-ring/40 aria-[invalid=true]:border-crm-danger aria-[invalid=true]:ring-crm-danger/20 [color-scheme:dark]";

  return (
    <div className={cn("flex flex-col gap-1 font-crm", className)} onBlur={onBlur}>
      <div className="flex items-start gap-1">
        {type === "textarea" ? (
          <textarea
            ref={fieldRef}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(fieldCls, "resize-y py-1.5 text-sm leading-5")}
            {...common}
          />
        ) : type === "select" ? (
          <select
            ref={fieldRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(fieldCls, h, "cursor-pointer")}
            {...common}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value} className="bg-crm-popover">
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            ref={fieldRef}
            type={type}
            value={draft}
            placeholder={placeholder}
            invalid={!!error}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(h, "px-2")}
            {...common}
          />
        )}
        <button
          type="button"
          aria-label="Save"
          disabled={saving}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void commit()}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-crm-primary text-crm-primary-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50 [&_svg]:size-3.5"
        >
          {saving ? (
            <span
              className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
          ) : (
            <Check />
          )}
        </button>
        <button
          type="button"
          aria-label="Cancel"
          disabled={saving}
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-crm-raised text-crm-soft shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50 [&_svg]:size-3.5"
        >
          <X />
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-crm-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
