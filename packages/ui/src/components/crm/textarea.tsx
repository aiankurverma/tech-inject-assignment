import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** Grow with content up to maxRows. */
  autoResize?: boolean;
  maxRows?: number;
  /** Show "n / maxLength" under the field (needs maxLength). */
  showCount?: boolean;
}

/** Multi-line text field matching Input, with optional auto-resize and character counter. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    invalid,
    autoResize,
    maxRows = 8,
    showCount,
    maxLength,
    onChange,
    value,
    defaultValue,
    rows = 3,
    ...props
  },
  forwarded,
) {
  const inner = React.useRef<HTMLTextAreaElement | null>(null);
  const [typed, setTyped] = React.useState(String(defaultValue ?? "").length);
  const count = value !== undefined ? String(value).length : typed;
  const setRef = (el: HTMLTextAreaElement | null) => {
    inner.current = el;
    if (typeof forwarded === "function") forwarded(el);
    else if (forwarded) forwarded.current = el;
  };
  const resize = React.useCallback(() => {
    const el = inner.current;
    if (!el || !autoResize) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows + 16)}px`;
  }, [autoResize, maxRows]);
  React.useLayoutEffect(() => {
    resize();
  }, [value, resize]);
  const field = (
    <textarea
      ref={setRef}
      rows={rows}
      value={value}
      defaultValue={defaultValue}
      maxLength={maxLength}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      onChange={(e) => {
        setTyped(e.target.value.length);
        resize();
        onChange?.(e);
      }}
      className={cn(
        "block w-full resize-y rounded-crm border border-crm-input/60 bg-crm-raised px-3 py-2 font-crm text-sm leading-5 text-crm-fg placeholder:text-crm-subtle",
        "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
        "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40",
        "aria-[invalid=true]:border-crm-danger disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]",
        autoResize && "resize-none overflow-y-auto",
        className,
      )}
      {...props}
    />
  );
  if (!showCount || !maxLength) return field;
  return (
    <div className="flex flex-col gap-1">
      {field}
      <span
        aria-live="polite"
        className={cn(
          "self-end font-crm text-xs tabular-nums",
          count >= maxLength ? "text-crm-danger" : "text-crm-subtle",
        )}
      >
        {count} / {maxLength}
      </span>
    </div>
  );
});
