import * as React from "react";
import { cn } from "@/lib/utils";

const hidden =
  "absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]";

export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLElement> {
  as?: "span" | "div" | "h2" | "h3" | "label" | "p";
  /** Becomes visible while focused (skip links, "Jump to results"). */
  focusable?: boolean;
}

/** Content available to screen readers but not drawn on screen. */
export function VisuallyHidden({
  as = "span",
  focusable,
  className,
  ...props
}: VisuallyHiddenProps) {
  const Comp = as as React.ElementType;
  return (
    <Comp
      className={cn(
        hidden,
        focusable &&
          "focus-within:static focus-within:m-0 focus-within:h-auto focus-within:w-auto focus-within:overflow-visible focus-within:whitespace-normal focus-within:[clip:auto] focus:static focus:m-0 focus:h-auto focus:w-auto focus:overflow-visible focus:[clip:auto]",
        className,
      )}
      {...props}
    />
  );
}

export interface SkipLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Id of the target landmark, without '#'. */
  targetId: string;
}

/** "Skip to content" link: hidden until focused, then moves focus into the target. */
export function SkipLink({
  targetId,
  children = "Skip to main content",
  className,
  onClick,
  ...props
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        onClick?.(e);
        const t = document.getElementById(targetId);
        if (!t) return;
        e.preventDefault();
        if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
        t.focus();
        t.scrollIntoView({ block: "start" });
      }}
      className={cn(
        hidden,
        "focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:m-0 focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-full focus:bg-crm-primary focus:px-3 focus:py-1.5 focus:font-crm focus:text-xs focus:font-medium focus:text-crm-primary-fg focus:shadow-crm-primary focus:outline-none focus:[clip:auto]",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

type Politeness = "polite" | "assertive";
const AnnouncerContext = React.createContext<
  ((message: string, politeness?: Politeness) => void) | null
>(null);

/**
 * Hosts two hidden live regions. Call `useAnnounce()` anywhere below to speak status changes
 * ("3 deals moved to Won", "Filters cleared") without visible UI.
 */
export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [msgs, setMsgs] = React.useState<Record<Politeness, string>>({ polite: "", assertive: "" });
  const timers = React.useRef<Partial<Record<Politeness, number>>>({});

  const announce = React.useCallback((message: string, politeness: Politeness = "polite") => {
    // Clear first so repeating the same message is announced again.
    setMsgs((m) => ({ ...m, [politeness]: "" }));
    window.clearTimeout(timers.current[politeness]);
    timers.current[politeness] = window.setTimeout(
      () => setMsgs((m) => ({ ...m, [politeness]: message })),
      60,
    );
  }, []);

  React.useEffect(
    () => () => {
      const t = timers.current;
      window.clearTimeout(t.polite);
      window.clearTimeout(t.assertive);
    },
    [],
  );

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {msgs.polite}
      </VisuallyHidden>
      <VisuallyHidden role="alert" aria-live="assertive" aria-atomic="true">
        {msgs.assertive}
      </VisuallyHidden>
    </AnnouncerContext.Provider>
  );
}

/** Returns `announce(message, politeness?)`. Safe without a provider (no-op + dev warning). */
export function useAnnounce() {
  const ctx = React.useContext(AnnouncerContext);
  return React.useCallback(
    (message: string, politeness?: Politeness) => {
      if (ctx) ctx(message, politeness);
      else if (typeof console !== "undefined")
        console.warn("useAnnounce: wrap your app in <AnnouncerProvider>");
    },
    [ctx],
  );
}
