import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step" | "size"
> {
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places kept when committing a value. Defaults to the decimals in `step`. */
  precision?: number;
  /** Intl options used to display the value while the field is not focused. */
  formatOptions?: Intl.NumberFormatOptions;
  locale?: string;
  invalid?: boolean;
  size?: "sm" | "md";
  /** Hide the -/+ stepper buttons. */
  hideSteppers?: boolean;
}

const clamp = (n: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

const parseDraft = (text: string): number | null => {
  const t = text.replace(/[^\d.-]/g, "");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
};

/** Numeric field (role="spinbutton") with -/+ steppers, min/max clamping and Intl formatting on blur. ArrowUp/Down step (Shift x10), PageUp/PageDown x10, Home/End jump to min/max. */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      value: valueProp,
      defaultValue = null,
      onChange,
      min,
      max,
      step = 1,
      precision,
      formatOptions,
      locale,
      invalid,
      size = "md",
      hideSteppers,
      disabled,
      readOnly,
      className,
      onBlur,
      onFocus,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const [inner, setInner] = React.useState<number | null>(defaultValue);
    const controlled = valueProp !== undefined;
    const value = controlled ? valueProp : inner;
    const [draft, setDraft] = React.useState<string | null>(null);
    const decimals = precision ?? (String(step).split(".")[1]?.length || 0);

    const commit = (n: number | null) => {
      const next = n === null ? null : Number(clamp(n, min, max).toFixed(decimals));
      if (!controlled) setInner(next);
      if (next !== value) onChange?.(next);
    };

    const stepBy = (delta: number) => {
      if (disabled || readOnly) return;
      const current = draft !== null ? parseDraft(draft) : value;
      const base = current ?? (delta > 0 ? (min ?? 0) - delta : (max ?? 0) - delta);
      const next = clamp(base + delta, min, max);
      commit(next);
      if (draft !== null) setDraft(next.toFixed(decimals));
    };

    const jump = (n?: number) => {
      if (n == null) return;
      commit(n);
      if (draft !== null) setDraft(n.toFixed(decimals));
    };

    const display =
      draft ??
      (value == null
        ? ""
        : formatOptions
          ? new Intl.NumberFormat(locale, formatOptions).format(value)
          : value.toFixed(decimals));

    const btn =
      "grid h-full w-8 shrink-0 cursor-pointer place-items-center text-crm-subtle outline-none transition-colors duration-150 hover:bg-crm-muted hover:text-crm-fg disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-3.5";

    return (
      <div
        className={cn(
          "flex w-full items-stretch overflow-hidden rounded-crm border border-crm-input/60 bg-crm-raised font-crm",
          "transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
          "focus-within:border-crm-ring focus-within:ring-2 focus-within:ring-crm-ring/40",
          invalid && "border-crm-danger ring-crm-danger/20",
          size === "sm" ? "h-8" : "h-9",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {hideSteppers ? null : (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease"
            disabled={disabled || readOnly || (value != null && min != null && value <= min)}
            onClick={() => stepBy(-step)}
            className={cn(btn, "border-r border-crm-input/40")}
          >
            <Minus />
          </button>
        )}
        <input
          ref={ref}
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          role="spinbutton"
          autoComplete="off"
          aria-valuenow={value ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          readOnly={readOnly}
          value={display}
          onFocus={(e) => {
            setDraft(value == null ? "" : value.toFixed(decimals));
            onFocus?.(e);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            if (draft !== null) commit(parseDraft(draft));
            setDraft(null);
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;
            const big = step * 10;
            switch (e.key) {
              case "ArrowUp":
                e.preventDefault();
                stepBy(e.shiftKey ? big : step);
                break;
              case "ArrowDown":
                e.preventDefault();
                stepBy(e.shiftKey ? -big : -step);
                break;
              case "PageUp":
                e.preventDefault();
                stepBy(big);
                break;
              case "PageDown":
                e.preventDefault();
                stepBy(-big);
                break;
              case "Home":
                if (min != null) {
                  e.preventDefault();
                  jump(min);
                }
                break;
              case "End":
                if (max != null) {
                  e.preventDefault();
                  jump(max);
                }
                break;
              case "Enter":
                if (draft !== null) {
                  const n = parseDraft(draft);
                  commit(n);
                  setDraft(n == null ? "" : clamp(n, min, max).toFixed(decimals));
                }
                break;
            }
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-3 text-sm text-crm-fg tabular-nums outline-none placeholder:text-crm-subtle disabled:cursor-not-allowed",
            !hideSteppers && "text-center",
          )}
          {...props}
        />
        {hideSteppers ? null : (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase"
            disabled={disabled || readOnly || (value != null && max != null && value >= max)}
            onClick={() => stepBy(step)}
            className={cn(btn, "border-l border-crm-input/40")}
          >
            <Plus />
          </button>
        )}
      </div>
    );
  },
);
