import * as React from "react";
import { Check, Copy, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CopyState = "idle" | "copying" | "copied" | "error";

/** Write text to the clipboard, falling back to a hidden textarea + execCommand on insecure origins. */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Copy command was rejected");
}

/** Hook with the copy state machine: idle → copying → copied | error → idle after `resetAfter`. */
export function useCopy(resetAfter = 1800) {
  const [state, setState] = React.useState<CopyState>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const copy = React.useCallback(
    async (source: string | (() => string | Promise<string>)) => {
      clearTimeout(timer.current);
      setState("copying");
      try {
        const text = typeof source === "function" ? await source() : source;
        await copyText(text);
        setState("copied");
        return true;
      } catch {
        setState("error");
        return false;
      } finally {
        timer.current = setTimeout(() => setState("idle"), resetAfter);
      }
    },
    [resetAfter],
  );
  return { state, copy };
}

export interface CopyButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onCopy" | "onError"
> {
  /** Text to copy, or a (possibly async) getter, e.g. to fetch a signed share URL on demand. */
  value: string | (() => string | Promise<string>);
  /** Visible label. Omit for an icon-only button (then `aria-label` describes what is copied). */
  label?: React.ReactNode;
  copiedLabel?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
  resetAfter?: number;
  onCopied?: (text: string) => void;
  onError?: () => void;
}

/**
 * Copies text to the clipboard and confirms it in place (icon swap + polite live region). Handles
 * async values, insecure-context fallback, errors, and resets after a timeout.
 */
export function CopyButton({
  value,
  label,
  copiedLabel = "Copied",
  size = "md",
  variant = "ghost",
  resetAfter = 1800,
  onCopied,
  onError,
  disabled,
  className,
  "aria-label": ariaLabel,
  ...props
}: CopyButtonProps) {
  const { state, copy } = useCopy(resetAfter);
  const run = async () => {
    let captured = "";
    const ok = await copy(async () => {
      captured = typeof value === "function" ? await value() : value;
      return captured;
    });
    if (ok) onCopied?.(captured);
    else onError?.();
  };
  const Icon = state === "copied" ? Check : state === "error" ? X : Copy;
  const text =
    state === "copied" ? copiedLabel : state === "error" ? "Copy failed" : (label ?? null);
  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || state === "copying"}
      aria-label={label ? undefined : (ariaLabel ?? "Copy to clipboard")}
      data-state={state}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full font-crm font-medium whitespace-nowrap outline-none",
        "transition-[background-color,color] duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5",
        variant === "ghost"
          ? "text-crm-soft hover:bg-crm-muted hover:text-crm-fg"
          : "bg-crm-raised text-crm-fg shadow-crm-raised hover:bg-crm-muted",
        size === "sm" ? "h-6 text-[11px]" : "h-[30px] text-xs",
        label ? (size === "sm" ? "px-2" : "px-2.5") : size === "sm" ? "w-6" : "w-[30px]",
        state === "copied" && "text-crm-success hover:text-crm-success",
        state === "error" && "text-crm-danger hover:text-crm-danger",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className={state === "copying" ? "animate-pulse" : undefined} />
      {label ? <span>{text}</span> : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? copiedLabel : state === "error" ? "Copy failed" : ""}
      </span>
    </button>
  );
}

export interface CopyFieldProps {
  value: string;
  label?: string;
  /** Mask the value (API keys, webhook secrets) with a reveal toggle. */
  secret?: boolean;
  /** Characters left visible at the end while masked. */
  visibleChars?: number;
  className?: string;
}

/** Read-only monospace field with copy (and optional reveal) — for API keys, IDs, webhook URLs. */
export function CopyField({ value, label, secret, visibleChars = 4, className }: CopyFieldProps) {
  const [revealed, setRevealed] = React.useState(false);
  const id = React.useId();
  const shown =
    secret && !revealed
      ? "•".repeat(Math.max(8, Math.min(24, value.length - visibleChars))) +
        value.slice(-visibleChars)
      : value;
  return (
    <div className={cn("flex flex-col gap-1.5 font-crm", className)}>
      {label ? (
        <span id={id} className="text-xs text-crm-soft">
          {label}
        </span>
      ) : null}
      <div className="flex h-9 items-center gap-1 rounded-crm border border-crm-input/60 bg-crm-raised pr-1 pl-3">
        <code
          aria-labelledby={label ? id : undefined}
          className="min-w-0 flex-1 truncate font-mono text-xs text-crm-fg"
        >
          {shown}
        </code>
        {secret ? (
          <button
            type="button"
            aria-label={revealed ? "Hide value" : "Reveal value"}
            aria-pressed={revealed}
            onClick={() => setRevealed((r) => !r)}
            className="grid size-[30px] cursor-pointer place-items-center rounded-full text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5"
          >
            {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        ) : null}
        <CopyButton value={value} aria-label={`Copy ${label ?? "value"}`} />
      </div>
    </div>
  );
}
