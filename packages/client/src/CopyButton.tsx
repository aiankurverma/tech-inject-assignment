import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";

type State = "idle" | "loading" | "done" | "error";

// Dark styles use `[.dark_&]:` (a `.dark` ancestor) rather than `dark:` so apps without
// class-based dark mode (admin) always get the light look, whatever the OS setting.
const VARIANTS = {
  outline:
    "border-neutral-200 bg-white text-neutral-900 shadow-xs hover:border-neutral-300 hover:bg-neutral-50 [.dark_&]:border-neutral-800 [.dark_&]:bg-neutral-950 [.dark_&]:text-neutral-100 [.dark_&]:hover:border-neutral-700 [.dark_&]:hover:bg-neutral-900",
  solid:
    "border-neutral-950 bg-neutral-950 text-white shadow-xs hover:bg-neutral-800 [.dark_&]:border-neutral-50 [.dark_&]:bg-neutral-50 [.dark_&]:text-neutral-950 [.dark_&]:hover:bg-neutral-200",
  ghost:
    "border-transparent bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 [.dark_&]:text-neutral-400 [.dark_&]:hover:bg-neutral-800 [.dark_&]:hover:text-neutral-50",
} as const;

/**
 * Copies text (or the result of an async getter) and shows success/error feedback.
 * Without children it renders as a compact icon button; pass `label` for its accessible name.
 */
export function CopyButton({
  getText,
  children,
  className = "",
  label = "Copy",
  variant = "outline",
}: {
  getText: () => string | Promise<string>;
  children?: ReactNode;
  className?: string;
  label?: string;
  variant?: keyof typeof VARIANTS;
}) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const onClick = async () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setState("loading");
    try {
      const text = await getText();
      await navigator.clipboard.writeText(text);
      setState("done");
      setMessage("Copied");
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Copy failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 2500);
  };

  const Icon =
    state === "loading" ? Loader2 : state === "done" ? Check : state === "error" ? X : Copy;
  const iconOnly = children === undefined;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={state === "loading"}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-wait [.dark_&]:focus-visible:outline-neutral-100 ${
          iconOnly ? "w-9" : "px-3"
        } ${VARIANTS[variant]} ${state === "error" ? "text-red-700! [.dark_&]:text-red-400!" : ""} ${className}`}
      >
        <Icon className={`size-4 ${state === "loading" ? "animate-spin" : ""}`} aria-hidden />
        {iconOnly ? null : state === "done" ? "Copied" : children}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "done" || state === "error" ? message : ""}
      </span>
      {state === "error" ? (
        <span className="absolute top-full left-0 z-10 mt-1.5 w-max max-w-64 rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700 shadow-sm [.dark_&]:border-red-900 [.dark_&]:bg-neutral-950 [.dark_&]:text-red-400">
          {message}
        </span>
      ) : null}
    </span>
  );
}
