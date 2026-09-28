import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  default: "bg-crm-muted text-crm-fg border-crm-border",
  primary: "bg-tag-purple-bg text-tag-purple-text border-tag-purple-border",
  success: "bg-crm-success/12 text-crm-success border-crm-success/25",
  danger: "bg-crm-danger/12 text-crm-danger border-crm-danger/25",
} as const;

export interface InlineCodeProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "onCopy"
> {
  children: string;
  tone?: keyof typeof tones;
  /** Click (or Enter/Space) copies the full value and briefly confirms. */
  copyable?: boolean;
  /** Middle-truncate long identifiers to this many characters, e.g. `cus_8fK2…Q91z`. The full value stays in the title and in the copy. */
  maxChars?: number;
  onCopy?: (value: string) => void;
}

/** Shortens `value` around the middle so both prefix and suffix stay recognisable. */
export function middleTruncate(value: string, maxChars: number): string {
  if (value.length <= maxChars || maxChars < 5) return value;
  const keep = maxChars - 1;
  const head = Math.ceil(keep / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - (keep - head))}`;
}

/** Monospace token for IDs, keys, field names and commands, with optional copy and middle truncation. */
export function InlineCode({
  children,
  tone = "default",
  copyable,
  maxChars,
  onCopy,
  className,
  ...props
}: InlineCodeProps) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");
  const shown = maxChars ? middleTruncate(children, maxChars) : children;

  React.useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 1500);
    return () => window.clearTimeout(t);
  }, [state]);

  const base = cn(
    "inline-flex max-w-full items-center rounded-[5px] border px-1 py-px align-baseline font-mono text-[0.85em] leading-snug whitespace-nowrap",
    tones[tone],
    className,
  );

  if (!copyable) {
    return (
      <code title={shown !== children ? children : undefined} className={base} {...props}>
        {shown}
      </code>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setState("copied");
      onCopy?.(children);
    } catch {
      setState("failed");
    }
  };

  return (
    <code
      role="button"
      tabIndex={0}
      title={state === "copied" ? "Copied" : `Copy ${children}`}
      aria-label={`${children}. Activate to copy`}
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void copy();
        }
      }}
      className={cn(
        base,
        "cursor-pointer outline-none hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-primary",
        state === "copied" && "border-crm-success/40 text-crm-success",
        state === "failed" && "border-crm-danger/40 text-crm-danger",
      )}
      {...props}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy blocked" : shown}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy" : ""}
      </span>
    </code>
  );
}
