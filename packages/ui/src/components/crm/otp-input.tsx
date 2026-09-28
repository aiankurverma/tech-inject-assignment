import * as React from "react";
import { cn } from "@/lib/utils";

export interface OtpInputProps {
  /** Number of boxes. */
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Fires once every box is filled. */
  onComplete?: (value: string) => void;
  /** "numeric" accepts digits only; "alphanumeric" accepts A-Z and 0-9 (upper-cased). */
  mode?: "numeric" | "alphanumeric";
  /** Draw a separator after every N boxes (e.g. 3 for "123-456"). */
  groupSize?: number;
  /** Mask characters like a password. */
  mask?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Accessible name for the group. */
  "aria-label"?: string;
  className?: string;
}

/** Row of one-character boxes for verification codes. Typing advances, Backspace goes back, arrows/Home/End move, paste fills every box. */
export function OtpInput({
  length = 6,
  value: valueProp,
  defaultValue = "",
  onChange,
  onComplete,
  mode = "numeric",
  groupSize,
  mask,
  disabled,
  invalid,
  autoFocus,
  "aria-label": ariaLabel = "Verification code",
  className,
}: OtpInputProps) {
  const [inner, setInner] = React.useState(defaultValue.slice(0, length));
  const value = (valueProp ?? inner).slice(0, length);
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const clean = (s: string) =>
    (mode === "numeric" ? s.replace(/\D/g, "") : s.replace(/[^A-Za-z0-9]/g, "")).toUpperCase();

  /** Slots are stored as a string padded with spaces for empty boxes. */
  const slots = value.padEnd(length, " ").split("");

  const set = (arr: string[]) => {
    const v = arr.join("").trimEnd();
    if (valueProp === undefined) setInner(v);
    onChange?.(v);
    if (v.length === length && !v.includes(" ")) onComplete?.(v);
  };

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const writeAt = (i: number, chars: string) => {
    const arr = [...slots];
    for (let k = 0; k < chars.length && i + k < length; k++) arr[i + k] = chars[k] ?? " ";
    set(arr);
    focusAt(i + chars.length);
  };

  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex items-center gap-2", className)}>
      {slots.map((raw, i) => {
        const ch = raw === " " ? "" : raw;
        return (
          <React.Fragment key={i}>
            {groupSize && i > 0 && i % groupSize === 0 ? (
              <span aria-hidden className="h-px w-3 shrink-0 bg-crm-input" />
            ) : null}
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              type={mask ? "password" : "text"}
              inputMode={mode === "numeric" ? "numeric" : "text"}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              autoFocus={autoFocus && i === 0}
              disabled={disabled}
              aria-label={`Character ${i + 1} of ${length}`}
              aria-invalid={invalid || undefined}
              value={ch}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const typed = clean(e.target.value);
                if (!typed) return;
                // If the box already had a char, the newest keystroke is the one that differs.
                const chars = ch && typed.length === 2 ? typed.replace(ch, "") || ch : typed;
                writeAt(i, chars);
              }}
              onPaste={(e) => {
                e.preventDefault();
                const chars = clean(e.clipboardData.getData("text"));
                if (chars) writeAt(chars.length >= length ? 0 : i, chars);
              }}
              onKeyDown={(e) => {
                const arr = [...slots];
                switch (e.key) {
                  case "Backspace":
                    e.preventDefault();
                    if (ch) {
                      arr[i] = " ";
                      set(arr);
                    } else if (i > 0) {
                      arr[i - 1] = " ";
                      set(arr);
                      focusAt(i - 1);
                    }
                    break;
                  case "Delete":
                    e.preventDefault();
                    arr[i] = " ";
                    set(arr);
                    break;
                  case "ArrowLeft":
                    e.preventDefault();
                    focusAt(i - 1);
                    break;
                  case "ArrowRight":
                    e.preventDefault();
                    focusAt(i + 1);
                    break;
                  case "Home":
                    e.preventDefault();
                    focusAt(0);
                    break;
                  case "End":
                    e.preventDefault();
                    focusAt(length - 1);
                    break;
                }
              }}
              className={cn(
                "size-10 rounded-crm border border-crm-input/60 bg-crm-raised text-center font-crm text-base font-medium text-crm-fg tabular-nums caret-crm-primary",
                "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
                "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40",
                "aria-[invalid=true]:border-crm-danger disabled:cursor-not-allowed disabled:opacity-50",
                ch && "border-crm-input",
              )}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
